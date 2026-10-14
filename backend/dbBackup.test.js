import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Daily rotating backups and recovery from a damaged db.json. Own temp folder (backups sit beside
// the database), and backups switched on (they are off by default under `node --test`).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-backup-test-"));
const dbPath = path.join(dir, "db.json");
const backups = path.join(dir, "backups");
process.env.DB_PATH = dbPath;
process.env.DB_BACKUPS = "on";
process.env.DB_BACKUP_KEEP = "3";

let db;
const today = new Date().toISOString().slice(0, 10);
const unreadableCopies = () => fs.readdirSync(dir).filter((f) => f.startsWith("db.json.unreadable-"));

before(async () => {
  db = await import("./db.js");
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("daily backups", () => {
  test("a backup is a copy of the database before that day's first write, and only one per day", async () => {
    // A fresh process image is the honest way to test "first write of the day".
    const { spawnSync } = await import("child_process");
    const sub = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-backup-sub-"));
    try {
      const script = `
        import fs from "fs";
        const db = await import(${JSON.stringify(new URL("./db.js", import.meta.url).href)});
        db.updateDB((d) => d.users.push({ id: "a" }));       // first write: file didn't exist, so the backup is the empty database
        db.updateDB((d) => d.users.push({ id: "b" }));       // same day: no new backup
        const names = fs.readdirSync(${JSON.stringify(path.join(sub, "backups"))});
        const kept = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(sub, "backups"))} + "/" + names[0], "utf8"));
        console.log(JSON.stringify({ names, usersInBackup: kept.users.length, usersNow: db.readDB().users.length }));
      `;
      const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, DB_PATH: path.join(sub, "db.json"), DB_BACKUPS: "on", DB_BACKUP_KEEP: "3", NODE_TEST_CONTEXT: "" },
        encoding: "utf8"
      });
      assert.equal(run.status, 0, run.stderr);
      const out = JSON.parse(run.stdout.trim().split("\n").pop());
      assert.equal(out.names.length, 1);
      assert.match(out.names[0], /^db-\d{4}-\d{2}-\d{2}\.json$/);
      assert.equal(out.usersInBackup, 0, "the backup is the state before the day's first write");
      assert.equal(out.usersNow, 2);
    } finally {
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });

  test("old backups are pruned to DB_BACKUP_KEEP when a new day's backup is taken", async () => {
    const { spawnSync } = await import("child_process");
    const sub = fs.mkdtempSync(path.join(os.tmpdir(), "northstar-backup-prune-"));
    try {
      const bdir = path.join(sub, "backups");
      fs.mkdirSync(bdir, { recursive: true });
      for (const day of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]) fs.writeFileSync(path.join(bdir, `db-${day}.json`), JSON.stringify({ users: [] }));
      fs.writeFileSync(path.join(sub, "db.json"), JSON.stringify({ users: [{ id: "x" }] }));
      const script = `
        import fs from "fs";
        const db = await import(${JSON.stringify(new URL("./db.js", import.meta.url).href)});
        db.updateDB((d) => d.users.push({ id: "y" }));
        console.log(JSON.stringify(fs.readdirSync(${JSON.stringify(bdir)}).sort()));
      `;
      const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
        env: { ...process.env, DB_PATH: path.join(sub, "db.json"), DB_BACKUPS: "on", DB_BACKUP_KEEP: "3", NODE_TEST_CONTEXT: "" },
        encoding: "utf8"
      });
      assert.equal(run.status, 0, run.stderr);
      const names = JSON.parse(run.stdout.trim().split("\n").pop());
      assert.equal(names.length, 3, `kept ${names.join(", ")}`);
      assert.ok(names.some((n) => n === `db-${today}.json`), "today's is among them");
      assert.equal(names.includes("db-2026-01-01.json"), false, "the oldest are gone");
    } finally {
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });
});

describe("a damaged database file", () => {
  test("is restored from the newest valid backup, and the damaged file is kept", () => {
    fs.rmSync(backups, { recursive: true, force: true });
    fs.mkdirSync(backups, { recursive: true });
    fs.writeFileSync(path.join(backups, "db-2026-02-01.json"), JSON.stringify({ users: [{ id: "old" }] }));
    fs.writeFileSync(path.join(backups, "db-2026-02-02.json"), JSON.stringify({ users: [{ id: "newer" }] }));
    fs.writeFileSync(path.join(backups, "db-2026-02-03.json"), "{ this one is damaged too"); // skipped
    fs.writeFileSync(dbPath, '{"users": [{"id": "half-written"'); // the live file

    const logged = console.error;
    console.error = () => {};
    let data;
    try {
      data = db.readDB();
    } finally {
      console.error = logged;
    }
    assert.deepEqual(data.users, [{ id: "newer" }], "newest valid backup");
    assert.deepEqual(JSON.parse(fs.readFileSync(dbPath, "utf8")).users, [{ id: "newer" }], "the live file is whole again");
    const copies = unreadableCopies();
    assert.equal(copies.length, 1, "the damaged file is kept for repair");
    assert.equal(fs.readFileSync(path.join(dir, copies[0]), "utf8"), '{"users": [{"id": "half-written"');
    // Later writes carry on from the restored data.
    db.updateDB((d) => d.users.push({ id: "after" }));
    assert.deepEqual(db.readDB().users.map((u) => u.id), ["newer", "after"]);
  });

  test("with no usable backup it stops instead of starting empty, and still keeps a copy", () => {
    fs.rmSync(backups, { recursive: true, force: true });
    for (const f of unreadableCopies()) fs.rmSync(path.join(dir, f));
    fs.writeFileSync(dbPath, "not json at all");
    assert.throws(() => db.readDB(), (e) => e.code === "DB_UNREADABLE");
    assert.throws(() => db.updateDB((d) => d.users.push({ id: "x" })), (e) => e.code === "DB_UNREADABLE");
    assert.equal(fs.readFileSync(dbPath, "utf8"), "not json at all", "the damaged file is not overwritten");
    assert.equal(unreadableCopies().length, 1);
  });

  test("a file that is valid JSON but not a database object is treated the same way", () => {
    fs.writeFileSync(path.join(dir, "reset"), "");
    fs.mkdirSync(backups, { recursive: true });
    fs.writeFileSync(path.join(backups, "db-2026-03-01.json"), JSON.stringify({ users: [{ id: "kept" }] }));
    fs.writeFileSync(dbPath, "[1, 2, 3]");
    const logged = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(db.readDB().users, [{ id: "kept" }]);
    } finally {
      console.error = logged;
    }
  });
});
