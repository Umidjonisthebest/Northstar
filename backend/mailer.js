// Outgoing email, and the public address the app is served from.
//
// There is no mail server in this project. Set MAIL_WEBHOOK_URL to a service that accepts
// `POST { to, subject, text }` as JSON (an automation hook, or a tiny relay in front of SMTP or an
// email API) and password-reset links are sent through it. With nothing set, nothing is sent, and
// `mailConfigured()` says so, so the screens can tell the student the truth instead of promising
// an email that never arrives.

// The address links in emails point at, e.g. https://prep.example.com. Never taken from the
// request (a forged Host/Origin header would put an attacker's domain into a real reset email).
export function appUrl(env = process.env) {
  const url = (env.APP_URL || "").trim().replace(/\/+$/, "");
  if (url) return url;
  if (env.NODE_ENV === "production") return "";
  return "http://localhost:5173";
}

export function mailConfigured(env = process.env) {
  return Boolean((env.MAIL_WEBHOOK_URL || "").trim()) && Boolean(appUrl(env));
}

// Resolves true when the relay accepted the message. Never throws: a mail outage must not make
// the reset form look broken (or reveal whether an address has an account).
export async function sendMail({ to, subject, text }, env = process.env) {
  if (!mailConfigured(env)) return false;
  try {
    const res = await fetch(env.MAIL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.MAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.MAIL_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ to, subject, text }),
      signal: AbortSignal.timeout(10_000)
    });
    return res.ok;
  } catch (err) {
    console.warn("[mail] could not send:", err?.message || err);
    return false;
  }
}
