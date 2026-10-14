import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Sign-in (students and the teacher). Only FAILED attempts count: a whole class often signs in
// together from one school IP, and a single shared budget of 20 locked out everyone after the
// twentieth student, while a script guessing passwords still hits the wall after 20 wrong tries.
export const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});

// Creating accounts: counted per request, with room for a class signing up together.
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-ups from this network. Please wait a while and try again." }
});

// Password reset and reset-link requests: rare, and each one is a way to probe accounts.
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});

// IELTS candidate-ID login. A whole exam room usually shares one public IP, so
// this only stops brute-force enumeration of IDs, not a class logging in together.
export const ieltsCandidateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many login attempts. Please wait a moment and try again." }
});
