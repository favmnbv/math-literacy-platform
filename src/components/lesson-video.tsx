"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize, Minimize } from "lucide-react";
import { useApp } from "./context";
import styles from "./lesson-video.module.css";

export function LessonVideo({
  src,
  externalUrl,
  title,
}: {
  src: string;
  externalUrl: string;
  title: string;
}) {
  const { lang, t } = useApp();
  const player = useRef<HTMLDialogElement>(null);
  const fullscreenRoot = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const ru = lang === "ru";

  useEffect(() => {
    const onFullscreen = () => {
      const element = player.current;
      if (element)
        setExpanded(
          document.fullscreenElement === fullscreenRoot.current ||
            element.matches(":modal"),
        );
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  async function collapse() {
    const element = player.current;
    if (!element) return;
    if (document.fullscreenElement === fullscreenRoot.current)
      await document.exitFullscreen();
    if (element.matches(":modal")) {
      element.close();
      element.show();
    }
    setExpanded(false);
    expandButton.current?.focus({ preventScroll: true });
  }

  async function expand() {
    const element = player.current;
    if (!element || busy) return;
    setBusy(true);
    try {
      if (
        document.fullscreenEnabled &&
        fullscreenRoot.current?.requestFullscreen
      ) {
        try {
          await fullscreenRoot.current.requestFullscreen();
          setExpanded(true);
          return;
        } catch {
          /* Keep the same iframe in a top-layer viewer if fullscreen is unavailable. */
        }
      }
      // showModal escapes transformed ancestors, traps focus and makes the page inert.
      // The iframe is never replaced, so playback is not restarted when expanding.
      element.close();
      element.showModal();
      setExpanded(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={fullscreenRoot} className={styles.wrapper}>
      <dialog
        open
        ref={player}
        className={`${styles.player} ${expanded ? styles.expanded : ""}`}
        aria-label={title}
        onCancel={(event) => {
          event.preventDefault();
          void collapse();
        }}
      >
        <div className={styles.controls}>
          <button
            ref={expandButton}
            type="button"
            disabled={busy}
            aria-expanded={expanded}
            onClick={() => void (expanded ? collapse() : expand())}
          >
            {expanded ? (
              <Minimize size={18} aria-hidden="true" />
            ) : (
              <Maximize size={18} aria-hidden="true" />
            )}
            {expanded
              ? ru
                ? "Свернуть"
                : "Кішірейту"
              : ru
                ? "На весь экран"
                : "Толық экран"}
          </button>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("videoExternal")}
          >
            <ExternalLink size={17} aria-hidden="true" />
            {ru ? "Открыть отдельно" : "Бөлек ашу"}
          </a>
        </div>
        <div className={styles.stage}>
          <iframe
            src={src}
            title={title}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </dialog>
      <p className={styles.help}>{t("videoHelp")}</p>
    </div>
  );
}
