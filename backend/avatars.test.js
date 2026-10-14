import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// Profile pictures: choosing one, what is stored, and where it shows (the student's own record,
// the league table, the teacher's lists and the recap share image).
const dbPath = path.join(os.tmpdir(), `northstar-avatars-test-db-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let adminToken;
let dbModule;

before(async () => {
  dbModule = await import("./db.js");
  dbModule.updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Test", lastName: "Admin", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

async function api(url, { method = "GET", body, token } = {}) {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}
async function newStudent(firstName) {
  const res = await api("/api/student/register", { method: "POST", body: { firstName, lastName: "Tester", email: `${firstName.toLowerCase()}-${Date.now()}@test.local`, password: "password1" } });
  return { token: res.data.token, id: res.data.user.id, user: res.data.user };
}

describe("choosing a profile picture", () => {
  test("a new student has none, can choose one, and it comes back on sign-in data", async () => {
    const s = await newStudent("Ava");
    assert.equal(s.user.avatar, null);
    // (What a picture wears from the Comet Shop has to be bought first: shop.test.js.)
    const saved = await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar: { id: "12", accessory: null, frame: "gold" } } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.avatar, { id: "12", accessory: null, frame: "gold" });
    assert.deepEqual((await api("/api/student/me", { token: s.token })).data.avatar, { id: "12", accessory: null, frame: "gold" });
    assert.deepEqual(dbModule.readDB().users.find((u) => u.id === s.id).avatar, { id: "12", accessory: null, frame: "gold" });
  });

  test("unknown accessories and frames are dropped; an unknown picture is refused; null goes back to initials", async () => {
    const s = await newStudent("Ben");
    const tidy = await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar: { id: "03", accessory: "<script>", frame: "url(javascript:1)", extra: "x".repeat(5000) } } });
    assert.deepEqual(tidy.data.avatar, { id: "03", accessory: null, frame: "none" });
    for (const avatar of [{ id: "31" }, { id: "00" }, { id: 3 }, { id: "../../etc/passwd" }, "12", ["12"], {}, 7]) {
      assert.equal((await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar } })).status, 400, JSON.stringify(avatar));
    }
    assert.deepEqual((await api("/api/student/me", { token: s.token })).data.avatar, { id: "03", accessory: null, frame: "none" }, "a refused change leaves the old picture");
    const cleared = await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar: null } });
    assert.equal(cleared.data.avatar, null);
    assert.equal("avatar" in dbModule.readDB().users.find((u) => u.id === s.id), false);
    assert.equal((await api("/api/student/avatar", { method: "PUT", body: { avatar: { id: "01" } } })).status, 401);
  });

  test("a stored value that is no longer valid is shown as no picture", async () => {
    const { publicAvatar, cleanAvatar, AVATAR_IDS } = await import("./avatars.js");
    assert.equal(AVATAR_IDS.length, 30);
    assert.equal(publicAvatar({ avatar: { id: "99" } }), null);
    assert.equal(publicAvatar({}), null);
    assert.deepEqual(cleanAvatar({ id: "30", accessory: "bow", frame: "aurora" }), { id: "30", accessory: "bow", frame: "aurora" });
  });
});

describe("where the picture shows", () => {
  test("in the league table, the teacher's lists and the recap image", async () => {
    const { getProgress } = await import("./gamification.js");
    const s = await newStudent("Cleo");
    dbModule.updateDB((db) => getProgress(db, s.id).wallet.owned.push("acc:shades"));
    await api("/api/student/avatar", { method: "PUT", token: s.token, body: { avatar: { id: "07", accessory: "shades", frame: "mint" } } });
    dbModule.updateDB((db) => {
      const p = getProgress(db, s.id);
      p.xp = 40;
      p.recaps = [{ month: "2026-09", label: "September 2026", solved: 3, answers: 4, accuracy: 0.75, accuracyChange: null, bestStreak: 2, activeDays: 2, stars: 1, improved: null, hardest: null }];
      p.recapThrough = "2099-12";
    });

    const league = await api("/api/leagues/me", { token: s.token });
    const me = league.data.group.rows.find((r) => r.you);
    assert.deepEqual(me.avatar, { id: "07", accessory: "shades", frame: "mint" });

    const list = await api("/api/admin/students", { token: adminToken });
    assert.deepEqual(list.data.students.find((u) => u.id === s.id).avatar, { id: "07", accessory: "shades", frame: "mint" });
    const adminLeague = await api("/api/admin/leagues", { token: adminToken });
    assert.match(JSON.stringify(adminLeague.data), /"avatar":\{"id":"07"/);

    const image = await api("/api/recaps/2026-09/image.svg", { token: s.token });
    assert.equal(image.status, 200);
    assert.match(image.data, /<image href="data:image\/webp;base64,/);
    assert.match(image.data, /Cleo/);

    // Without a picture the image is as before.
    const plain = await newStudent("Dan");
    dbModule.updateDB((db) => {
      const p = getProgress(db, plain.id);
      p.recaps = [{ month: "2026-09", label: "September 2026", solved: 1, answers: 1, accuracy: 1, accuracyChange: null, bestStreak: 1, activeDays: 1, stars: 0, improved: null, hardest: null }];
      p.recapThrough = "2099-12";
    });
    const noPic = await api("/api/recaps/2026-09/image.svg", { token: plain.token });
    assert.equal(noPic.status, 200);
    assert.doesNotMatch(noPic.data, /<image /);
  });

  test("the recap image only embeds a data: picture (nothing a student could point elsewhere)", async () => {
    const { recapSvg } = await import("./recap.js");
    const recap = { month: "2026-09", label: "September 2026", solved: 1, answers: 1, accuracy: 1, accuracyChange: null, bestStreak: 1, activeDays: 1, stars: 0, improved: null, hardest: null };
    assert.doesNotMatch(recapSvg(recap, "Eve", "https://evil.example/x.png"), /<image /);
    assert.doesNotMatch(recapSvg(recap, "Eve", 'data:text/html,"><script>'), /<image /);
    assert.match(recapSvg(recap, "Eve", "data:image/webp;base64,AAAA"), /<image href="data:image\/webp;base64,AAAA"/);
  });

  test("every picture file the lists name exists, for the pages and for the server", async () => {
    const { AVATAR_IDS, avatarDataUri } = await import("./avatars.js");
    for (const id of AVATAR_IDS) {
      assert.ok(avatarDataUri(id)?.startsWith("data:image/webp;base64,"), `backend/assets/avatars/${id}.webp`);
      assert.ok(fs.existsSync(new URL(`../frontend/public/avatars/${id}.webp`, import.meta.url)), `frontend/public/avatars/${id}.webp`);
    }
    assert.equal(avatarDataUri("31"), null);
  });
});
