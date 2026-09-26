"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LessonCard } from "@/lib/types";
import { useApp } from "./context";
import { usePrefersReducedMotion } from "./ui/use-prefers-reduced-motion";
import styles from "./course-progress.module.css";

export function CourseProgress({ lessons }: { lessons: LessonCard[] }) {
  const { lang, t, date } = useApp();
  const reducedMotion = usePrefersReducedMotion();
  const tooltipId = useId();
  const root = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [tabStop, setTabStop] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const active = dismissed ? null : (hovered ?? focused);
  const selected = active === null ? undefined : lessons[active];

  useLayoutEffect(() => {
    if (!selected) return;
    function position() {
      if (root.current && detail.current)
        setBelow(
          root.current.getBoundingClientRect().top <
            detail.current.offsetHeight + 16,
        );
    }
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [selected, lang]);

  function status(lesson: LessonCard) {
    if (lesson.state === "COMPLETED") return t("completed");
    if (lesson.state === "PENDING") return t("materialPending");
    if (lesson.state === "LOCKED")
      return `${t("locked")}${lesson.opensAt ? ` ${date(lesson.opensAt)}` : ""}`;
    return t(lesson.state === "IN_PROGRESS" ? "inProgress" : "available");
  }

  return (
    <div className={styles.root} ref={root}>
      <div
        className={styles.scale}
        role="toolbar"
        aria-label={
          lang === "ru" ? "Прогресс по урокам" : "Сабақтар бойынша жетістік"
        }
        onPointerLeave={() => setHovered(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setFocused(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDismissed(true);
            return;
          }
          const index = focused ?? tabStop;
          const next =
            event.key === "ArrowRight"
              ? Math.min(index + 1, lessons.length - 1)
              : event.key === "ArrowLeft"
                ? Math.max(index - 1, 0)
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? lessons.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            setHovered(null);
            buttons.current[next]?.focus();
          }
        }}
      >
        {lessons.map((lesson, index) => {
          const complete = lesson.state === "COMPLETED";
          const distance =
            active === null ? Infinity : Math.abs(index - active);
          const height = Math.max(
            complete ? 26 : 12,
            distance === 0
              ? 38
              : distance === 1
                ? 28
                : distance === 2
                  ? 19
                  : 12,
          );
          return (
            <button
              key={lesson.id}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              className={styles.mark}
              data-complete={complete}
              data-active={active === index}
              tabIndex={tabStop === index ? 0 : -1}
              aria-label={`${t("lesson")} ${lesson.order}. ${lesson.title}. ${status(lesson)}`}
              onPointerEnter={() => {
                setHovered(index);
                setDismissed(false);
              }}
              onFocus={() => {
                setFocused(index);
                setTabStop(index);
                setDismissed(false);
              }}
              onClick={() => {
                setFocused(index);
                setTabStop(index);
                setDismissed(false);
              }}
            >
              <motion.span
                aria-hidden="true"
                initial={false}
                animate={{ height }}
                transition={
                  reducedMotion !== false
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 480, damping: 30 }
                }
              />
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            id={tooltipId}
            ref={detail}
            data-below={below}
            role="tooltip"
            className={styles.detail}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : 3 }}
            transition={{ duration: reducedMotion !== false ? 0 : 0.12 }}
          >
            <span>
              {t("lesson")} {selected.order}
            </span>
            <strong>{selected.title}</strong>
            <span data-complete={selected.state === "COMPLETED"}>
              {status(selected)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
