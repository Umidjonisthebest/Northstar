import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import bcrypt from "bcryptjs";

// Classes, which teachers make and students join with a code: which there are and who is in which (classrooms.js), what a class
// sees of itself (classStats.js), homework (homework.js) and the chats (classChat.js). First the
// rules on their own, then students and the studio over HTTP against a throwaway database.
const dbPath = path.join(os.tmpdir(), `northstar-classroom-test-${Date.now()}.json`);
process.env.DB_PATH = dbPath;
process.env.JWT_SECRET = "test-secret-not-for-real-use";

let server;
let base;
let readDB;
let updateDB;
let C; // classrooms.js
let S; // classStats.js
let H; // homework.js
let Chat; // classChat.js
let G; // gamification.js
let removeUser; // ielts/lib/users.js
let adminToken;
// The classes, made in the studio before the tests: K.a "7A" (ana, ben, cem), K.b "8B" (dil), K.c
// "9C", K.d "10D", K.e "11E", and two nobody starts in: K.empty "5 Empty" and K.spare "6 Spare".
// Each student joined with the class code. Said they have no class: eli. Hasn't answered: fay.
// The demo account: demo.
const K = {};
let ana;
let ben;
let cem;
let dil;
let eli;
let fay;
let demo;

async function api(p, { method = "GET", body, auth } = {}) {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const as = (who) => (p, opts = {}) => api(p, { ...opts, auth: who.token });
const admin = (p, opts = {}) => api(p, { ...opts, auth: adminToken });
const register = async (firstName, lastName, extra = {}) => {
  const r = await api("/api/student/register", { method: "POST", body: { firstName, lastName, email: `${firstName.toLowerCase()}-class@test.local`, password: "password1", ...extra } });
  return { status: r.status, token: r.data?.token, id: r.data?.user?.id, user: r.data?.user, error: r.data?.error };
};
const makeClass = (name) => admin("/api/admin/classes", { method: "POST", body: { name } });
const codeOf = (key) => C.classById(readDB(), K[key].id).code;
const membership = (who, body) => as(who)("/api/class/membership", { method: "PUT", body });
// A new account that then joins a class with its code.
const enrol = async (firstName, lastName, key) => {
  const who = await register(firstName, lastName);
  who.joined = await membership(who, { code: codeOf(key) });
  return who;
};
const mcq = () => readDB().practiceQuestions.filter((q) => (q.type || "mcq") === "mcq" && typeof q.correctIndex === "number");
const answer = (who, q, right = true, extra = {}) =>
  as(who)(`/api/practice/questions/${q.id}/answer`, { method: "POST", body: { answer: right ? q.correctIndex : (q.correctIndex + 1) % q.options.length, timeMs: 30000, ...extra } });
const say = (who, room, body, extra = {}) => as(who)(`/api/class/chat/${room}`, { method: "POST", body: { body, ...extra } });
const tomorrow = () => G.dayOffset(G.todayKey(), 1);

before(async () => {
  ({ readDB, updateDB } = await import("./db.js"));
  C = await import("./classrooms.js");
  S = await import("./classStats.js");
  H = await import("./homework.js");
  Chat = await import("./classChat.js");
  G = await import("./gamification.js");
  ({ removeUser } = await import("./ielts/lib/users.js"));
  updateDB((db) => {
    db.users.push({ id: "admin-1", role: "admin", firstName: "Tea", lastName: "Cher", email: "admin@test.local", passwordHash: bcrypt.hashSync("adminpass123", 10), createdAt: new Date().toISOString() });
  });
  const { default: app } = await import("./app.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await api("/api/auth/admin/login", { method: "POST", body: { email: "admin@test.local", password: "adminpass123" } })).data.token;
  for (const [key, name] of Object.entries({ a: "7A", b: "8B", c: "9C", d: "10D", e: "11E", empty: "5 Empty", spare: "6 Spare" })) K[key] = (await makeClass(name)).data;
  ana = await enrol("Ana", "Alimova", "a");
  ben = await enrol("Ben", "Bakirov", "a");
  cem = await enrol("Cem", "Cho", "a");
  dil = await enrol("Dil", "Davron", "b");
  eli = await register("Eli", "Ergashev");
  await membership(eli, { leave: true });
  fay = await register("Fay", "Fozilova");
  demo = await register("Demo", "Visitor");
  updateDB((db) => (db.users.find((u) => u.id === demo.id).demo = true));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(dbPath, { force: true });
});

describe("who is in which class (rules)", () => {
  const student = (extra = {}) => ({ id: "s1", role: "student", firstName: "Sam", lastName: "Lee", email: "sam@x.y", ...extra });

  // A database with nothing in it but what the class rules read and write.
  const emptyDb = () => ({ users: [], classes: [], classMessages: [], classReports: [], classReads: [], classQuests: [], homework: [], announcements: [] });
  const withClasses = (...names) => {
    const db = emptyDb();
    return { db, made: names.map((name) => C.createClass(db, name, "teacher-1")) };
  };

  test("there are no classes until a teacher makes one, and it has the name they gave it", () => {
    const db = emptyDb();
    assert.deepEqual(C.allClasses(db), []);
    assert.equal(C.classOf(db, student({ classId: "g7" })), null, "the old grade classes are nobody's class");
    const { name } = C.cleanClassName(db, "  7A   Math  ");
    assert.equal(name, "7A Math");
    const cls = C.createClass(db, name, "teacher-1");
    assert.deepEqual(Object.keys(cls).sort(), ["by", "code", "createdAt", "id", "name"]);
    assert.equal(cls.by, "teacher-1");
    assert.deepEqual(C.classOf(db, student({ classId: cls.id })), { id: cls.id, name: "7A Math", mark: "7A" });
    for (const u of [student(), student({ classId: "" }), student({ classId: 7 }), student({ classId: "no-such-class" }), student({ noClass: true }), null, undefined]) assert.equal(C.classOf(db, u), null, JSON.stringify(u));
    assert.equal(C.classOf(db, { ...student({ classId: cls.id }), role: "admin" }), null);
  });

  test("a class needs a name, and no two classes share one", () => {
    const { db, made } = withClasses("7A");
    for (const junk of [undefined, null, "", "   ", 7, {}, ["7A"]]) assert.match(C.cleanClassName(db, junk).error, /name/, JSON.stringify(junk));
    assert.match(C.cleanClassName(db, " 7a ").error, /already a class called 7a/);
    assert.deepEqual(C.cleanClassName(db, "7a", made[0].id), { name: "7a" }, "renaming a class to its own name is fine");
    assert.equal(C.cleanClassName(db, "x".repeat(90)).name.length, C.CLASS.nameMax);
  });

  test("a class is shown by a short mark made from its name", () => {
    for (const [name, mark] of [["7A Math", "7A"], ["10B", "10B"], ["Grade 7", "G7"], ["Olympiad team", "OT"], ["Chemistry", "CH"], ["x", "X"], ["", "?"]]) assert.equal(C.classMark(name), mark, name);
  });

  test("classes are listed by name, numbers in their own order", () => {
    const { db } = withClasses("10B", "7A", "Olympiad", "9C");
    assert.deepEqual(C.allClasses(db).map((c) => c.name), ["7A", "9C", "10B", "Olympiad"]);
    assert.deepEqual(C.cleanClassIds(db, "all"), C.allClasses(db).map((c) => c.id));
    const [ten, seven] = db.classes;
    assert.deepEqual(C.cleanClassIds(db, [ten.id, "nope", seven.id, seven.id, 7]), [seven.id, ten.id]);
    for (const junk of [undefined, null, [], "7A", 7, {}]) assert.deepEqual(C.cleanClassIds(db, junk), [], JSON.stringify(junk));
  });

  test("the demo account is never in a class, whatever its record says", () => {
    const { db, made } = withClasses("7A");
    assert.equal(C.classOf(db, student({ classId: made[0].id, demo: true })), null);
    assert.equal(C.classOf(db, student({ classId: made[0].id, email: "student@example.com" })), null);
    assert.equal(C.schoolAsked(db, student({ demo: true })), true, "it is never offered the question either");
    assert.equal(C.schoolAsked(db, student()), false);
    assert.equal(C.schoolAsked(db, student({ noClass: true })), true);
    assert.equal(C.schoolAsked(db, student({ classId: made[0].id })), true);
    assert.equal(C.schoolAsked(db, student({ classId: "no-such-class" })), false, "a class that has gone leaves the question open");
  });

  test("what the studio sends to move a student is checked", () => {
    const { db, made } = withClasses("7A");
    assert.deepEqual(C.cleanClassChoice(db, {}), { asked: false });
    assert.deepEqual(C.cleanClassChoice(db, { classId: null }), { asked: true, classId: null });
    assert.deepEqual(C.cleanClassChoice(db, { classId: "" }), { asked: true, classId: null });
    assert.deepEqual(C.cleanClassChoice(db, { classId: made[0].id }), { asked: true, classId: made[0].id });
    for (const classId of ["nope", "7A", 7, {}, [made[0].id], true]) assert.ok(C.cleanClassChoice(db, { classId }).error, JSON.stringify(classId));
    // Staff put a student in a class, or out of every class, without the code or the wait.
    const u = student({ noClass: true });
    C.placeStudent(u, made[0].id);
    assert.deepEqual([u.classId, u.noClass], [made[0].id, undefined]);
    C.placeStudent(u, null);
    assert.deepEqual([u.classId, u.noClass], [undefined, true]);
  });

  test("every class has its own code, and a new one replaces the old", () => {
    const { db, made } = withClasses("7A", "8B", "9C");
    const codes = made.map((c) => c.code);
    assert.equal(new Set(codes).size, 3);
    for (const code of codes) assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/, "six characters, none of I L O 0 1");
    const fresh = C.renewClassCode(db, made[0].id);
    assert.notEqual(fresh, codes[0]);
    assert.equal(C.classById(db, made[0].id).code, fresh);
    assert.ok(C.classById(db, made[0].id).codeAt);
    assert.equal(C.classById(db, made[1].id).code, codes[1], "the other classes keep theirs");
    assert.equal(C.renewClassCode(db, "nope"), null);
  });

  test("deleting a class takes its students out and its own things with it", () => {
    const { db, made } = withClasses("7A", "8B");
    const [seven, eight] = made;
    const a = student({ id: "a", classId: seven.id, classSetAt: "2026-10-01T00:00:00.000Z" });
    const b = student({ id: "b", classId: eight.id });
    db.users = [a, b];
    db.classMessages = [
      { id: "m1", room: C.classRoom(seven.id), from: "a" },
      { id: "m2", room: C.classRoom(eight.id), from: "b" },
      { id: "m3", room: "dm:a:b", from: "a" }
    ];
    db.classReports = [{ id: "r1", messageId: "m1" }, { id: "r2", messageId: "m2" }];
    db.classReads = [{ userId: "a", room: C.classRoom(seven.id) }, { userId: "b", room: C.classRoom(eight.id) }];
    db.classQuests = [{ classId: seven.id, week: "w" }, { classId: eight.id, week: "w" }];
    db.homework = [{ id: "h1", classIds: [seven.id] }, { id: "h2", classIds: [seven.id, eight.id] }, { id: "h3", classIds: [eight.id] }];
    db.announcements = [{ id: "n1" }, { id: "n2", classIds: [seven.id] }, { id: "n3", classIds: [eight.id, seven.id] }];
    assert.equal(C.deleteClass(db, "nope"), null);
    assert.equal(C.deleteClass(db, seven.id).name, "7A");
    assert.deepEqual(db.classes.map((c) => c.name), ["8B"]);
    assert.deepEqual([a.classId, a.classSetAt, a.noClass], [undefined, undefined, undefined], "in no class, free to join another, and asked again");
    assert.equal(b.classId, eight.id);
    assert.deepEqual(db.classMessages.map((m) => m.id), ["m2", "m3"], "private chats stay");
    assert.deepEqual(db.classReports.map((r) => r.id), ["r2"]);
    assert.deepEqual(db.classReads.map((r) => r.userId), ["b"]);
    assert.deepEqual(db.classQuests.map((q) => q.classId), [eight.id]);
    assert.deepEqual(db.homework.map((h) => [h.id, h.classIds]), [["h2", [eight.id]], ["h3", [eight.id]]], "homework for several classes stays for the others");
    assert.deepEqual(db.announcements.map((n) => [n.id, n.classIds]), [["n1", undefined], ["n3", [eight.id]]]);
  });

  test("the fixed grade classes are taken out of an older database, once", () => {
    const db = emptyDb();
    db.classCodes = [{ classId: "g7", code: "ABCDEF" }];
    db.users = [
      student({ id: "a", school: "presidential", grade: 7, classSetAt: "2026-10-01T00:00:00.000Z" }),
      student({ id: "b", school: "other" }),
      student({ id: "c" })
    ];
    db.classMessages = [{ id: "m1", room: "class:g7", from: "a" }, { id: "m2", room: "dm:a:b", from: "a" }];
    db.classReports = [{ id: "r1", messageId: "m1" }, { id: "r2", messageId: "m2" }];
    db.classReads = [{ userId: "a", room: "class:g7" }, { userId: "a", room: "dm:a:b" }];
    db.classQuests = [{ classId: "g7", week: "w" }];
    db.homework = [{ id: "h1", grades: [7] }];
    db.announcements = [{ id: "n1" }, { id: "n2", grades: [7] }, { id: "n3", grades: [] }];
    const note = C.retireGradeClasses(db);
    assert.match(note, /1 student\(s\) taken out, 1 class chat message\(s\), 1 homework and 1 class announcement\(s\)/);
    assert.deepEqual(db.users.map((u) => [u.id, u.school, u.grade, u.classSetAt, u.noClass]), [["a", undefined, undefined, undefined, undefined], ["b", undefined, undefined, undefined, true], ["c", undefined, undefined, undefined, undefined]]);
    assert.equal("classCodes" in db, false);
    assert.deepEqual(db.classMessages.map((m) => m.id), ["m2"]);
    assert.deepEqual(db.classReports.map((r) => r.id), ["r2"]);
    assert.deepEqual(db.classReads.map((r) => r.room), ["dm:a:b"]);
    assert.deepEqual([db.classQuests, db.homework], [[], []]);
    assert.deepEqual(db.announcements, [{ id: "n1" }, { id: "n3" }], "one for every class stays");
    assert.equal(C.retireGradeClasses(db), null, "nothing left to do");
    // A database that only ever had teacher-made classes is left alone.
    const { db: fresh, made } = withClasses("7A");
    fresh.users = [student({ classId: made[0].id })];
    fresh.homework = [{ id: "h", classIds: [made[0].id] }];
    assert.equal(C.retireGradeClasses(fresh), null);
    assert.equal(fresh.users[0].classId, made[0].id);
  });

  test("a typed code is read without its case, spaces and dashes", () => {
    assert.equal(C.cleanCode("k7q-m4x"), "K7QM4X");
    assert.equal(C.cleanCode("  K7Q M4X "), "K7QM4X");
    for (const junk of ["", "K7QM4", "K7QM4XX", 123456, null, undefined, {}, ["K7QM4X"], "K".repeat(41)]) assert.equal(C.cleanCode(junk), "", JSON.stringify(junk));
  });

  test("a student gets into a class with its code, and no other way", () => {
    const now = Date.parse("2026-10-01T10:00:00Z");
    const { db, made } = withClasses("7A");
    const [seven] = made;
    const u = student();
    assert.equal(C.joinWithCode(db, u, "", now).code, 400);
    assert.equal(C.joinWithCode(db, u, "7A", now).code, 400, "the class's name isn't its code");
    assert.equal(u.codeTries, undefined, "something that can't be a code isn't a wrong guess");
    assert.equal(C.joinWithCode(db, u, "ZZZZZZ", now).code, 400);
    assert.equal(u.codeTries.count, 1);
    assert.equal(C.classOf(db, u), null);
    assert.deepEqual(C.joinWithCode(db, u, seven.code.toLowerCase(), now), { changed: true });
    assert.equal(C.classOf(db, u).name, "7A");
    assert.equal(u.codeTries, undefined, "the right code clears the count");
    // The code a teacher replaced no longer opens the class; the student who used it stays.
    const old = seven.code;
    C.renewClassCode(db, seven.id);
    assert.equal(C.joinWithCode(db, student({ id: "s2" }), old, now).code, 400);
    assert.equal(C.classOf(db, u).name, "7A");
    assert.equal(C.joinWithCode(db, student({ demo: true }), seven.code, now).code, 403);
    // With no classes at all, no code works.
    assert.equal(C.joinWithCode(emptyDb(), student(), seven.code, now).code, 400);
  });

  test("wrong codes run out, and come back after the wait", () => {
    const now = Date.parse("2026-10-01T10:00:00Z");
    const minute = 60000;
    const { db, made } = withClasses("7A");
    const u = student();
    for (let i = 0; i < C.CODE_TRIES.max; i++) assert.equal(C.joinWithCode(db, u, "ZZZZZZ", now + i * 1000).code, 400);
    const stopped = C.joinWithCode(db, u, made[0].code, now + minute);
    assert.equal(stopped.code, 429, "even the right code waits");
    assert.match(stopped.error, /29 minutes/);
    assert.equal(C.classOf(db, u), null);
    assert.deepEqual(C.joinWithCode(db, u, made[0].code, now + (C.CODE_TRIES.minutes + 1) * minute), { changed: true });
  });

  test("the first move is free; then one move in 30 days", () => {
    const now = Date.parse("2026-10-01T10:00:00Z");
    const day = 86400000;
    const u = student();
    assert.deepEqual(C.chooseClass(u, "c7", now), { changed: true });
    assert.equal(u.classSetAt, undefined, "joining doesn't start the wait");
    assert.deepEqual(C.chooseClass(u, "c7", now), { changed: false });
    // A student who typed another class's code can be put right straight away.
    assert.deepEqual(C.chooseClass(u, "c8", now + 1000), { changed: true });
    assert.equal(u.classId, "c8");
    // But not again, neither to another class nor out of this one.
    assert.equal(C.chooseClass(u, "c9", now + day).code, 409);
    assert.equal(C.chooseClass(u, null, now + 29 * day).code, 409);
    assert.equal(u.classId, "c8");
    assert.ok(C.classChangeOpensAt(u, now + day) > now);
    assert.deepEqual(C.chooseClass(u, null, now + 31 * day), { changed: true });
    assert.deepEqual([u.classId, u.noClass], [undefined, true]);
    // Out of a class, joining is open again, and that class then holds for the rest of the wait.
    assert.deepEqual(C.chooseClass(u, "c5", now + 32 * day), { changed: true });
    assert.equal(u.noClass, undefined);
    assert.equal(C.chooseClass(u, "c6", now + 33 * day).code, 409);
  });

  test("'I don't have a class' is recorded, and the demo account can't choose", () => {
    const u = student();
    assert.deepEqual(C.chooseClass(u, null), { changed: true });
    assert.equal(u.noClass, true);
    assert.deepEqual(C.chooseClass(u, null), { changed: false });
    assert.equal(C.chooseClass(student({ demo: true }), "c7").code, 403);
  });

  test("classmates are shown by first name and last initial", () => {
    assert.equal(C.classmateName({ firstName: "Aziza", lastName: "karimova" }), "Aziza K.");
    assert.equal(C.classmateName({ firstName: "Aziza", lastName: "" }), "Aziza");
    assert.equal(C.classmateName({}), "Student");
  });
});

describe("homework (rules)", () => {
  const hw = { id: "h", classIds: ["c7"], questionIds: ["a", "b", "c"], due: "2026-10-10", createdAt: "2026-10-05T08:00:00.000Z" };
  const log = (...entries) => ({ answerLog: entries.map(([q, at, ok, a]) => ({ q, at, ok, ...(a ? { a: true } : {}) })) });

  test("only answers given after the homework was set count, and the first one decides", () => {
    const p = log(["a", "2026-10-01T10:00:00.000Z", true], ["a", "2026-10-06T10:00:00.000Z", false], ["a", "2026-10-06T10:01:00.000Z", true], ["b", "2026-10-06T10:02:00.000Z", true], ["x", "2026-10-06T10:03:00.000Z", true]);
    assert.deepEqual(H.homeworkProgress(hw, p), { total: 3, done: 2, correct: 1, next: "c", finishedAt: null, late: false });
  });

  test("an answer after opening the explanation, or a second try, is done but not right", () => {
    const p = log(["a", "2026-10-06T10:00:00.000Z", true, true], ["b", "2026-10-06T10:01:00.000Z", true], ["c", "2026-10-06T10:02:00.000Z", true]);
    const r = H.homeworkProgress(hw, p);
    assert.equal(r.done, 3);
    assert.equal(r.correct, 2);
    assert.equal(r.finishedAt, "2026-10-06T10:02:00.000Z");
    assert.equal(r.late, false);
  });

  test("finishing after the due day is late, by the app's own calendar", () => {
    const late = log(["a", "2026-10-06T10:00:00.000Z", true], ["b", "2026-10-06T10:01:00.000Z", true], ["c", "2026-10-11T10:02:00.000Z", false]);
    assert.equal(H.homeworkProgress(hw, late).late, true);
    // 19:30 UTC on the 10th is already the 11th in Tashkent.
    const edge = log(["a", "2026-10-06T10:00:00.000Z", true], ["b", "2026-10-06T10:01:00.000Z", true], ["c", "2026-10-10T19:30:00.000Z", true]);
    assert.equal(H.homeworkProgress(hw, edge).late, true);
    const inTime = log(["a", "2026-10-06T10:00:00.000Z", true], ["b", "2026-10-06T10:01:00.000Z", true], ["c", "2026-10-10T18:30:00.000Z", true]);
    assert.equal(H.homeworkProgress(hw, inTime).late, false);
  });

  test("a question deleted from the bank is no longer part of the homework", () => {
    const p = log(["a", "2026-10-06T10:00:00.000Z", true], ["b", "2026-10-06T10:01:00.000Z", true]);
    const r = H.homeworkProgress(hw, p, new Set(["a", "b"]));
    assert.equal(r.total, 2);
    assert.equal(r.finishedAt, "2026-10-06T10:01:00.000Z");
    assert.deepEqual(H.homeworkProgress(hw, undefined), { total: 3, done: 0, correct: 0, next: "a", finishedAt: null, late: false });
    assert.equal(r.next, null, "nothing left to do");
  });

  test("questions are drawn across the skills asked for, without the ones already chosen", () => {
    const db = readDB();
    const skills = ["Linear functions", "Circles"].filter((s) => db.practiceQuestions.some((q) => q.topic === s));
    assert.equal(skills.length, 2, "the bank has both skills");
    const { spec } = H.cleanDraw({ section: "Math", skills, count: 6 });
    const first = H.drawQuestions(db, spec);
    assert.equal(first.questions.length, 6);
    assert.ok(first.questions.every((q) => q.section === "Math" && skills.includes(q.topic)));
    assert.equal(first.questions.filter((q) => q.topic === skills[0]).length, 3, "three of each");
    const again = H.drawQuestions(db, { ...spec, exclude: new Set(first.questions.map((q) => q.id)) });
    assert.ok(again.questions.every((q) => !first.questions.some((x) => x.id === q.id)));
    assert.equal(again.available, first.available - 6);
  });

  test("a draw needs a sensible count, and unknown skills or levels are dropped", () => {
    for (const count of [0, -1, 41, 2.5, "6", null, undefined]) assert.ok(H.cleanDraw({ count }).error, JSON.stringify(count));
    const { spec } = H.cleanDraw({ section: "Math", skills: ["Circles", "Transitions", "nonsense", 4], difficulty: ["Hard", "Impossible"], count: 5 });
    assert.deepEqual(spec.skills, ["Circles"], "Transitions is a Reading & Writing skill");
    assert.deepEqual(spec.difficulty, ["Hard"]);
  });
});

describe("signing up", () => {
  test("a new account is in no class, and hasn't answered the class question", async () => {
    for (const who of [ana, cem, eli, fay]) {
      assert.equal(who.user.classroom, null);
      assert.equal(who.user.schoolAsked, false, "the hub asks for the class code later");
    }
  });

  test("a class named in the sign-up form puts nobody in it", async () => {
    for (const [i, extra] of [{ classId: K.a.id }, { classId: K.a.id, code: codeOf("a") }, { presidential: true, grade: 7 }, { className: "7A" }, { noClass: true }].entries()) {
      const r = await register(`Gia${i}`, "Guess", extra);
      assert.equal(r.status, 201, JSON.stringify(extra));
      assert.equal(r.user.classroom, null);
      assert.equal(r.user.schoolAsked, false);
      const stored = readDB().users.find((u) => u.id === r.id);
      for (const field of ["classId", "noClass", "school", "grade"]) assert.equal(stored[field], undefined, field);
      assert.equal((await as(r)("/api/class/chat/class")).status, 403);
      updateDB((db) => removeUser(db, r.id));
    }
  });

  test("the class code is what puts a student in a class", async () => {
    assert.equal(ana.joined.status, 200);
    assert.deepEqual(ana.joined.data.classroom, { id: K.a.id, name: "7A", mark: "7A" });
    assert.equal(ana.joined.data.schoolAsked, true);
    assert.equal(ana.joined.data.canChangeAt, null);
    assert.equal((await as(dil)("/api/student/me")).data.classroom.name, "8B");
    const said = (await as(eli)("/api/student/me")).data;
    assert.equal(said.classroom, null);
    assert.equal(said.schoolAsked, true, "Eli said they have no class");
  });
});

describe("the class page", () => {
  test("a student outside a class gets the question, and nothing of any class", async () => {
    for (const who of [eli, fay]) {
      const r = await as(who)("/api/class");
      assert.equal(r.status, 200);
      assert.equal(r.data.member, false);
      assert.equal(r.data.codeLength, 6);
      for (const name of ["7A", "8B", K.a.id]) assert.equal(JSON.stringify(r.data).includes(name), false, "no list of classes to choose from");
      assert.equal(JSON.stringify(r.data).includes(codeOf("a")), false, "and no code");
      assert.equal(r.data.students, undefined);
      for (const p of ["/api/class/classmates", `/api/class/classmates/${ana.id}`, "/api/class/homework", "/api/class/chat", "/api/class/chat/class"]) {
        const refused = await as(who)(p);
        assert.equal(refused.status, 403, p);
        assert.equal(refused.data.code, "NOT_IN_CLASS");
      }
      assert.equal((await say(who, "class", "hello")).status, 403);
      assert.equal((await as(who)(`/api/class/classmates/${ana.id}/cheer`, { method: "POST" })).status, 403);
    }
    assert.equal((await api("/api/class")).status, 401);
    assert.equal((await admin("/api/class")).status, 403, "the studio's sign-in isn't a student's");
  });

  test("the demo account can't join a class", async () => {
    const r = await as(demo)("/api/class");
    assert.equal(r.data.member, false);
    assert.equal(r.data.demo, true);
    assert.equal(r.data.schoolAsked, true);
    const join = await membership(demo, { code: codeOf("a") });
    assert.equal(join.status, 403);
    assert.equal((await as(demo)("/api/class/chat/class")).status, 403);
    // Even with a class written on its record by hand, it stays outside.
    updateDB((db) => (db.users.find((u) => u.id === demo.id).classId = K.a.id));
    assert.equal((await as(demo)("/api/class/chat/class")).status, 403);
    assert.equal((await as(ana)("/api/class/classmates")).data.classmates.some((c) => c.id === demo.id), false);
    updateDB((db) => delete db.users.find((x) => x.id === demo.id).classId);
  });

  test("a student joins with the class code only, and can put a wrong class right once", async () => {
    const put = (body) => membership(fay, body);
    // Saying which class you are in gets nobody in: not its name, not its id, not the old grades.
    for (const body of [{}, { classId: K.c.id }, { name: "9C" }, { presidential: true, grade: 9 }, { code: 9 }, { code: "" }, { code: "9C" }, { code: K.c.id.slice(0, 3) }, { leave: "yes" }, { leave: true, code: 9 }]) {
      assert.equal((await put(body)).status, 400, JSON.stringify(body));
    }
    const wrong = await put({ code: "ZZZZZZ" });
    assert.equal(wrong.status, 400);
    assert.match(wrong.data.error, /isn't right/);
    assert.equal((await as(fay)("/api/class")).data.member, false);
    const joined = await put({ code: ` ${codeOf("c").toLowerCase().replace(/^(...)/, "$1-")} ` });
    assert.equal(joined.status, 200);
    assert.equal(joined.data.classroom.name, "9C");
    assert.equal(joined.data.canChangeAt, null);
    assert.equal(readDB().users.find((u) => u.id === fay.id).codeTries, undefined);
    const fixed = await put({ code: codeOf("d") });
    assert.equal(fixed.data.classroom.name, "10D");
    assert.ok(Date.parse(fixed.data.canChangeAt) > Date.now() + 29 * 86400000);
    const again = await put({ code: codeOf("e") });
    assert.equal(again.status, 409);
    assert.match(again.data.error, /ask your teacher/);
    assert.equal((await put({ leave: true })).status, 409);
    assert.equal((await as(fay)("/api/class")).data.classroom.name, "10D");
    assert.equal((await as(fay)("/api/practice/progress")).data.classroom.name, "10D");
  });

  test("classmates are the students of the same class, by first name and initial", async () => {
    const r = await as(ana)("/api/class/classmates");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.classroom, { id: K.a.id, name: "7A", mark: "7A" });
    assert.deepEqual(r.data.classmates.map((c) => c.name).sort(), ["Ana A.", "Ben B.", "Cem C."]);
    assert.equal(r.data.classmates.find((c) => c.id === ana.id).you, true);
    const text = JSON.stringify(r.data);
    for (const hidden of ["@test.local", "Alimova", "Bakirov", "candidateId", "passwordHash"]) assert.equal(text.includes(hidden), false, hidden);
    assert.deepEqual((await as(dil)("/api/class/classmates")).data.classmates.map((c) => c.name), ["Dil D."]);
  });

  test("the class sees each other's study sessions, but not how many each got right", async () => {
    const [q1, q2, q3] = mcq();
    assert.equal((await answer(ana, q1, true)).status, 200);
    assert.equal((await answer(ana, q2, false)).status, 200);
    assert.equal((await answer(ben, q3, true)).status, 200);

    const page = (await as(ben)("/api/class")).data;
    assert.equal(page.member, true);
    assert.equal(page.students, 3);
    const hers = page.feed.find((s) => s.who.id === ana.id);
    assert.ok(hers, "Ana's session is in Ben's feed");
    assert.equal(hers.count, 2);
    assert.equal(hers.who.name, "Ana A.");
    assert.equal(hers.you, false);
    assert.ok(hers.minutes >= 1 && hers.title && hers.start && hers.end);
    assert.equal("correct" in hers, false, "right answers stay private");
    assert.equal(page.feed.find((s) => s.you).count, 1);

    // Ben's week next to the class's.
    assert.equal(page.compare.me.questions, 1);
    assert.equal(page.compare.best.questions, 2);
    assert.equal(page.compare.studied, 2);
    assert.equal(page.compare.students, 3);
    assert.equal(page.compare.accuracy.me, 1);
    assert.equal(page.compare.accuracy.class, null, "two students' average would give the other one away");
    assert.ok(page.compare.rank >= 1);

    // Another class sees none of it.
    const other = (await as(dil)("/api/class")).data;
    assert.equal(other.feed.length, 0);
    assert.equal(other.students, 1);
  });

  test("the class average accuracy appears once three students have answered", async () => {
    const q = mcq()[3];
    await answer(cem, q, false);
    const page = (await as(ben)("/api/class")).data;
    assert.equal(page.compare.studied, 3);
    // Ana 1 of 2, Ben 1 of 1, Cem 0 of 1.
    assert.equal(page.compare.accuracy.class, 0.5);
  });

  test("you next to one classmate: their week and sessions, without their score", async () => {
    const r = await as(ben)(`/api/class/classmates/${ana.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.them.name, "Ana A.");
    assert.equal(r.data.them.week.questions, 2);
    assert.equal(r.data.them.days.length, 7);
    assert.equal(r.data.them.sessions.length, 1);
    assert.equal("correct" in r.data.them.sessions[0], false);
    assert.equal(r.data.me.sessions[0].correct, 1, "your own sessions keep their score");
    assert.equal(JSON.stringify(r.data.them).includes("correct"), false);
    assert.equal((await as(ben)(`/api/class/classmates/${dil.id}`)).status, 404, "another class");
    assert.equal((await as(ben)(`/api/class/classmates/${eli.id}`)).status, 404, "no class");
    assert.equal((await as(ben)(`/api/class/classmates/${ben.id}`)).status, 404, "yourself");
    assert.equal((await as(ben)("/api/class/classmates/nobody")).status, 404);
  });

  test("a classmate can be cheered once a day, and only a classmate", async () => {
    const cheer = (who, id) => as(who)(`/api/class/classmates/${id}/cheer`, { method: "POST" });
    assert.equal((await cheer(ben, ana.id)).status, 201);
    assert.equal((await cheer(ben, ana.id)).status, 409);
    assert.equal((await cheer(cem, ana.id)).status, 201);
    assert.equal((await cheer(ben, dil.id)).status, 404);
    assert.equal((await cheer(ben, ben.id)).status, 400);
    assert.equal((await cheer(dil, ana.id)).status, 404);
    const page = (await as(ana)("/api/class")).data;
    assert.deepEqual(page.cheers.today.map((c) => c.name).sort(), ["Ben B.", "Cem C."]);
    assert.equal(page.cheers.week, 2);
    assert.equal((await as(ben)("/api/class/classmates")).data.classmates.find((c) => c.id === ana.id).cheered, true);
    assert.equal((await as(cem)(`/api/class/classmates/${ana.id}`)).data.them.cheered, true);
    assert.equal(readDB().cheers.length, 2);
  });
});

describe("the weekly class goal", () => {
  test("each class with students has a goal, and everyone's XP counts toward it", async () => {
    const page = (await as(ana)("/api/class")).data;
    const xp = (id) => readDB().progress.find((p) => p.userId === id)?.xp || 0;
    assert.equal(page.quest.target, 300, "a small class still gets a goal worth reaching");
    assert.equal(page.quest.total, xp(ana.id) + xp(ben.id) + xp(cem.id));
    assert.equal(page.quest.mine, xp(ana.id));
    assert.equal(page.quest.reached, false);
    assert.ok(page.quest.week.daysLeft >= 1 && page.quest.week.daysLeft <= 7);
    assert.deepEqual(page.quest.top.map((t) => t.xp), [...page.quest.top.map((t) => t.xp)].sort((a, b) => b - a));
    // The classes side by side: only the ones that have students.
    assert.deepEqual(page.cup.map((c) => c.name).sort(), ["10D", "7A", "8B"]);
    assert.equal(page.cup.find((c) => c.id === K.a.id).you, true);
    assert.equal(page.cup.filter((c) => c.you).length, 1);
    assert.deepEqual(page.cup.map((c) => c.rank), [1, 2, 3]);
    assert.equal(JSON.stringify(page.cup).includes(codeOf("b")), false, "another class's code is never shown");
    // Fixed for the week: one row per class, not one per look.
    await as(ana)("/api/class");
    assert.equal(readDB().classQuests.filter((q) => q.classId === K.a.id).length, 1);
  });

  test("the goal grows with the students who have been studying, and reaching it is recorded once", () => {
    const now = Date.parse("2026-11-04T08:00:00Z"); // a Wednesday
    const week = S.currentWeek(now);
    const db = structuredClone(readDB());
    db.classQuests = [];
    const g7 = C.classMembers(db, K.a.id);
    // Three students who studied last week: 3 x 150.
    for (const u of g7) G.getProgress(db, u.id).xpLog[G.dayOffset(week, -2)] = 40;
    const made = S.ensureQuest(db, K.a.id, now);
    assert.equal(made.changed, true);
    assert.equal(made.quest.target, 450);
    assert.equal(made.quest.students, 3);
    assert.equal(made.quest.reachedAt, null);
    assert.equal(S.ensureQuest(db, K.a.id, now).changed, false);
    // The class passes it.
    G.getProgress(db, g7[0].id).xpLog[week] = 300;
    G.getProgress(db, g7[1].id).xpLog[G.dayOffset(week, 1)] = 150;
    const reached = S.ensureQuest(db, K.a.id, now);
    assert.equal(reached.changed, true);
    assert.ok(reached.quest.reachedAt);
    assert.equal(S.ensureQuest(db, K.a.id, now).changed, false, "recorded once");
    // The target doesn't move when more students start studying during the week.
    assert.equal(S.ensureQuest(db, K.a.id, now + 86400000).quest.target, 450);
  });

  test("a week nobody looked at is still closed with its result when the next one opens", () => {
    const now = Date.parse("2026-11-04T08:00:00Z");
    const week = S.currentWeek(now);
    const db = structuredClone(readDB());
    const last = G.dayOffset(week, -7);
    db.classQuests = [{ classId: K.a.id, week: last, students: 1, target: 300, createdAt: "x", reachedAt: null }];
    const [u] = C.classMembers(db, K.a.id);
    G.getProgress(db, u.id).xpLog[G.dayOffset(last, 6)] = 320; // Sunday night
    S.ensureQuest(db, K.a.id, now);
    const closed = db.classQuests.find((q) => q.week === last);
    assert.equal(closed.closed, true);
    assert.equal(closed.total >= 320, true);
    assert.ok(closed.reachedAt, "it was reached, though nobody saw it");
    const view = S.questView(db, S.classSnapshot(db, K.a.id, now), u.id);
    assert.equal(view.stars, 1);
    assert.equal(view.history[0].reached, true);
  });
});

describe("announcements go to classes", () => {
  let forAll;
  let forSeven;

  test("a teacher writes to every class, or to the ones they choose", async () => {
    const post = (body) => admin("/api/admin/announcements", { method: "POST", body });
    forAll = (await post({ title: "School-wide mock on Saturday" })).data;
    assert.equal(forAll.classIds, undefined);
    forSeven = (await post({ title: "Grade 7: bring your laptops", classIds: [K.a.id] })).data;
    assert.deepEqual(forSeven.classIds, [K.a.id]);
    const two = (await post({ title: "Grades 8 and 9 meet at 3", classIds: [K.c.id, K.b.id, K.b.id, "no-such-class"] })).data;
    assert.deepEqual(two.classIds, [K.b.id, K.c.id], "in the classes' own order, each once");
    assert.equal((await post({ title: "Everyone", classIds: "all" })).data.classIds, undefined, "all classes, the ones made later too");
    for (const classIds of [[], ["no-such-class"], ["7A"], "7A", 7, [7]]) assert.equal((await post({ title: "Bad", classIds })).status, 400, JSON.stringify(classIds));
  });

  test("a student sees what was sent to their class; a student outside a class sees none", async () => {
    const titles = async (who) => (await as(who)("/api/practice/announcements")).data.announcements.map((a) => a.title);
    const seven = await titles(ana);
    assert.ok(seven.includes("School-wide mock on Saturday") && seven.includes("Grade 7: bring your laptops"));
    assert.equal(seven.includes("Grades 8 and 9 meet at 3"), false);
    const eight = await titles(dil);
    assert.ok(eight.includes("School-wide mock on Saturday") && eight.includes("Grades 8 and 9 meet at 3"));
    assert.equal(eight.includes("Grade 7: bring your laptops"), false);
    assert.deepEqual(await titles(eli), []);
    assert.deepEqual(await titles(demo), []);
    const list = (await as(ana)("/api/practice/announcements")).data.announcements;
    assert.equal(list.find((a) => a.id === forSeven.id).forClass, true);
    assert.equal(list.find((a) => a.id === forAll.id).forClass, false);
    assert.equal("classIds" in list[0], false);
  });

  test("a class made later gets what was sent to every class, not what was sent to others", async () => {
    const late = (await makeClass("Late class")).data;
    const zed = await register("Zed", "Zokirov");
    assert.equal((await membership(zed, { code: late.code })).status, 200);
    const titles = (await as(zed)("/api/practice/announcements")).data.announcements.map((a) => a.title);
    assert.ok(titles.includes("School-wide mock on Saturday"));
    assert.equal(titles.includes("Grade 7: bring your laptops"), false);
    updateDB((db) => {
      removeUser(db, zed.id);
      C.deleteClass(db, late.id);
    });
  });
});

describe("homework", () => {
  let hwId;
  let questions;

  test("only the studio sets homework", async () => {
    assert.equal((await api("/api/admin/homework")).status, 401);
    assert.equal((await as(ana)("/api/admin/homework")).status, 403);
    assert.equal((await as(ana)("/api/admin/homework", { method: "POST", body: {} })).status, 403);
    assert.equal((await as(ana)("/api/admin/homework/draw", { method: "POST", body: { count: 3 } })).status, 403);
  });

  test("a teacher draws questions, and nothing is saved by drawing", async () => {
    assert.equal((await admin("/api/admin/homework/draw", { method: "POST", body: { count: 0 } })).status, 400);
    const r = await admin("/api/admin/homework/draw", { method: "POST", body: { section: "Reading & Writing", skills: ["Transitions"], difficulty: ["Easy", "Medium"], count: 3 } });
    assert.equal(r.status, 200);
    assert.equal(r.data.questions.length, 3);
    assert.ok(r.data.available >= 3);
    for (const q of r.data.questions) {
      assert.equal(q.topic, "Transitions");
      assert.ok(["Easy", "Medium"].includes(q.difficulty));
      assert.deepEqual(Object.keys(q).sort(), ["difficulty", "id", "picture", "section", "title", "topic", "type"], "a card, without the answer");
    }
    assert.equal(readDB().homework.length, 0);
    // The test answers them itself, so it takes multiple-choice ones it hasn't touched yet.
    questions = mcq().filter((q) => q.topic === "Transitions").slice(0, 3);
  });

  test("a homework needs a title, a class, a due date that isn't past, and real questions", async () => {
    const good = { title: "Transitions practice", classIds: [K.a.id], due: tomorrow(), questionIds: questions.map((q) => q.id) };
    const bad = [
      { ...good, title: "  " },
      { ...good, classIds: [] },
      { ...good, classIds: ["no-such-class"] },
      { ...good, classIds: undefined, grades: [7] },
      { ...good, due: "" },
      { ...good, due: "tomorrow" },
      { ...good, due: G.dayOffset(G.todayKey(), -1) },
      { ...good, due: G.dayOffset(G.todayKey(), 400) },
      { ...good, questionIds: [] },
      { ...good, questionIds: ["no-such-question"] },
      { ...good, questionIds: Array.from({ length: 41 }, (_, i) => `q${i}`) }
    ];
    for (const body of bad) assert.equal((await admin("/api/admin/homework", { method: "POST", body })).status, 400, JSON.stringify(body).slice(0, 90));
    assert.equal(readDB().homework.length, 0);
    const made = await admin("/api/admin/homework", { method: "POST", body: { ...good, note: "  Finish before Friday's lesson. " } });
    assert.equal(made.status, 201);
    hwId = made.data.id;
    const stored = readDB().homework[0];
    assert.equal(stored.note, "Finish before Friday's lesson.");
    assert.equal(stored.by, "Tea Cher");
    assert.deepEqual(stored.questionIds, questions.map((q) => q.id));
    assert.deepEqual(stored.classIds, [K.a.id]);
  });

  test("the class it was set for sees it; other classes and other students don't", async () => {
    const mine = (await as(ana)("/api/class/homework")).data.homework;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, "Transitions practice");
    assert.equal(mine[0].state, "open");
    assert.equal(mine[0].daysLeft, 1);
    assert.deepEqual([mine[0].total, mine[0].done, mine[0].correct], [3, 0, 0]);
    assert.deepEqual(mine[0].skills, ["Transitions"]);
    assert.deepEqual(mine[0].class, { students: 3, finished: 0 });
    assert.deepEqual((await as(dil)("/api/class/homework")).data.homework, []);
    assert.equal((await as(eli)("/api/class/homework")).status, 403);
    // The practice player opens it in the order it was set, for that class only.
    const open = (who) => as(who)(`/api/practice/questions?source=homework&homework=${hwId}`);
    assert.deepEqual((await open(ana)).data.questions.map((q) => q.id), questions.map((q) => q.id));
    assert.deepEqual((await open(dil)).data.questions, []);
    assert.deepEqual((await open(eli)).data.questions, []);
    assert.deepEqual((await as(ana)("/api/practice/questions?source=homework&homework=nope")).data.questions, []);
    // And it is on the menu's badge.
    assert.deepEqual((await as(ana)("/api/practice/progress")).data.class, { homework: 1, overdue: 0, unread: 0 });
    assert.equal((await as(eli)("/api/practice/progress")).data.class, undefined);
    assert.equal((await as(ana)("/api/class")).data.homework.next.id, hwId);
  });

  test("it finishes itself from the student's answers, and the last answer says so", async () => {
    const first = await answer(ana, questions[0], true);
    assert.equal(first.data.homework, undefined);
    const second = await answer(ana, questions[1], false);
    assert.equal(second.data.homework, undefined);
    // A second try at the missed one changes nothing: the first answer decided it.
    await answer(ana, questions[1], true, { retry: true });
    let hw = (await as(ana)("/api/class/homework")).data.homework[0];
    assert.deepEqual([hw.done, hw.correct, hw.state], [2, 1, "open"]);
    const last = await answer(ana, questions[2], true);
    assert.deepEqual(last.data.homework, { finished: [{ id: hwId, title: "Transitions practice" }] });
    hw = (await as(ana)("/api/class/homework")).data.homework[0];
    assert.deepEqual([hw.done, hw.correct, hw.state, hw.late], [3, 2, "done", false]);
    assert.ok(hw.finishedAt);
    assert.deepEqual(hw.class, { students: 3, finished: 1 });
    // Answering one again later doesn't finish it a second time.
    assert.equal((await answer(ana, questions[2], true)).data.homework, undefined);
    assert.deepEqual((await as(ana)("/api/practice/progress")).data.class, { homework: 0, overdue: 0, unread: 0 });
    // A classmate sees how many have finished, not who or with what score.
    const bens = (await as(ben)("/api/class/homework")).data.homework[0];
    assert.deepEqual(bens.class, { students: 3, finished: 1 });
    assert.equal(bens.done, 0);
  });

  test("homework pays no XP of its own", async () => {
    const before = readDB().progress.find((p) => p.userId === ben.id).xp;
    const earned = [];
    for (const q of questions) earned.push((await answer(ben, q, true)).data.reward.xpGained);
    const after = readDB().progress.find((p) => p.userId === ben.id).xp;
    assert.equal(after - before, earned.reduce((s, x) => s + x, 0), "only what the answers themselves paid");
  });

  test("a homework past its due day is overdue until it is done, then late", async () => {
    updateDB((db) => (db.homework.find((h) => h.id === hwId).due = G.dayOffset(G.todayKey(), -1)));
    const cems = (await as(cem)("/api/class/homework")).data.homework[0];
    assert.equal(cems.state, "overdue");
    assert.deepEqual((await as(cem)("/api/practice/progress")).data.class, { homework: 1, overdue: 1, unread: 0 });
    for (const q of questions) await answer(cem, q, true);
    const done = (await as(cem)("/api/class/homework")).data.homework[0];
    assert.deepEqual([done.state, done.late], ["done", true]);
    updateDB((db) => (db.homework.find((h) => h.id === hwId).due = tomorrow()));
  });

  test("the teacher sees who has done it and how", async () => {
    const list = (await admin("/api/admin/homework")).data;
    assert.equal(list.homework.length, 1);
    assert.deepEqual(list.homework[0].classes.map((c) => [c.id, c.name, c.students, c.started, c.finished]), [[K.a.id, "7A", 3, 3, 3]]);
    assert.deepEqual(list.homework[0].classIds, [K.a.id]);
    assert.deepEqual(list.classes.map((c) => c.name), ["5 Empty", "6 Spare", "7A", "8B", "9C", "10D", "11E"], "the classes to choose from, by name");
    assert.equal(list.classes.find((c) => c.id === K.a.id).students, 3);
    assert.equal(JSON.stringify(list.classes).includes(codeOf("a")), false);
    assert.equal(list.limits.questions, 40);
    const detail = (await admin(`/api/admin/homework/${hwId}`)).data;
    assert.deepEqual(detail.questions.map((q) => q.id), questions.map((q) => q.id));
    const rows = Object.fromEntries(detail.students.map((s) => [s.name, [s.done, s.correct]]));
    assert.deepEqual(rows, { "Ana Alimova": [3, 2], "Ben Bakirov": [3, 3], "Cem Cho": [3, 3] });
    assert.deepEqual([detail.students[0].classId, detail.students[0].className], [K.a.id, "7A"]);
    assert.equal(detail.students[0].email.endsWith("@test.local"), true, "the studio sees full names and addresses");
    assert.equal((await admin("/api/admin/homework/nope")).status, 404);
    // The class's own page in the studio lists it too.
    const seven = (await admin(`/api/admin/classes/${K.a.id}`)).data;
    assert.deepEqual([seven.homework[0].id, seven.homework[0].title, seven.homework[0].finished, seven.homework[0].students], [hwId, "Transitions practice", 3, 3]);
  });

  test("taking a homework back removes it from the students' lists", async () => {
    const extra = await admin("/api/admin/homework", { method: "POST", body: { title: "For everyone", classIds: "all", due: tomorrow(), questionIds: [questions[0].id] } });
    assert.equal(extra.status, 201);
    assert.equal(readDB().homework.find((h) => h.id === extra.data.id).classIds.length, 7, "every class there is now");
    assert.equal((await as(dil)("/api/class/homework")).data.homework.length, 1, "all classes includes 8B");
    assert.equal((await admin(`/api/admin/homework/${extra.data.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await admin(`/api/admin/homework/${extra.data.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await as(dil)("/api/class/homework")).data.homework.length, 0);
    assert.equal(readDB().homework.length, 1);
  });
});

describe("class chat", () => {
  let hello;

  test("a class has one room, and only its students are in it", async () => {
    const sent = await say(ana, "class", "  Hi everyone, who has done question 4?  ");
    assert.equal(sent.status, 201);
    hello = sent.data.message;
    assert.equal(hello.body, "Hi everyone, who has done question 4?");
    assert.equal(hello.mine, true);
    assert.deepEqual(hello.from, { id: ana.id, name: "Ana A.", avatar: null });
    const bens = await as(ben)("/api/class/chat/class");
    assert.equal(bens.status, 200);
    assert.equal(bens.data.kind, "class");
    assert.deepEqual(bens.data.messages.map((m) => [m.body, m.mine]), [["Hi everyone, who has done question 4?", false]]);
    assert.deepEqual((await as(dil)("/api/class/chat/class")).data.messages, [], "8B has its own room");
    assert.equal((await api("/api/class/chat/class")).status, 401);
    for (const body of [undefined, "", "   ", 7, { a: 1 }, "x".repeat(Chat.CHAT.max + 1)]) assert.equal((await say(ana, "class", body)).status, 400, JSON.stringify(body)?.slice(0, 20));
    for (const room of [K.b.id, `class:${K.b.id}`, "8B", "dm-", "dm-nobody", "everything"]) assert.equal((await as(ana)(`/api/class/chat/${room}`)).status, 404, room);
    assert.deepEqual(readDB().classMessages.map((m) => m.room), [`class:${K.a.id}`]);
  });

  test("the discussion is open from the first student: a class of one can write straight away", async () => {
    const solo = (await makeClass("Solo class")).data;
    const yan = await register("Yan", "Yusupov");
    assert.equal((await as(yan)("/api/class/chat/class")).status, 403, "not before joining");
    assert.equal((await membership(yan, { code: solo.code })).status, 200);
    const rooms = (await as(yan)("/api/class/chat")).data;
    assert.deepEqual(rooms.rooms.map((r) => [r.key, r.name, r.students, r.unread, r.last]), [["class", "Solo class chat", 1, 0, null]]);
    assert.equal(rooms.canSend, true);
    assert.equal((await say(yan, "class", "First one here!")).status, 201);
    assert.deepEqual((await as(yan)("/api/class/chat/class")).data.messages.map((m) => m.body), ["First one here!"]);
    // Deleting the class closes its discussion and lets the student go.
    assert.equal((await admin(`/api/admin/classes/${solo.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await as(yan)("/api/class/chat/class")).status, 403);
    assert.equal(readDB().classMessages.some((m) => m.room === `class:${solo.id}`), false);
    updateDB((db) => removeUser(db, yan.id));
  });

  test("unread messages are counted until the room is opened", async () => {
    assert.deepEqual((await as(ben)("/api/practice/progress")).data.class.unread, 1);
    assert.equal((await as(ana)("/api/practice/progress")).data.class.unread, 0, "your own message isn't new to you");
    const rooms = (await as(ben)("/api/class/chat")).data;
    assert.equal(rooms.rooms.length, 1);
    assert.deepEqual([rooms.rooms[0].key, rooms.rooms[0].kind, rooms.rooms[0].name, rooms.rooms[0].unread, rooms.rooms[0].students], ["class", "class", "7A chat", 1, 3]);
    assert.equal(rooms.rooms[0].last.name, "Ana");
    assert.deepEqual(rooms.classmates.map((c) => c.name), ["Ana A.", "Cem C."]);
    assert.equal(rooms.canSend, true);
    assert.equal((await as(ben)("/api/class/chat/class/read", { method: "POST" })).status, 200);
    assert.equal((await as(ben)("/api/practice/progress")).data.class.unread, 0);
    assert.equal((await as(cem)("/api/class")).data.chat.unread, 1);
  });

  test("two classmates can write privately; nobody else can read it", async () => {
    const sent = await say(ben, `dm-${ana.id}`, "Can you explain number 4 to me?");
    assert.equal(sent.status, 201);
    const hers = await as(ana)(`/api/class/chat/dm-${ben.id}`);
    assert.equal(hers.data.kind, "dm");
    assert.equal(hers.data.with.name, "Ben B.");
    assert.deepEqual(hers.data.messages.map((m) => m.body), ["Can you explain number 4 to me?"]);
    assert.deepEqual((await as(cem)(`/api/class/chat/dm-${ana.id}`)).data.messages, [], "Cem's own room with Ana is empty");
    const list = (await as(ana)("/api/class/chat")).data.rooms;
    assert.deepEqual(list.map((r) => [r.key, r.unread]), [["class", 0], [`dm-${ben.id}`, 1]]);
    assert.equal((await as(cem)("/api/class/chat")).data.rooms.length, 1, "Cem has no private room yet");
    // Not with a student of another class, with one outside the classes, or with yourself.
    for (const id of [dil.id, eli.id, ana.id, demo.id]) {
      assert.equal((await say(ana, `dm-${id}`, "hello")).status, 404, id);
      assert.equal((await as(ana)(`/api/class/chat/dm-${id}`)).status, 404);
    }
    assert.equal((await say(dil, `dm-${ana.id}`, "hello from 8B")).status, 404);
    assert.equal(readDB().classMessages.filter((m) => m.room.startsWith("dm:")).length, 1);
  });

  test("a question can be shared, and the card never carries its answer", async () => {
    const q = mcq()[5];
    const shared = await say(cem, "class", "", { questionId: q.id });
    assert.equal(shared.status, 201, "the text is optional with a question");
    assert.deepEqual(shared.data.message.question, { id: q.id, title: q.title, section: q.section, topic: q.topic, difficulty: q.difficulty, type: "mcq", picture: Boolean(q.promptImage) });
    const withNote = await say(cem, "class", "I keep getting B on this one", { questionId: q.id, replyTo: hello.id });
    assert.equal(withNote.data.message.body, "I keep getting B on this one");
    assert.deepEqual(withNote.data.message.replyTo, { id: hello.id, name: "Ana A.", preview: "Hi everyone, who has done question 4?" });
    assert.equal((await say(cem, "class", "see this", { questionId: "no-such-question" })).status, 404);
    const text = JSON.stringify((await as(ana)("/api/class/chat/class")).data);
    for (const leak of ["correctIndex", "rationales", "explanation", "correctAnswer"]) assert.equal(text.includes(leak), false, leak);
    // Anyone can open the shared question in the player.
    const opened = await as(ana)(`/api/practice/questions?source=shared&ids=${q.id}`);
    assert.deepEqual(opened.data.questions.map((x) => x.id), [q.id]);
    // A reply to a message in another room is just a message.
    const stray = await say(ben, `dm-${ana.id}`, "about that", { replyTo: hello.id });
    assert.equal(stray.data.message.replyTo, null);
  });

  test("a student can take back their own message, not someone else's", async () => {
    const mine = (await say(ana, "class", "oops wrong chat")).data.message;
    assert.equal((await as(ben)(`/api/class/chat/messages/${mine.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await as(dil)(`/api/class/chat/messages/${mine.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await as(ana)(`/api/class/chat/messages/${mine.id}`, { method: "DELETE" })).status, 200);
    const shown = (await as(ben)("/api/class/chat/class")).data.messages.find((m) => m.id === mine.id);
    assert.deepEqual([shown.deleted, shown.body], [true, ""]);
    assert.equal(JSON.stringify((await as(ben)("/api/class/chat")).data).includes("oops wrong chat"), false, "nor in the room's preview");
  });

  test("a message can be reported, and the teacher sees it with what came before", async () => {
    const rude = (await say(cem, "class", "you are all so slow")).data.message;
    const report = (who, id, reason) => as(who)(`/api/class/chat/messages/${id}/report`, { method: "POST", body: { reason } });
    assert.equal((await report(cem, rude.id, "unkind")).status, 400, "not your own");
    assert.equal((await report(dil, rude.id, "unkind")).status, 404, "not from another class");
    assert.equal((await report(ana, rude.id, "unkind")).status, 200);
    assert.equal((await report(ana, rude.id, "unkind")).status, 200, "twice is once");
    assert.equal((await report(ben, rude.id, "made-up-reason")).status, 200);
    assert.equal(readDB().classReports.length, 2);
    assert.equal((await as(ana)("/api/admin/classes/reports")).status, 403);
    assert.equal((await admin("/api/admin/classes/waiting")).data.reports, 1, "one message, however many reported it");
    const { reports } = (await admin("/api/admin/classes/reports")).data;
    assert.equal(reports.length, 1);
    assert.equal(reports[0].message.body, "you are all so slow");
    assert.equal(reports[0].message.from.name, "Cem Cho");
    assert.deepEqual(reports[0].room, { kind: "class", label: "7A chat", classId: K.a.id });
    assert.equal(reports[0].message.from.className, "7A");
    assert.deepEqual(reports[0].reports.map((r) => [r.by.name, r.reason]).sort(), [["Ana Alimova", "Unkind or bullying"], ["Ben Bakirov", "Something else"]]);
    assert.ok(reports[0].context.length >= 2 && reports[0].context.length <= 6);
    // The teacher removes it: students see a removed message, and the report is settled.
    assert.equal((await admin(`/api/admin/classes/messages/${rude.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await admin("/api/admin/classes/messages/nope", { method: "DELETE" })).status, 404);
    assert.equal((await as(ana)("/api/class/chat/class")).data.messages.find((m) => m.id === rude.id).deleted, true);
    assert.equal((await admin("/api/admin/classes/waiting")).data.reports, 0);
    assert.equal((await report(ana, rude.id, "unkind")).status, 404, "a removed message can't be reported");
  });

  test("a report from a private chat reaches the teacher too, and can be dismissed", async () => {
    const dm = (await say(ben, `dm-${ana.id}`, "give me your answers or else")).data.message;
    await as(ana)(`/api/class/chat/messages/${dm.id}/report`, { method: "POST", body: { reason: "unsafe" } });
    const { reports } = (await admin("/api/admin/classes/reports")).data;
    assert.equal(reports[0].room.kind, "dm");
    assert.match(reports[0].room.label, /Ana Alimova/);
    assert.match(reports[0].room.label, /Ben Bakirov/);
    assert.ok(reports[0].context.some((m) => m.body === "Can you explain number 4 to me?"));
    assert.equal((await admin(`/api/admin/classes/reports/${dm.id}/dismiss`, { method: "POST" })).status, 200);
    assert.equal((await admin("/api/admin/classes/waiting")).data.reports, 0);
    assert.equal((await as(ana)(`/api/class/chat/dm-${ben.id}`)).data.messages.some((m) => m.id === dm.id && !m.deleted), true, "the message stays");
  });

  test("a teacher can pause a student's messages", async () => {
    assert.equal((await admin(`/api/admin/students/${cem.id}`, { method: "PUT", body: { chatMuted: "yes" } })).status, 400);
    assert.equal((await admin(`/api/admin/students/${cem.id}`, { method: "PUT", body: { chatMuted: true } })).status, 200);
    const refused = await say(cem, "class", "hello?");
    assert.equal(refused.status, 403);
    const state = (await as(cem)("/api/class/chat")).data;
    assert.equal(state.canSend, false);
    assert.equal(state.blocked.reason, "muted");
    assert.equal((await as(cem)("/api/class/chat/class")).status, 200, "reading still works");
    assert.equal((await admin(`/api/admin/classes/${K.a.id}`)).data.students.find((s) => s.id === cem.id).muted, true);
    await admin(`/api/admin/students/${cem.id}`, { method: "PUT", body: { chatMuted: false } });
    assert.equal((await say(cem, "class", "sorry about before")).status, 201);
    assert.equal("chatMuted" in readDB().users.find((u) => u.id === cem.id), false);
  });

  test("a student can't flood a room", () => {
    const now = Date.now();
    const db = { classMessages: [] };
    const me = { id: "s1" };
    const row = (ago) => ({ from: "s1", createdAt: new Date(now - ago).toISOString() });
    db.classMessages = Array.from({ length: Chat.CHAT.perMinute - 1 }, () => row(5000));
    assert.equal(Chat.sendBlock(db, me, now), null);
    db.classMessages.push(row(1000));
    assert.equal(Chat.sendBlock(db, me, now).code, 429);
    assert.equal(Chat.sendBlock(db, { id: "s2" }, now), null, "someone else's messages don't count against you");
    db.classMessages = Array.from({ length: Chat.CHAT.perDay }, () => row(3 * 3600000));
    assert.equal(Chat.sendBlock(db, me, now).code, 429);
    db.classMessages = Array.from({ length: Chat.CHAT.perDay }, () => row(25 * 3600000));
    assert.equal(Chat.sendBlock(db, me, now), null);
  });

  test("a room keeps its newest messages", () => {
    const db = structuredClone(readDB());
    const user = db.users.find((u) => u.id === dil.id);
    const room = Chat.classRoom(K.b.id);
    const t0 = Date.now() - 10 * 86400000;
    db.classMessages = Array.from({ length: Chat.CHAT.keep }, (_, i) => ({ id: `old${i}`, room, from: "someone-else", body: "x", createdAt: new Date(t0 + i * 1000).toISOString() }));
    db.classReports = [{ id: "r", messageId: "old0", by: "x", reason: "other", createdAt: new Date().toISOString() }];
    const sent = Chat.postMessage(db, user, room, { body: "newest" });
    assert.ok(sent.message);
    assert.equal(db.classMessages.length, Chat.CHAT.keep);
    assert.equal(db.classMessages.some((m) => m.id === "old0"), false);
    assert.equal(db.classReports.length, 0, "a report about a message that has gone goes with it");
    const page = Chat.roomMessages(db, user, room);
    assert.equal(page.messages.length, Chat.CHAT.page);
    assert.equal(page.more, true);
    assert.equal(page.messages.at(-1).body, "newest");
    const earlier = Chat.roomMessages(db, user, room, { before: page.messages[0].createdAt });
    assert.equal(earlier.messages.length, Chat.CHAT.page);
    assert.ok(earlier.messages.at(-1).createdAt < page.messages[0].createdAt);
  });

  test("a private room is the same room from both sides", () => {
    assert.equal(Chat.dmRoom("b", "a"), Chat.dmRoom("a", "b"));
    assert.equal(Chat.dmRoom("a", "b"), "dm:a:b");
  });
});

describe("the studio's classes", () => {
  test("the studio is closed to students", async () => {
    for (const p of ["/api/admin/classes", `/api/admin/classes/${K.a.id}`, "/api/admin/classes/reports", "/api/admin/classes/waiting"]) {
      assert.equal((await api(p)).status, 401, p);
      assert.equal((await as(ana)(p)).status, 403, p);
    }
    assert.equal((await as(ana)("/api/admin/classes/messages/x", { method: "DELETE" })).status, 403);
    // A student can't make, rename or delete a class either.
    for (const [method, p, body] of [["POST", "/api/admin/classes", { name: "Mine" }], ["PUT", `/api/admin/classes/${K.a.id}`, { name: "Mine" }], ["DELETE", `/api/admin/classes/${K.a.id}`]]) {
      assert.equal((await api(p, { method, body })).status, 401, `${method} ${p}`);
      assert.equal((await as(ana)(p, { method, body })).status, 403, `${method} ${p}`);
    }
    assert.equal(readDB().classes.length, 7);
  });

  test("a teacher makes a class and names it, and it has its code at once", async () => {
    for (const name of [undefined, "", "   ", 7, "7a"]) assert.equal((await makeClass(name)).status, 400, JSON.stringify(name));
    const made = await makeClass("  Olympiad   team ");
    assert.equal(made.status, 201);
    assert.deepEqual(Object.keys(made.data).sort(), ["by", "code", "createdAt", "id", "mark", "name"]);
    assert.deepEqual([made.data.name, made.data.mark, made.data.by], ["Olympiad team", "OT", "Tea Cher"]);
    assert.match(made.data.code, /^[A-HJKMNP-Z2-9]{6}$/);
    assert.equal(readDB().classes.find((c) => c.id === made.data.id).by, "admin-1");
    // It is empty until someone types its code, and then it is a class like any other.
    assert.deepEqual((await admin(`/api/admin/classes/${made.data.id}`)).data.students, []);
    const gus = await register("Gus", "Ganiev");
    const joined = await membership(gus, { code: made.data.code });
    assert.deepEqual(joined.data.classroom, { id: made.data.id, name: "Olympiad team", mark: "OT" });
    // Renaming it shows on the student's side straight away; a name another class has is refused.
    const rename = (name) => admin(`/api/admin/classes/${made.data.id}`, { method: "PUT", body: { name } });
    assert.equal((await rename("8b")).status, 400);
    assert.equal((await rename("")).status, 400);
    assert.equal((await rename("olympiad team")).status, 200, "its own name in another case");
    assert.equal((await rename("Olympiad")).data.name, "Olympiad");
    assert.equal((await as(gus)("/api/class")).data.classroom.name, "Olympiad");
    assert.equal((await admin("/api/admin/classes/nope", { method: "PUT", body: { name: "X" } })).status, 404);
    // Deleting it: the student is in no class, is offered the question again, and can join another at once.
    assert.equal((await admin("/api/admin/classes/nope", { method: "DELETE" })).status, 404);
    const gone = await admin(`/api/admin/classes/${made.data.id}`, { method: "DELETE" });
    assert.deepEqual(gone.data, { ok: true, students: 1 });
    assert.equal((await admin(`/api/admin/classes/${made.data.id}`)).status, 404);
    const after = (await as(gus)("/api/class")).data;
    assert.deepEqual([after.member, after.schoolAsked, after.canChangeAt], [false, false, null]);
    assert.equal((await membership(gus, { code: made.data.code })).status, 400, "the deleted class's code opens nothing");
    assert.equal((await membership(gus, { code: codeOf("spare") })).data.classroom.name, "6 Spare");
    updateDB((db) => removeUser(db, gus.id));
  });

  test("every class at a glance", async () => {
    const r = (await admin("/api/admin/classes")).data;
    assert.deepEqual(r.classes.map((c) => c.name), ["5 Empty", "6 Spare", "7A", "8B", "9C", "10D", "11E"]);
    const seven = r.classes.find((c) => c.id === K.a.id);
    assert.equal(seven.students, 3);
    assert.equal(seven.studied, 3);
    assert.ok(seven.xp > 0 && seven.minutes > 0 && seven.messagesWeek > 0);
    assert.equal(seven.homeworkOpen, 1);
    assert.equal(seven.goal.target, 300);
    assert.equal(seven.by, "Tea Cher");
    const empty = r.classes.find((c) => c.id === K.empty.id);
    assert.deepEqual([empty.students, empty.goal, empty.mark], [0, null, "5"]);
    assert.deepEqual(r.outside, { elsewhere: 1, notAsked: 0 }, "Eli said no; Fay joined; the demo account isn't counted");
    assert.equal(r.limits.name, 40);
    for (const id of ["7", "g7", "7A", "nope"]) assert.equal((await admin(`/api/admin/classes/${id}`)).status, 404, id);
  });

  test("the studio shows each class's code, and can replace it", async () => {
    const list = (await admin("/api/admin/classes")).data.classes;
    assert.deepEqual(list.map((c) => c.code), ["empty", "spare", "a", "b", "c", "d", "e"].map(codeOf));
    assert.equal(new Set(list.map((c) => c.code)).size, 7);
    const old = codeOf("spare");
    const path = `/api/admin/classes/${K.spare.id}`;
    assert.equal((await admin(path)).data.code, old);
    for (const p of [`${path}/code`, "/api/admin/classes/nope/code"]) {
      assert.equal((await api(p, { method: "POST" })).status, 401, p);
      assert.equal((await as(ana)(p, { method: "POST" })).status, 403, p);
    }
    assert.equal((await admin("/api/admin/classes/nope/code", { method: "POST" })).status, 404);
    const renewed = await admin(`${path}/code`, { method: "POST" });
    assert.equal(renewed.status, 200);
    assert.deepEqual([renewed.data.id, renewed.data.name], [K.spare.id, "6 Spare"]);
    assert.notEqual(renewed.data.code, old);
    assert.equal(codeOf("spare"), renewed.data.code);
    // The old code is dead, the new one works, and the other classes are untouched.
    const gus = await register("Gus2", "Ganiev");
    assert.equal((await membership(gus, { code: old })).status, 400);
    assert.equal((await membership(gus, { code: renewed.data.code })).data.classroom.name, "6 Spare");
    assert.equal((await as(ana)("/api/class")).data.classroom.name, "7A");
    updateDB((db) => removeUser(db, gus.id));
  });

  test("one class: its students with full names, the week each is having, and its chat", async () => {
    const r = (await admin(`/api/admin/classes/${K.a.id}`)).data;
    assert.deepEqual([r.classroom.id, r.classroom.name, r.classroom.mark, r.code], [K.a.id, "7A", "7A", codeOf("a")]);
    assert.deepEqual(r.students.map((s) => s.name).sort(), ["Ana Alimova", "Ben Bakirov", "Cem Cho"]);
    const hers = r.students.find((s) => s.id === ana.id);
    assert.equal(hers.email, "ana-class@test.local");
    assert.ok(hers.week.questions >= 5);
    assert.ok(hers.week.accuracy > 0 && hers.week.accuracy < 1, "a teacher sees accuracy");
    // The chat, with removed messages still readable to the teacher.
    assert.ok(r.chat.some((m) => m.body === "you are all so slow" && m.deleted && m.deletedBy === "teacher"));
    assert.ok(r.chat.some((m) => m.body === "oops wrong chat" && m.deleted && m.deletedBy === "author"));
    assert.equal(r.chat.some((m) => m.body.includes("explain number 4")), false, "private chats aren't in it");
  });

  test("a teacher can move a student to another class, or out of the classes, at any time", async () => {
    const move = (id, body) => admin(`/api/admin/students/${id}`, { method: "PUT", body });
    assert.equal((await move(fay.id, { classId: K.b.id })).status, 200, "no code needed, and the student's own 30-day wait doesn't bind a teacher");
    assert.equal((await as(fay)("/api/class")).data.classroom.name, "8B");
    assert.deepEqual((await as(dil)("/api/class/classmates")).data.classmates.map((c) => c.name).sort(), ["Dil D.", "Fay F."]);
    for (const classId of ["no-such-class", "8B", 8]) assert.equal((await move(fay.id, { classId })).status, 400, JSON.stringify(classId));
    assert.equal((await as(fay)("/api/class")).data.classroom.name, "8B", "a refused move changes nothing");
    assert.equal((await move(fay.id, { classId: null })).status, 200);
    const out = (await as(fay)("/api/class")).data;
    assert.deepEqual([out.member, out.schoolAsked], [false, true], "taken out by a teacher: not asked for a code again");
    assert.equal((await as(fay)("/api/class/chat/class")).status, 403);
    assert.equal((await move(demo.id, { classId: K.a.id })).status, 400);
    // The students list shows each one's class, and the classes to filter by.
    const { students: list, classes } = (await admin("/api/admin/students")).data;
    assert.equal(list.find((s) => s.id === ana.id).classroom.name, "7A");
    assert.equal(list.find((s) => s.id === eli.id).classroom, null);
    assert.deepEqual(classes.map((c) => c.name), ["5 Empty", "6 Spare", "7A", "8B", "9C", "10D", "11E"]);
    assert.equal(JSON.stringify(classes).includes(codeOf("a")), false);
    assert.equal((await admin(`/api/admin/students/${ana.id}`)).data.classes.length, 7, "and the student's page, for the move");
  });

  test("a student who changes class leaves the old class's rooms behind", async () => {
    // Ben moves to 8B (his first move, so it is free).
    const moved = await membership(ben, { code: codeOf("b") });
    assert.equal(moved.data.classroom.name, "8B");
    assert.deepEqual((await as(ben)("/api/class/chat/class")).data.messages, [], "8B's room, not 7A's");
    assert.equal((await as(ben)(`/api/class/chat/dm-${ana.id}`)).status, 404);
    assert.equal((await as(ana)(`/api/class/chat/dm-${ben.id}`)).status, 404);
    assert.equal((await as(ana)("/api/class/chat")).data.rooms.some((r) => r.kind === "dm"), false);
    assert.deepEqual((await as(ben)("/api/class/homework")).data.homework, []);
    // What he wrote in 7A is still there, under his name.
    assert.ok((await as(ana)("/api/class/chat/class")).data.messages.length > 0);
    // Back in 7A (a teacher moves him), the private room is there again.
    await admin(`/api/admin/students/${ben.id}`, { method: "PUT", body: { classId: K.a.id } });
    assert.equal((await as(ana)(`/api/class/chat/dm-${ben.id}`)).data.messages.length, 3);
  });

  test("deleting a student removes what they left in the classes", async () => {
    const before = readDB();
    assert.ok(before.classMessages.some((m) => m.from === ben.id));
    assert.ok(before.cheers.some((c) => c.from === ben.id));
    updateDB((db) => removeUser(db, ben.id));
    const db = readDB();
    assert.equal(db.classMessages.some((m) => m.from === ben.id || m.room.includes(ben.id)), false);
    assert.equal(db.classReads.some((r) => r.userId === ben.id), false);
    assert.equal(db.classReports.some((r) => r.by === ben.id), false);
    assert.equal(db.cheers.some((c) => c.from === ben.id || c.to === ben.id), false);
    assert.deepEqual((await as(ana)("/api/class/classmates")).data.classmates.map((c) => c.name).sort(), ["Ana A.", "Cem C."]);
    assert.equal((await as(ana)("/api/class")).status, 200);
    assert.equal((await as(ana)("/api/class/chat/class")).status, 200);
  });
});
