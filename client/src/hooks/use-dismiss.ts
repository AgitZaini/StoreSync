import { useEffect } from "react";
import type { RefObject } from "react";

/** Calls `onDismiss` on outside pointer-down or Escape while `active`. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onDismiss();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, onDismiss, ref]);
}
