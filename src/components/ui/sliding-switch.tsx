"use client";

import { useId } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export function SlidingSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className: string;
}) {
  const id = useId();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <LayoutGroup id={id}>
      <div
        className={`${className} sliding-switch`}
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={value === option.value ? "selected" : undefined}
            onClick={() => onChange(option.value)}
          >
            {value === option.value && (
              <motion.span
                className="switch-indicator"
                layoutId="indicator"
                aria-hidden="true"
                initial={false}
                transition={
                  reducedMotion !== false
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 440, damping: 36 }
                }
              />
            )}
            <span className="switch-label">{option.label}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
