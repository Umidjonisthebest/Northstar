// Checks for what people type into the sign-in and account forms. Request bodies are untrusted:
// a number or object where text is expected must be refused, not coerced or thrown on.

export const PASSWORD_MIN = 8;
// bcrypt only uses the first 72 bytes. A longer password would be silently cut, so it is refused.
export const PASSWORD_MAX_BYTES = 72;

// Plain strings only, trimmed, cut to `max`. Anything else is "".
export const text = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Passwords are kept exactly as typed (no trimming), but only strings count.
export const secret = (v) => (typeof v === "string" ? v : "");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v) => typeof v === "string" && v.length <= 120 && EMAIL.test(v);

// Returns a message for a password that can't be accepted, or null.
export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw === "") return "Password is required";
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes (about 70 characters)`;
  return null;
}
