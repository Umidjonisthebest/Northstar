// "Studying now": how many students have been active in the last two minutes.
//
// Presence is momentary, so it is kept in memory instead of the database:
// writing db.json on every heartbeat would rewrite the whole file once a
// minute per student, and a restart only means the count starts again. Who
// was online is never stored. To the whole app only a count ever leaves this
// module; a class is told which of its own members are studying (activeAmong).

const WINDOW_MS = 2 * 60000;
const MIN_SHOWN = 3; // below this the exact number isn't given out

const lastSeen = new Map(); // userId -> time of the last heartbeat (epoch ms)

export function beat(userId, now = Date.now()) {
  lastSeen.set(userId, now);
}

export function activeCount(now = Date.now()) {
  for (const [userId, at] of lastSeen) if (now - at > WINDOW_MS) lastSeen.delete(userId);
  return lastSeen.size;
}

// What a student may see: the count, or just "a few" when it is small enough
// to say something about individual students.
export function presenceSummary(now = Date.now()) {
  const count = activeCount(now);
  return count < MIN_SHOWN ? { few: true, count: null } : { few: false, count };
}

// Which of these students are active right now. Only ever asked about a
// student's own classmates (classStats.js), who see each other's study
// sessions anyway.
export function activeAmong(userIds, now = Date.now()) {
  activeCount(now); // drops the ones whose last heartbeat is too old
  return userIds.filter((id) => lastSeen.has(id));
}

export function resetPresence() {
  lastSeen.clear();
}
