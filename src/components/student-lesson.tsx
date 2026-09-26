"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Send,
  Lock,
  BookOpen,
} from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "./context";
import { MathText } from "./math-text";
import { api } from "@/lib/client";
import type { LessonView } from "@/lib/types";
import { Loading, ErrorState } from "./portal";
export function Lesson({ id }: { id: string }) {
  const { t, lang, error, notify, date } = useApp();
  const [lesson, setLesson] = useState<LessonView | null>(null),
    [failed, setFailed] = useState(""),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [saving, setSaving] = useState(""),
    [busy, setBusy] = useState(false),
    [active, setActive] = useState(0),
    [dirty, setDirty] = useState(false);
  const requestId = useRef<string | null>(null),
    saveQueue = useRef(Promise.resolve());
  async function load() {
    try {
      const l = await api<LessonView>("lesson", undefined, { id });
      setLesson(l);
      setAnswers(l.homework?.progress?.draft || {});
      setFailed("");
      setDirty(false);
    } catch (e) {
      setFailed(error(e));
    }
  }
  useEffect(() => {
    setLesson(null);
    setActive(0);
    void load();
  }, [id]);
  const hw = lesson?.homework,
    p = hw?.progress,
    used = p?.attemptCount || 0,
    max = (hw?.maxAttempts || 3) + (p?.bonusAttempts || 0),
    finished = !!p?.passedAt || used >= max;
  useEffect(() => {
    if (!dirty || !lesson?.homework || finished || busy) return;
    setSaving("saving");
    const timer = setTimeout(() => {
      const snapshot = { ...answers };
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await api("draft", { lessonId: id, answers: snapshot });
          setSaving("saved");
        } catch {
          setSaving("savedError");
        }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [answers, dirty, finished, id, busy]);
  if (failed) return <ErrorState message={failed} retry={load} />;
  if (!lesson) return <Loading />;
  const answered =
    hw?.questions.filter((q) => answers[q.id]?.trim()).length || 0;
  async function send() {
    if (!hw) return;
    if (answered !== hw.questions.length) {
      notify(t("answerAll"));
      return;
    }
    if (!confirm(t("confirmSubmit"))) return;
    setBusy(true);
    requestId.current ??= crypto.randomUUID();
    try {
      await saveQueue.current;
      await api("submit", {
        lessonId: id,
        answers,
        requestId: requestId.current,
        revision: hw.revision,
      });
      requestId.current = null;
      await load();
      notify(t("submitted"));
    } catch (e) {
      notify(error(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/course" className="back-link">
        <ArrowLeft size={16} />
        {t("back")}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {lesson.courseTitle} · {t("lesson")} {lesson.order}
          </span>
          <h1>{lesson.title}</h1>
        </div>
        <span className="badge available">
          {lesson.language === "ru" ? "РУС" : "ҚАЗ"}
        </span>
      </div>
      <div className="lesson-layout">
        <section className="lesson-main">
          <div className="video-frame">
            <iframe
              src={lesson.videoUrl}
              title={`${t("lesson")} ${lesson.order}: ${lesson.title}`}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="video-caption">
            <span>{t("videoHelp")}</span>
            <a
              href={lesson.videoExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("videoExternal")}
              <ExternalLink size={13} />
            </a>
          </div>
          {lesson.description && (
            <p className="lesson-description">{lesson.description}</p>
          )}
          <div className="viewed-panel">
            <div>
              <h3>{t("viewed")}</h3>
              <p>{t("watchHelp")}</p>
            </div>
            <Button
              variant={lesson.viewed ? "outline" : "default"}
              disabled={lesson.viewed || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("viewed", { lessonId: id });
                  setLesson({ ...lesson, viewed: true });
                } catch (e) {
                  notify(error(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Check size={16} />
              {lesson.viewed ? t("viewed") : t("markViewed")}
            </Button>
          </div>
          <section className="homework-panel" id="homework">
            <div className="section-heading">
              <h2>{t("homework")}</h2>
              {hw && (
                <span className="badge">
                  {used} / {max} {t("attempts").toLowerCase()}
                </span>
              )}
            </div>
            {!hw ? (
              <div className="empty-state">
                <BookOpen />
                <p>{t("homeworkPending")}</p>
              </div>
            ) : (
              <>
                {p?.passedAt && (
                  <div className="result-banner success">
                    <CheckCircle2 />
                    <div>
                      <strong>{t("passed")}</strong>
                      <p>
                        {t("best")}: {p.bestScore}%
                      </p>
                    </div>
                  </div>
                )}
                {!p?.passedAt && used > 0 && (
                  <div className="result-banner">
                    <TargetIcon />
                    <div>
                      <strong>
                        {t("best")}: {p?.bestScore}%
                      </strong>
                      <p>{finished ? t("noAttempts") : t("failed")}</p>
                    </div>
                  </div>
                )}
                {!lesson.viewed && (
                  <div className="notice">
                    <Lock size={16} />
                    {lang === "ru"
                      ? "Сначала изучите видео и отметьте просмотр."
                      : "Алдымен бейнені көріп, белгілеңіз."}
                  </div>
                )}
                <div className="question-navigation">
                  {hw.questions.map((q, i) => (
                    <button
                      key={q.id}
                      onClick={() => setActive(i)}
                      className={`${active === i ? "current" : ""} ${answers[q.id] ? "answered" : ""}`}
                      aria-label={`${t("question")} ${i + 1}: ${answers[q.id] ? t("selected") : t("unanswered")}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                {hw.questions[active] &&
                  (() => {
                    const q = hw.questions[active];
                    return (
                      <div className="question-card">
                        <div className="question-top">
                          <span>
                            {t("question")} {active + 1} / {hw.questions.length}
                          </span>
                          <span className="badge">
                            {t("level")} {q.level}
                          </span>
                        </div>
                        <h3>
                          <MathText text={q.text} />
                        </h3>
                        {q.type === "MULTIPLE_CHOICE" ? (
                          <fieldset
                            disabled={finished || busy || !lesson.viewed}
                          >
                            <legend className="sr-only">{t("options")}</legend>
                            {q.options.map((option, i) => {
                              const code = "ABCDE"[i];
                              return (
                                <label
                                  key={code}
                                  className={`answer-option ${answers[q.id] === code ? "chosen" : ""}`}
                                >
                                  <input
                                    type="radio"
                                    name={q.id}
                                    value={code}
                                    checked={answers[q.id] === code}
                                    onChange={() => {
                                      requestId.current = null;
                                      setAnswers({ ...answers, [q.id]: code });
                                      setDirty(true);
                                    }}
                                  />
                                  <span className="option-letter">{code}</span>
                                  <MathText text={option} />
                                  {answers[q.id] === code && (
                                    <Check size={17} />
                                  )}
                                </label>
                              );
                            })}
                          </fieldset>
                        ) : (
                          <label>
                            {t("answer")}
                            <input
                              disabled={finished || busy || !lesson.viewed}
                              value={answers[q.id] || ""}
                              maxLength={1000}
                              onChange={(e) => {
                                requestId.current = null;
                                setAnswers({
                                  ...answers,
                                  [q.id]: e.target.value,
                                });
                                setDirty(true);
                              }}
                            />
                          </label>
                        )}
                        <div className="question-footer">
                          <Button
                            variant="outline"
                            disabled={active === 0}
                            onClick={() => setActive(active - 1)}
                          >
                            {t("previous")}
                          </Button>
                          <span
                            className={
                              saving === "savedError"
                                ? "error-message"
                                : "muted"
                            }
                            aria-live="polite"
                          >
                            {saving
                              ? t(saving as "saving" | "saved" | "savedError")
                              : ""}
                          </span>
                          <Button
                            variant="outline"
                            disabled={active === hw.questions.length - 1}
                            onClick={() => setActive(active + 1)}
                          >
                            {t("next")}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                {!finished && (
                  <div className="submit-panel">
                    <div>
                      <strong>
                        {answered} / {hw.questions.length}
                      </strong>
                      <span>
                        {t("questions").toLowerCase()} · {t("pass")}{" "}
                        {hw.passingScore}%
                      </span>
                    </div>
                    <Button
                      onClick={send}
                      disabled={
                        busy ||
                        !lesson.viewed ||
                        answered !== hw.questions.length
                      }
                    >
                      <Send size={16} />
                      {busy ? t("submitting") : t("submit")}
                    </Button>
                  </div>
                )}
                {hw.solutions.length > 0 && (
                  <details className="solutions">
                    <summary>{t("solution")}</summary>
                    {hw.solutions.map((s, i) => (
                      <div key={s.id}>
                        <strong>
                          {i + 1}. {t("answer")}: {s.correctAnswer}
                        </strong>
                        {s.explanation && (
                          <p>
                            <MathText text={s.explanation} />
                          </p>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
          </section>
        </section>
        <aside className="lesson-aside">
          <section className="panel">
            <span className="eyebrow">{t("homework")}</span>
            <h3>{t("pass")} ≥ 80%</h3>
            <div className="detail-row">
              <span>{t("questions")}</span>
              <strong>{hw?.questions.length ?? "—"}</strong>
            </div>
            <div className="detail-row">
              <span>{t("attempts")}</span>
              <strong>
                {used} / {max}
              </strong>
            </div>
            <div className="detail-row">
              <span>{t("best")}</span>
              <strong>{p ? `${p.bestScore}%` : "—"}</strong>
            </div>
            {hw?.questions.length === 8 && (
              <p className="muted fine-print">
                {lang === "ru"
                  ? "Для зачёта: 7 из 8 верных ответов (87,5%)."
                  : "Өту үшін: 8 сұрақтың 7-еуіне дұрыс жауап (87,5%)."}
              </p>
            )}
          </section>
          <section className="panel">
            <h3>{t("history")}</h3>
            {hw?.submissions.length ? (
              hw.submissions.map((s) => (
                <div className="history-item" key={s.id}>
                  <div>
                    <strong>
                      {t("attempt")} {s.attempt}
                    </strong>
                    <small>{date(s.createdAt)}</small>
                  </div>
                  <span className={`badge ${s.score >= 80 ? "completed" : ""}`}>
                    {s.earnedPoints}/{s.maxPoints} · {s.score}%
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">{t("noHistory")}</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
function TargetIcon() {
  return <CheckCircle2 />;
}
