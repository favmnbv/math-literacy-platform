"use client";

import Link from "next/link";
import { Check, ChevronRight, Lock } from "lucide-react";
import type { LessonCard } from "@/lib/types";
import { useApp } from "./context";
import { CourseProgress } from "./course-progress";
import styles from "./student-progress.module.css";

export function ProgressSummary({
  lessons,
  completed,
  viewed,
  passed,
}: {
  lessons: LessonCard[];
  completed: number;
  viewed: number;
  passed: number;
}) {
  const { lang, t } = useApp();
  const ru = lang === "ru";
  return (
    <section className={styles.summary} aria-label={t("progress")}>
      <div className={styles.courseTrail}>
        <h2>
          {ru
            ? `Завершено ${completed} из ${lessons.length} уроков`
            : `${lessons.length} сабақтың ${completed}-і аяқталды`}
        </h2>
        <p>
          {ru
            ? "Просмотрите видео и сдайте домашнее задание, чтобы завершить урок."
            : "Сабақты аяқтау үшін бейнені көріп, үй тапсырмасын тапсырыңыз."}
        </p>
        <CourseProgress lessons={lessons} />
        <span className={styles.scaleHint}>
          {ru
            ? "Каждое деление — урок. Нажмите, чтобы перейти."
            : "Әр бөлік — бір сабақ. Өту үшін басыңыз."}
        </span>
      </div>
      <dl className={styles.totals}>
        <div>
          <dt>{t("viewCount")}</dt>
          <dd>
            {viewed}
            <span> / {lessons.length}</span>
          </dd>
        </div>
        <div>
          <dt>{t("passedCount")}</dt>
          <dd>
            {passed}
            <span> / {lessons.length}</span>
          </dd>
        </div>
        <div>
          <dt>{t("pass")}</dt>
          <dd>
            80<span>%</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ProgressLessonRow({ lesson }: { lesson: LessonCard }) {
  const { lang, t, date } = useApp();
  const ru = lang === "ru";
  const accessible = ["AVAILABLE", "IN_PROGRESS", "COMPLETED"].includes(
    lesson.state,
  );
  const hasResult = lesson.attempts > 0 && lesson.bestScore !== null;
  const passed = hasResult && lesson.bestScore! >= 80;
  const state =
    lesson.state === "LOCKED"
      ? `${t("locked")}${lesson.opensAt ? ` ${date(lesson.opensAt)}` : ""}`
      : lesson.state === "PENDING"
        ? t("materialPending")
        : lesson.state === "COMPLETED"
          ? t("completed")
          : lesson.state === "IN_PROGRESS"
            ? t("inProgress")
            : t("available");
  const homework = !lesson.hasHomework
    ? ru
      ? "Готовится"
      : "Дайындалуда"
    : passed
      ? ru
        ? "Зачтено"
        : "Өтті"
      : hasResult
        ? ru
          ? "Ниже 80%"
          : "80%-дан төмен"
        : ru
          ? "Не сдано"
          : "Тапсырылмады";
  const content = (
    <>
      <div className={styles.lessonInfo}>
        <span className={styles.number}>
          {String(lesson.order).padStart(2, "0")}
        </span>
        <div>
          <h3>{lesson.title}</h3>
          <p
            className={
              lesson.state === "COMPLETED" ? styles.complete : undefined
            }
          >
            {lesson.state === "COMPLETED" ? (
              <Check size={13} aria-hidden="true" />
            ) : !accessible ? (
              <Lock size={13} aria-hidden="true" />
            ) : null}
            {state}
          </p>
        </div>
      </div>
      <dl className={styles.lessonData}>
        <div>
          <dt>{ru ? "Видео" : "Бейне"}</dt>
          <dd className={lesson.viewed ? styles.complete : undefined}>
            {lesson.viewed && <Check size={13} aria-hidden="true" />}
            {lesson.viewed
              ? ru
                ? "Просмотрено"
                : "Қаралды"
              : ru
                ? "Не просмотрено"
                : "Қаралмаған"}
          </dd>
        </div>
        <div>
          <dt>{ru ? "Домашнее задание" : "Үй тапсырмасы"}</dt>
          <dd
            className={
              passed && lesson.hasHomework
                ? styles.complete
                : hasResult && lesson.hasHomework
                  ? styles.retry
                  : undefined
            }
          >
            {homework}
          </dd>
        </div>
        <div>
          <dt>{ru ? "Использовано попыток" : "Қолданылған әрекеттер"}</dt>
          <dd>{lesson.attempts}</dd>
        </div>
        <div>
          <dt>{t("best")}</dt>
          <dd>
            {hasResult ? (
              <span
                className={`${styles.score} ${passed ? styles.passedScore : styles.retryScore}`}
              >
                {lesson.bestScore}%
              </span>
            ) : (
              <span aria-label={ru ? "Результата пока нет" : "Нәтиже әлі жоқ"}>
                —
              </span>
            )}
          </dd>
        </div>
      </dl>
      {accessible && (
        <ChevronRight
          className={styles.openIcon}
          size={16}
          aria-hidden="true"
        />
      )}
    </>
  );
  return accessible ? (
    <Link href={`/course/${lesson.id}`} className={`lesson-row ${styles.row}`}>
      {content}
    </Link>
  ) : (
    <div className={`lesson-row ${styles.row}`} aria-disabled="true">
      {content}
    </div>
  );
}
