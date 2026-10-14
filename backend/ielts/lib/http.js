export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Allow-list: Northstar users also carry password-reset tokens that must never leave the server.
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    candidateId: user.candidateId ?? null,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || null,
    phone: user.phone || null,
    status: user.status || "active",
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

// Newest candidate IDs first; admins (no candidate ID) after students.
export function byCandidateIdDesc(a, b) {
  return (Number(b.candidateId) || 0) - (Number(a.candidateId) || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

export function fullName(user) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
}

export function paginate(items, query) {
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage, 10) || 10));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(pages, Math.max(1, parseInt(query.page, 10) || 1));
  return { items: items.slice((page - 1) * perPage, page * perPage), total, page, perPage, pages };
}

export function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function matchesQuery(fields, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => String(f ?? "").toLowerCase().includes(needle));
}
