"use client";

import { useEffect } from "react";

export function useHotkeys(map: Record<string, () => void>) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (event.key === "Escape") {
        map.Escape?.();
        return;
      }
      if (typing) return;
      if (event.key === "F2") {
        event.preventDefault();
        map.F2?.();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        map["Mod+K"]?.();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        map["Mod+Enter"]?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
