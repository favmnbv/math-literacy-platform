"use client";
import Link from "next/link";
import { BookOpen, Check, Play, PencilLine } from "lucide-react";
import type { LessonCard } from "@/lib/types";
import { useApp } from "./context";
import { Button } from "./ui/button";
import styles from "./dashboard-overview.module.css";

export function DashboardOverview({
  lessons,
  next,
  completed,
  passed,
  viewed,
}: {
  lessons: LessonCard[];
  next: LessonCard | undefined;
  completed: number;
  passed: number;
  viewed: number;
}) {
  const { lang, t } = useApp();
  const ru = lang === "ru";
  const allDone = lessons.length > 0 && completed === lessons.length;
  return (
    <section className={styles.overview} aria-label={t("continue")}>
      <div className={styles.currentLesson}>
        <div className={styles.lessonHeading}>
          <h2>{t("continue")}</h2>
          {next && (
            <span>
              {t("lesson")} {String(next.order).padStart(2, "0")}
            </span>
          )}
        </div>
        <h3
          className={`${styles.topic} ${(next?.title.length || 0) > 70 ? styles.longTopic : ""}`}
        >
          {next?.title ||
            (allDone
              ? ru
                ? "Программа пройдена"
                : "Бағдарлама аяқталды"
              : ru
                ? "Следующий урок ещё не открыт"
                : "Келесі сабақ әлі ашылған жоқ")}
        </h3>
        {next ? (
          <>
            <div className={styles.lessonSteps}>
              <div className={next.viewed ? styles.done : undefined}>
                <span className={styles.stepIcon}>
                  {next.viewed ? <Check size={17} /> : <Play size={17} />}
                </span>
                <span>
                  {next.viewed
                    ? t("viewed")
                    : ru
                      ? "Посмотрите видео"
                      : "Бейнені көріңіз"}
                </span>
              </div>
              <span className={styles.stepLine} aria-hidden="true" />
              <div>
                <span className={styles.stepIcon}>
                  <PencilLine size={17} />
                </span>
                <span>
                  {next.hasHomework
                    ? ru
                      ? "Закрепите тему в ДЗ"
                      : "Тақырыпты тапсырмамен бекітіңіз"
                    : t("homeworkPending")}
                </span>
              </div>
            </div>
            <div className={styles.lessonAction}>
              <Button asChild>
                <Link href={`/course/${next.id}`}>
                  <Play size={15} />
                  {t("start")}
                </Link>
              </Button>
              {next.hasHomework && (
                <span>
                  {ru
                    ? "Для зачёта ДЗ — от 80%"
                    : "Үй тапсырмасын өту үшін — 80%-дан"}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className={styles.emptyCopy}>
            {allDone
              ? ru
                ? "Все уроки завершены. Материалы остаются доступны для повторения."
                : "Барлық сабақ аяқталды. Материалдар қайталау үшін қолжетімді."
              : ru
                ? "Даты открытия указаны в программе ниже."
                : "Ашылу күндері төмендегі бағдарламада көрсетілген."}
          </p>
        )}
        <span className={styles.pageEdge} aria-hidden="true" />
      </div>
      <aside
        className={styles.progress}
        aria-labelledby="overview-progress-title"
      >
        <div className={styles.progressHeading}>
          <BookOpen size={17} />
          <h2 id="overview-progress-title">
            {ru ? "Ваше продвижение" : "Сіздің жетістігіңіз"}
          </h2>
        </div>
        <p className={styles.completionLine}>
          {ru ? "Завершено уроков" : "Аяқталған сабақтар"}
          <strong>
            {completed}
            <span> / {lessons.length}</span>
          </strong>
        </p>
        <div
          className={styles.courseMarks}
          role="img"
          aria-label={`${t("completeCount")}: ${completed} / ${lessons.length}`}
        >
          {lessons.map((lesson) => (
            <span
              key={lesson.id}
              className={
                lesson.state === "COMPLETED" ? styles.completeMark : undefined
              }
              aria-hidden="true"
            />
          ))}
        </div>
        <dl className={styles.progressLedger}>
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
        </dl>
        <p className={styles.progressNote}>
          {ru
            ? "Урок завершён, когда просмотрено видео и зачтено ДЗ."
            : "Бейне қаралып, үй тапсырмасы өткенде сабақ аяқталады."}
        </p>
      </aside>
    </section>
  );
}
