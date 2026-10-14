const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newId(prefix = "id") {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}
