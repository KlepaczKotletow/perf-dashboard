"use client";

import { useCallback } from "react";

// One tiny primitive behind ~5 Aceternity effects (Card Spotlight, Glowing
// Effect, Glare, 3D tilt): on pointer move, write the cursor position as
// `--mx`/`--my` CSS variables (in %) on the element. CSS does the rest via
// `.glow-surface::after`. No state, no re-renders.
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  return { onPointerMove };
}
