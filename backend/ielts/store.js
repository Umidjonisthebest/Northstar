// IELTS data lives in Northstar's db.json next to the SAT collections, under its
// own names (see DEFAULT_DATA in ../db.js), so IELTS sessions and attempts never
// mix with SAT ones. Users are shared.

export const CONTENT_COLLECTIONS = { listening: "ieltsListening", reading: "ieltsReading", writing: "ieltsWriting" };

export const contentOf = (db, kind) => db[CONTENT_COLLECTIONS[kind]];
