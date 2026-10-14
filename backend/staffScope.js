// What a member of staff may see inside the routes both panels share (see auth.js for which
// routes those are). An admin sees every account. A teacher works with the students who are in a
// class and nobody else: a student outside a class has no teacher (the owner's rule), so a teacher
// can't list them, open them, reset their password or add them to a session. The demo account is
// never in a class (classrooms.js), so teachers don't meet it either.
import { inClass } from "./classrooms.js";

export const isTeacher = (req) => req.user?.role === "teacher";

export const canSeeStudent = (req, u) => Boolean(u) && u.role === "student" && (!isTeacher(req) || inClass(u));

export const visibleStudents = (req, db) => db.users.filter((u) => canSeeStudent(req, u));

// Said when a teacher asks for something that is the admin's inside a shared route.
export const ADMIN_ONLY = { error: "Only an admin can do this", code: "ADMIN_ONLY" };
