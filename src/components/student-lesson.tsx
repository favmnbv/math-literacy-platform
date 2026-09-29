"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Send,
  Lock,
  BookOpen,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { SubmitDialog } from "./ui/submit-dialog";
import { HomeworkResult } from "./homework-result";
import { LessonVideo } from "./lesson-video";
import { useApp } from "./context";
import { MathText } from "./math-text";
import { api } from "@/lib/client";
import type { LessonView, SubmissionView } from "@/lib/types";
import { Loading, ErrorState } from "./portal";
import { usePrefersReducedMotion } from "./ui/use-prefers-reduced-motion";
import styles from "./student-lesson.module.css";

export function Lesson({ id }: { id: string }) {
  const { t, lang, error, notify, date } = useApp();
  const reduced = usePrefersReducedMotion();
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [failed, setFailed] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [review, setReview] = useState<SubmissionView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [inlineError, setInlineError] = useState("");
  const requestId = useRef<string | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const homeworkRef = useRef<HTMLElement>(null);
  const submitting = useRef(false);
  const saveVersion = useRef(0);
  const hw = lesson?.homework;
  const p = hw?.progress;
  const used = p?.attemptCount || 0;
  const max = (hw?.maxAttempts || 3) + (p?.bonusAttempts || 0);
  const finished = !!p?.passedAt || used >= max;

  async function load() {
    try {
      const data = await api<LessonView>("lesson", undefined, { id });
      setLesson(data);
      setAnswers(data.homework?.progress?.draft || {});
      setReview(data.homework?.submissions[0] || null);
      setFailed("");
      setDirty(false);
    } catch (e) {
      setFailed(error(e));
    }
  }
  useEffect(() => {
    setLesson(null);
    setActive(0);
    setReview(null);
    requestId.current = null;
    void load();
  }, [id]);
  useEffect(() => {
    if (!dirty || !lesson?.viewed || !hw || finished || busy || review) return;
    const version = ++saveVersion.current;
    setSaving("saving");
    const timer = setTimeout(() => {
      const snapshot = { ...answers };
      saveQueue.current = saveQueue.current.then(async () => {
        try {
          await api("draft", { lessonId: id, answers: snapshot });
          if (saveVersion.current === version) setSaving("saved");
        } catch {
          if (saveVersion.current === version) setSaving("savedError");
        }
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [answers, dirty, finished, id, busy, review, lesson?.viewed]);

  function focusHomework(result = false) {
    requestAnimationFrame(() => {
      homeworkRef.current?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
      const heading = homeworkRef.current?.querySelector<HTMLElement>(
        result ? "#result-title" : "#homework-title",
      );
      heading?.focus({ preventScroll: true });
    });
  }
  async function send() {
    if (!hw || !lesson || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setInlineError("");
    requestId.current ??= crypto.randomUUID();
    try {
      await saveQueue.current;
      const result = await api<SubmissionView>("submit", {
        lessonId: id,
        answers,
        requestId: requestId.current,
        revision: hw.revision,
      });
      const passed =
        result.earnedPoints * 100 >= result.maxPoints * hw.passingScore;
      setLesson({
        ...lesson,
        homework: {
          ...hw,
          submissions: [
            result,
            ...hw.submissions.filter((s) => s.id !== result.id),
          ],
          progress: {
            draft: answers,
            attemptCount: result.attempt,
            bonusAttempts: p?.bonusAttempts || 0,
            bestScore: Math.max(p?.bestScore || 0, result.score),
            passedAt: passed ? result.createdAt : p?.passedAt || null,
          },
        },
      });
      setDirty(false);
      setReview(result);
      setSaving("");
      requestId.current = null;
      focusHomework(true);
    } catch (e) {
      setInlineError(error(e));
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  if (failed) return <ErrorState message={failed} retry={load} />;
  if (!lesson) return <Loading />;
  const answered =
    hw?.questions.filter((q) => answers[q.id]?.trim()).length || 0;
  const q = hw?.questions[active];
  const ru = lang === "ru";
  return (
    <article className={styles.page}>
      <Link href="/course" className="back-link">
        <ArrowLeft size={16} />
        {t("back")}
      </Link>
      <header className={styles.heading}>
        <div>
          <p className={styles.courseName}>{lesson.courseTitle}</p>
          <h1>{lesson.title}</h1>
        </div>
        <div className={styles.lessonIdentity}>
          <span>
            {t("lesson")} {String(lesson.order).padStart(2, "0")}
          </span>
          <span>{lesson.language === "ru" ? "РУС" : "ҚАЗ"}</span>
        </div>
      </header>
      <div className="lesson-flow">
        <h2 id="video-title" className={styles.videoTitle}>
          {ru ? "Видеоурок" : "Бейнесабақ"}
        </h2>
        <section
          className={`lesson-video-section ${styles.videoLayout}`}
          aria-labelledby="video-title"
        >
          <div className={styles.videoContent}>
            <LessonVideo
              src={lesson.videoUrl}
              externalUrl={lesson.videoExternalUrl}
              title={`${t("lesson")} ${lesson.order}: ${lesson.title}`}
            />
            {lesson.description && (
              <p className="lesson-description">{lesson.description}</p>
            )}
          </div>
          <div className={`viewed-panel ${lesson.viewed ? "is-viewed" : ""}`}>
            <div>
              <h3>
                {lesson.viewed
                  ? t("viewed")
                  : ru
                    ? "Сначала — видеоурок"
                    : "Алдымен — бейнесабақ"}
              </h3>
              <p>
                {lesson.viewed
                  ? !hw
                    ? t("homeworkPending")
                    : p?.passedAt
                      ? ru
                        ? "Задание уже зачтено. Результат сохранён ниже."
                        : "Тапсырма өтті. Нәтижесі төменде сақталған."
                      : ru
                        ? "Домашнее задание открыто. Можно приступать."
                        : "Үй тапсырмасы ашылды. Бастауға болады."
                  : t("watchHelp")}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy || lesson.viewed}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("viewed", { lessonId: id });
                  await load();
                  focusHomework();
                } catch (e) {
                  notify(error(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && !lesson.viewed ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
              {lesson.viewed ? t("viewed") : t("markViewed")}
            </Button>
            {lesson.viewed && hw && (
              <a href="#homework" className={styles.practiceLink}>
                {ru ? "Перейти к заданию" : "Тапсырмаға өту"}
                <ArrowRight size={15} />
              </a>
            )}
          </div>
        </section>
        <section className="homework-panel" id="homework" ref={homeworkRef}>
          <div className="section-heading homework-heading">
            <div>
              <h2 id="homework-title" tabIndex={-1}>
                {t("homework")}
              </h2>
            </div>
            {hw && (
              <span className="badge">
                {t("attempts")}: {used} / {max}
              </span>
            )}
          </div>
          {!hw ? (
            <div className="empty-state">
              <BookOpen />
              <p>{t("homeworkPending")}</p>
            </div>
          ) : !lesson.viewed ? (
            <div className="homework-locked">
              <span className="locked-icon">
                <Lock size={21} />
              </span>
              <h3>
                {ru
                  ? "Задание откроется после просмотра"
                  : "Тапсырма бейнені көргеннен кейін ашылады"}
              </h3>
              <p>
                {ru
                  ? "Посмотрите урок и нажмите «Я посмотрел(а) урок» над этим блоком."
                  : "Сабақты көріп, осы бөлімнің үстіндегі «Сабақты көрдім» батырмасын басыңыз."}
              </p>
              <div className="homework-meta">
                <span>
                  {hw.questionCount} {t("questions").toLowerCase()}
                </span>
                <span>
                  {t("pass")} ≥ {hw.passingScore}%
                </span>
                <span>
                  {max} {t("attempts").toLowerCase()}
                </span>
              </div>
            </div>
          ) : (
            <>
              {review ? (
                <HomeworkResult
                  key={review.id}
                  submission={review}
                  questions={hw.questions}
                  passingScore={hw.passingScore}
                  remaining={Math.max(0, max - used)}
                  finished={finished}
                  onRetry={() => {
                    setReview(null);
                    setActive(0);
                    setInlineError("");
                    setSaving("");
                    focusHomework();
                  }}
                />
              ) : (
                <>
                  <div className="homework-meta">
                    <span>
                      {hw.questionCount} {t("questions").toLowerCase()}
                    </span>
                    <span>
                      {t("pass")} ≥ {hw.passingScore}%
                    </span>
                    <span>
                      {t("attempt")} {Math.min(used + 1, max)} / {max}
                    </span>
                  </div>
                  <div className={styles.worksheet}>
                    <div className={styles.questionMap}>
                      <h3>{ru ? "Вопросы" : "Сұрақтар"}</h3>
                      <div
                        className="question-navigation"
                        role="group"
                        aria-label={
                          ru
                            ? "Навигация по вопросам"
                            : "Сұрақтар бойынша шарлау"
                        }
                      >
                        {hw.questions.map((question, i) => (
                          <button
                            key={question.id}
                            onClick={() => setActive(i)}
                            aria-current={active === i ? "step" : undefined}
                            className={`${active === i ? "current" : ""} ${answers[question.id] ? "answered" : ""}`}
                            aria-label={`${t("question")} ${i + 1}: ${answers[question.id] ? t("selected") : t("unanswered")}`}
                          >
                            {i + 1}
                            {answers[question.id] && (
                              <span className="answer-dot" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    {q && (
                      <motion.div
                        key={q.id}
                        className="question-card"
                        initial={{
                          opacity: reduced ? 1 : 0.65,
                          y: reduced ? 0 : 3,
                        }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduced ? 0 : 0.16 }}
                      >
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
                          <fieldset disabled={finished || busy}>
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
                              disabled={finished || busy}
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
                            <ArrowLeft size={14} />
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
                            <ArrowRight size={14} />
                          </Button>
                        </div>
                      </motion.div>
                    )}
                    {!finished && (
                      <div className="submit-panel">
                        <div>
                          <strong>
                            {answered} / {hw.questions.length}
                          </strong>
                          <span>
                            {ru ? "ответов заполнено" : "жауап толтырылды"}
                          </span>
                        </div>
                        <Button
                          onClick={() => setConfirming(true)}
                          disabled={busy || answered !== hw.questions.length}
                        >
                          {busy ? (
                            <LoaderCircle size={16} className="spin" />
                          ) : (
                            <Send size={16} />
                          )}
                          {busy ? t("submitting") : t("submit")}
                        </Button>
                      </div>
                    )}
                    {inlineError && (
                      <p className="error-message" role="alert">
                        {inlineError}
                      </p>
                    )}
                  </div>
                </>
              )}
              {hw.submissions.length > 0 && (
                <section className="attempt-history">
                  <h3>{t("history")}</h3>
                  <div>
                    {hw.submissions.map((s) => (
                      <button
                        key={s.id}
                        className={`attempt-link ${review?.id === s.id ? "active" : ""}`}
                        onClick={() => {
                          setReview(s);
                          focusHomework(true);
                        }}
                      >
                        <span>
                          {t("attempt")} {s.attempt}
                          <small>{date(s.createdAt)}</small>
                        </span>
                        <strong>
                          {s.earnedPoints}/{s.maxPoints}
                        </strong>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
      <SubmitDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => void send()}
        attempt={used + 1}
        max={max}
      />
    </article>
  );
}
