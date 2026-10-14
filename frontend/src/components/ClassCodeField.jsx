import React, { useId } from "react";
import "../classroom.css";

// The class code a student types to join their class (backend/classrooms.js): a few letters and
// digits their teacher gives them. It is the only way into a class; sign-up doesn't ask. Used on
// the "join your class" screen and in Settings.
//
//   value     what is typed so far (capitals and digits)
//   onChange  (value) => void
//   length    how long a code is (the server sends it)
//   busy      while the code is being checked: it can't be changed, but the field keeps the
//             cursor, so a wrong code can be typed over straight away

// What is still missing before the code can be sent, or "".
export const codeProblem = (value, length = 6) => (value.length === length ? "" : `Enter the ${length}-character class code your teacher gave you`);

export default function ClassCodeField({ value, onChange, length = 6, busy = false, autoFocus = false, note }) {
  const id = useId();
  return (
    <div className="cr-code">
      <label htmlFor={id}>Class code</label>
      {/* Typed or pasted with spaces, dashes or small letters, it ends up the way the code is written. */}
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, length))}
        placeholder={"·".repeat(length)}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        readOnly={busy}
        autoFocus={autoFocus}
        aria-describedby={`${id}-note`}
      />
      <span id={`${id}-note`}>{note || `Your teacher has it: ${length} letters and numbers.`}</span>
    </div>
  );
}
