"use client";

import { useEffect, useRef } from "react";
import { useAnimationControls } from "framer-motion";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

// Animate the existing content: a keyed wrapper would reset forms and drafts.
export function useContentTransition(change: string) {
  const controls = useAnimationControls();
  const reducedMotion = usePrefersReducedMotion();
  const previous = useRef(change);
  useEffect(() => {
    if (reducedMotion !== false) {
      previous.current = change;
      controls.stop();
      controls.set({ opacity: 1, y: 0 });
      return;
    }
    if (previous.current === change) return;
    previous.current = change;
    controls.stop();
    void controls.start({
      opacity: [0.65, 1],
      y: [4, 0],
      transition: { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] },
    });
    return () => controls.stop();
  }, [change, controls, reducedMotion]);
  return controls;
}
