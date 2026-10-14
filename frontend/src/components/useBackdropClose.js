import { useRef } from "react";

// Props for a modal's backdrop that close it only when the press both started and ended on the
// backdrop. A plain onClick also fires when someone selects text inside the dialog and lets go
// outside it, which closed the modal and threw away whatever was typed.
export default function useBackdropClose(onClose) {
  const pressedOnBackdrop = useRef(false);
  return {
    onMouseDown: (e) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      const close = pressedOnBackdrop.current && e.target === e.currentTarget;
      pressedOnBackdrop.current = false;
      if (close) onClose();
    }
  };
}
