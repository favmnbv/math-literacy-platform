"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Users,
  Video,
} from "lucide-react";
import type { Overview } from "@/lib/types";
import { useApp } from "./context";
import styles from "./admin-overview.module.css";

type AdminLesson = Overview["lessons"][number];

export function AdminOverview({
  data,
  curator = false,
}: {
  data: Overview;
  curator?: boolean;
}) {
  const { t, lang } = useApp();
  const ru = lang === "ru";
  const missingVideos = data.lessons.filter((lesson) => !lesson.videoId);
  const metrics = [
    { label: t("totalStudents"), value: data.students },
    { label: t("activeStudents"), value: data.active },
    { label: t("submissions"), value: data.submissions },
    {
      label: t("averageScore"),
      value:
        data.averageScore === null ? "—" : `${Math.round(data.averageScore)}%`,
    },
  ];

  return (
    <div className={styles.overview}>
      <header className={styles.heading}>
        <h1>{ru ? "Учебный центр" : "Оқу орталығы"}</h1>
        <p>
          {curator
            ? ru
              ? "Ваши ученики и их результаты. Материалы программ доступны для редактирования."
              : "Сізге бекітілген оқушылар мен олардың нәтижелері. Бағдарлама материалдарын өңдеуге болады."
            : ru
              ? "Ученики, результаты и материалы двух программ."
              : "Оқушылар, нәтижелер және екі бағдарламаның материалдары."}
        </p>
      </header>
      <dl className={styles.metrics}>
        {metrics.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.layout}>
        <section aria-labelledby="programs-heading" className={styles.programs}>
          <div className={styles.sectionHeading}>
            <h2 id="programs-heading">
              {ru ? "Программы курса" : "Курс бағдарламалары"}
            </h2>
            <Link href="/admin/course">
              {ru ? "Все уроки" : "Барлық сабақтар"}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <p className={styles.intro}>
            {ru
              ? "Видео и опубликованные домашние задания. Раскройте программу, чтобы перейти к редактированию урока."
              : "Бейнематериалдар мен жарияланған үй тапсырмалары. Сабақты өңдеу үшін бағдарламаны ашыңыз."}
          </p>
          {data.courses.length === 0 && (
            <p className={styles.empty}>
              {ru
                ? "Программы ещё не добавлены."
                : "Бағдарламалар әлі қосылмаған."}
            </p>
          )}
          {data.courses.map((course) => (
            <CourseRegister
              key={course.id}
              course={course}
              lessons={data.lessons.filter(
                (lesson) => lesson.courseId === course.id,
              )}
            />
          ))}
        </section>
        <aside className={styles.aside}>
          <nav
            aria-label={ru ? "Управление центром" : "Орталықты басқару"}
            className={styles.management}
          >
            <h2>{ru ? "Управление" : "Басқару"}</h2>
            <Link href="/admin/students">
              <Users size={19} aria-hidden="true" />
              <span>
                <strong>{t("students")}</strong>
                <small>
                  {ru
                    ? "Аккаунты, доступ и результаты"
                    : "Аккаунттар, қолжетімділік және нәтижелер"}
                </small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/admin/groups">
              <CalendarDays size={19} aria-hidden="true" />
              <span>
                <strong>{t("groups")}</strong>
                <small>
                  {ru
                    ? "Состав групп и даты старта"
                    : "Топ құрамы және басталу күндері"}
                </small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </nav>
          <section
            className={styles.pending}
            aria-labelledby="missing-video-heading"
          >
            <div className={styles.pendingHeading}>
              <Video size={18} aria-hidden="true" />
              <h2 id="missing-video-heading">
                {ru ? "Без видео" : "Бейнесіз сабақтар"}
              </h2>
              <span>{missingVideos.length}</span>
            </div>
            {missingVideos.length === 0 ? (
              <p>
                {data.lessons.length === 0
                  ? ru
                    ? "Уроки ещё не добавлены."
                    : "Сабақтар әлі қосылмаған."
                  : ru
                    ? "Видео добавлены ко всем урокам."
                    : "Барлық сабақтарға бейнематериал қосылған."}
              </p>
            ) : (
              <>
                <p>
                  {ru
                    ? "Добавьте ссылку в редакторе, когда материал будет готов."
                    : "Материал дайын болғанда, редакторға сілтеме қосыңыз."}
                </p>
                <ul>
                  {missingVideos.map((lesson) => (
                    <li key={lesson.id}>
                      <Link href={`/admin/lesson/${lesson.id}`}>
                        <small>
                          {
                            data.courses.find(
                              (course) => course.id === lesson.courseId,
                            )?.title
                          }{" "}
                          / {t("lesson")} {lesson.order}
                        </small>
                        <span>
                          {lesson.title}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function CourseRegister({
  course,
  lessons,
}: {
  course: Overview["courses"][number];
  lessons: AdminLesson[];
}) {
  const { t, lang } = useApp();
  const ru = lang === "ru";
  const videos = lessons.filter((lesson) => lesson.videoId).length;
  const homeworks = lessons.filter(
    (lesson) => lesson.homework?.status === "PUBLISHED",
  ).length;
  return (
    <details className={styles.course}>
      <summary>
        <div className={styles.courseHeading}>
          <h3>{course.title}</h3>
          <ChevronDown
            className={styles.chevron}
            size={20}
            aria-hidden="true"
          />
        </div>
        <div className={styles.coverage}>
          <MaterialCount
            label={ru ? "Видео добавлено" : "Қосылған бейне"}
            count={videos}
            total={lessons.length}
          />
          <MaterialCount
            label={ru ? "ДЗ опубликовано" : "Жарияланған ҮТ"}
            count={homeworks}
            total={lessons.length}
          />
        </div>
        <span className={styles.disclosure}>
          <span className={styles.showLabel}>
            {ru ? "Показать уроки" : "Сабақтарды көрсету"}
          </span>
          <span className={styles.hideLabel}>
            {ru ? "Свернуть уроки" : "Сабақтарды жасыру"}
          </span>
          <span>{lessons.length}</span>
        </span>
      </summary>
      <div className={styles.lessonList}>
        {lessons.length === 0 ? (
          <p className={styles.empty}>
            {ru
              ? "В программе пока нет уроков."
              : "Бағдарламада әзірге сабақтар жоқ."}
          </p>
        ) : (
          <table>
            <caption className={styles.srOnly}>
              {course.title}: {t("lessons")}
            </caption>
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">{t("lesson")}</th>
                <th scope="col">{t("homework")}</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id}>
                  <td className={styles.order}>{lesson.order}</td>
                  <td>
                    <Link
                      className={styles.lessonLink}
                      href={`/admin/lesson/${lesson.id}`}
                    >
                      {lesson.title}
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                    <div className={styles.lessonMeta}>
                      <span>
                        {lesson.status === "PUBLISHED"
                          ? t("published")
                          : t("draft")}
                      </span>
                      {!lesson.videoId && (
                        <span>{ru ? "Без видео" : "Бейнесіз"}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.homework}>
                    {lesson.homework ? (
                      <>
                        <span>
                          {lesson.homework.status === "PUBLISHED"
                            ? t("published")
                            : t("draft")}
                        </span>
                        <small>
                          {t("questions")}: {lesson.homework._count.questions}
                        </small>
                      </>
                    ) : (
                      <span className={styles.absent}>
                        {ru ? "Не добавлено" : "Қосылмаған"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

function MaterialCount({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <div className={styles.material}>
      <div>
        <span>{label}</span>
        <strong>
          {count}
          <span> / {total}</span>
        </strong>
      </div>
      <progress aria-label={label} value={count} max={total || 1} />
    </div>
  );
}
