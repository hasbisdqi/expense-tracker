import { useEffect } from "react";

type HotkeyCallback = (event: KeyboardEvent) => void;

interface HotkeyConfig {
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  preventDefault?: boolean;
  enableOnInputs?: boolean;
}

export function useHotkeys(
  key: string,
  callback: HotkeyCallback,
  config: HotkeyConfig = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const {
        alt = false,
        ctrl = false,
        meta = false,
        shift = false,
        preventDefault = true,
        enableOnInputs = false,
      } = config;

      // Check if we should ignore shortcuts on inputs
      if (!enableOnInputs) {
        const target = event.target as HTMLElement;
        const isInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;
        if (isInput) return;
      }

      const match =
        event.key.toLowerCase() === key.toLowerCase() &&
        event.altKey === alt &&
        event.ctrlKey === ctrl &&
        (event.metaKey === meta || (meta && ctrl && event.ctrlKey)) && // Handle meta/ctrl flexibly
        event.shiftKey === shift;

      if (match) {
        if (preventDefault) {
          event.preventDefault();
        }
        callback(event);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, config]);
}
