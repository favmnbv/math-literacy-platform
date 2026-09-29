"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Moon,
  Play,
  Search,
  Sun,
  Target,
  UserRound,
  Users,
  Video,
  X,
  ChartNoAxesCombined,
  CalendarDays,
} from "lucide-react";
import { Button } from "./ui/button";
import { SlidingSwitch } from "./ui/sliding-switch";
import { useContentTransition } from "./ui/use-content-transition";
import { AppContext, useApp } from "./context";
import { api } from "@/lib/client";
import type { CourseView, Me, LessonCard } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { Lesson } from "./student-lesson";
import { Admin } from "./admin";
import { DashboardOverview } from "./dashboard-overview";
import { Profile } from "./profile-screen";
import { LoginScreen } from "./login-screen";
import overviewStyles from "./dashboard-overview.module.css";
import { ProgressSummary, ProgressLessonRow } from "./student-progress";
import progressStyles from "./student-progress.module.css";

export function Portal() {
  const pathname = usePathname(),
    router = useRouter();
  const [lang, setLang] = useState<Lang>("ru"),
    [dark, setDark] = useState(false),
    [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("talan-language");
    if (stored === "ru" || stored === "kk") setLang(stored);
    setDark(localStorage.getItem("talan-theme") === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.lang = lang;
  }, [dark, lang]);
  useEffect(() => {
    let cancelled = false;
    api<Me>("me")
      .then((u) => {
        if (cancelled) return;
        setMe(u);
        if (u.mustChangePassword) router.replace("/profile");
        else if (
          pathname === "/" ||
          pathname === "/login" ||
          (pathname === "/dashboard" && isAdmin(u.role))
        )
          router.replace(isAdmin(u.role) ? "/admin" : "/dashboard");
      })
      .catch(() => {
        if (cancelled) return;
        setMe(null);
        if (pathname !== "/login") router.replace("/login");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  function changeLang(value: Lang) {
    setLang(value);
    localStorage.setItem("talan-language", value);
  }
  function changeTheme() {
    setDark(!dark);
    localStorage.setItem("talan-theme", dark ? "light" : "dark");
  }
  return (
    <AppContext.Provider value={{ lang, notify: setNotice }}>
      <Shell
        me={me}
        loading={loading}
        pathname={pathname}
        menu={menu}
        setMenu={setMenu}
        lang={lang}
        dark={dark}
        changeLang={changeLang}
        changeTheme={changeTheme}
        onRefresh={() => api<Me>("me").then(setMe)}
      />
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Закрыть / Жабу" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
type ShellProps = {
  me: Me | null;
  loading: boolean;
  pathname: string;
  menu: boolean;
  setMenu: (v: boolean) => void;
  lang: Lang;
  dark: boolean;
  changeLang: (v: Lang) => void;
  changeTheme: () => void;
  onRefresh: () => void;
};
function Shell(p: ShellProps) {
  const { t, notify, error } = useApp();
  const router = useRouter();
  const contentTransition = useContentTransition(`${p.pathname}:${p.lang}`);
  const controls = (
    <div className="preferences">
      <SlidingSwitch
        className="language-switch"
        label={t("language")}
        value={p.lang}
        onChange={p.changeLang}
        options={[
          { value: "ru", label: "РУС" },
          { value: "kk", label: "ҚАЗ" },
        ]}
      />
      <button
        className="icon-button"
        aria-label={p.dark ? t("light") : t("dark")}
        onClick={p.changeTheme}
      >
        {p.dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </div>
  );
  const admin = isAdmin(p.me?.role);
  const links = admin
    ? [
        { href: "/admin", icon: LayoutDashboard, label: t("dashboard") },
        { href: "/admin/students", icon: Users, label: t("students") },
        { href: "/admin/groups", icon: CalendarDays, label: t("groups") },
        { href: "/admin/course", icon: BookOpen, label: t("lessons") },
        ...(isSuperAdmin(p.me?.role)
          ? [
              {
                href: "/admin/staff",
                icon: Users,
                label: p.lang === "ru" ? "Администраторы" : "Әкімшілер",
              },
            ]
          : []),
        { href: "/profile", icon: UserRound, label: t("profile") },
      ]
    : [
        { href: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
        { href: "/course", icon: BookOpen, label: t("course") },
        { href: "/progress", icon: ChartNoAxesCombined, label: t("progress") },
        { href: "/profile", icon: UserRound, label: t("profile") },
      ];
  if (!p.me) return <LoginScreen controls={controls} loading={p.loading} />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${p.menu ? "is-open" : ""}`}>
        <Link href={admin ? "/admin" : "/dashboard"} className="brand-lockup">
          <img src="/talan-logo.png" alt="" />
          <div>
            <strong>TALAN</strong>
            <span>{t("center")}</span>
          </div>
        </Link>
        <div className="sidebar-caption">
          {admin ? t("admin") : t("welcome")}
        </div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.href}
              onClick={() => p.setMenu(false)}
              href={l.href}
              className={
                p.pathname === l.href ||
                (l.href === "/course" && p.pathname.startsWith("/course/")) ||
                (l.href === "/admin/course" &&
                  p.pathname.startsWith("/admin/lesson/"))
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <l.icon size={19} />
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <GraduationCap size={24} />
            <p>{t("support")}</p>
          </div>
          <button
            className="nav-link"
            onClick={async () => {
              try {
                const r = await fetch("/api/auth/sign-out", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!r.ok) throw new Error();
                window.location.assign("/login");
              } catch (e) {
                notify(error(e));
              }
            }}
          >
            <LogOut size={18} />
            {t("logout")}
          </button>
          <div className="user-card">
            <span className="avatar">{p.me.name[0]}</span>
            <div>
              <strong>{p.me.name}</strong>
              <small>{p.me.username}</small>
            </div>
          </div>
        </div>
      </aside>
      {p.menu && (
        <button
          className="mobile-scrim"
          aria-label={t("close")}
          onClick={() => p.setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Меню / Мәзір"
            onClick={() => p.setMenu(!p.menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            {admin ? t("admin") : t("welcome")}
            <ChevronRight size={14} />
            <strong>
              {p.pathname === "/profile"
                ? t("profile")
                : p.pathname.startsWith("/course/")
                  ? t("lesson")
                  : admin
                    ? "TALAN"
                    : t("course")}
            </strong>
          </div>
          {controls}
        </header>
        <motion.main
          className="main-content"
          initial={false}
          animate={contentTransition}
        >
          {p.loading ? (
            <Loading />
          ) : p.pathname === "/profile" ? (
            <Profile me={p.me} onRefresh={p.onRefresh} />
          ) : p.me.mustChangePassword ? (
            <Profile me={p.me} onRefresh={p.onRefresh} />
          ) : p.pathname.startsWith("/admin") ? (
            admin ? (
              <Admin pathname={p.pathname} me={p.me} />
            ) : (
              <ErrorState
                message={t("loginError")}
                retry={() => router.push("/dashboard")}
              />
            )
          ) : p.pathname.startsWith("/course/") ? (
            <Lesson key={p.pathname} id={p.pathname.split("/")[2]} />
          ) : ["/dashboard", "/course", "/progress"].includes(p.pathname) ? (
            <Dashboard me={p.me} mode={p.pathname} />
          ) : (
            <ErrorState message="404" retry={() => router.push("/dashboard")} />
          )}
        </motion.main>
        <footer className="app-footer">© TALAN · {t("source")}</footer>
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" aria-label="Загрузка / Жүктелуде">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-row">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  const { t } = useApp();
  return (
    <div className="empty-state" role="alert">
      <BookOpen size={32} />
      <p>{message}</p>
      <Button variant="outline" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}
export function MathArt() {
  return (
    <svg
      className="math-art"
      viewBox="0 0 350 220"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="193" cy="109" r="84" stroke="currentColor" opacity=".16" />
      <ellipse
        cx="193"
        cy="109"
        rx="112"
        ry="39"
        transform="rotate(-28 193 109)"
        stroke="currentColor"
        opacity=".5"
      />
      <ellipse
        cx="193"
        cy="109"
        rx="112"
        ry="39"
        transform="rotate(48 193 109)"
        stroke="currentColor"
        opacity=".4"
      />
      <circle cx="193" cy="109" r="9" fill="currentColor" />
      <circle cx="282" cy="73" r="5" fill="currentColor" />
      <path d="M30 130 L82 42 L122 152 Z" stroke="currentColor" opacity=".22" />
      <path
        d="M215 180 L293 190 M254 144 L254 218"
        stroke="currentColor"
        opacity=".2"
      />
      <text
        x="305"
        y="47"
        fill="currentColor"
        opacity=".55"
        fontSize="25"
        fontFamily="serif"
      >
        π
      </text>
      <text
        x="42"
        y="197"
        fill="currentColor"
        opacity=".4"
        fontSize="23"
        fontFamily="serif"
      >
        x²
      </text>
    </svg>
  );
}
function Dashboard({ me, mode }: { me: Me; mode: string }) {
  const { t, error, date, lang } = useApp();
  const [courses, setCourses] = useState<CourseView[]>([]),
    [busy, setBusy] = useState(true),
    [failure, setFailure] = useState(""),
    [courseId, setCourseId] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const listTransition = useContentTransition(`${courseId}:${filter}`);
  function load() {
    setBusy(true);
    setFailure("");
    api<CourseView[]>("catalog")
      .then((c) => {
        setCourses(c);
        setCourseId((old) => old || c[0]?.id || "");
      })
      .catch((e) => setFailure(error(e)))
      .finally(() => setBusy(false));
  }
  useEffect(() => {
    load();
  }, []); // Course enrollment is independent of interface language.
  if (busy) return <Loading />;
  if (failure) return <ErrorState message={failure} retry={load} />;
  if (!courses.length)
    return (
      <div className="empty-state">
        <BookOpen />
        <p>{t("empty")}</p>
      </div>
    );
  const course = courses.find((c) => c.id === courseId) || courses[0],
    lessons = course.lessons,
    completed = lessons.filter((l) => l.state === "COMPLETED").length,
    passed = lessons.filter((l) => (l.bestScore ?? 0) >= 80).length,
    viewed = lessons.filter((l) => l.viewed).length;
  const next =
    lessons.find(
      (l) =>
        l.state !== "COMPLETED" &&
        l.hasHomework &&
        ["AVAILABLE", "IN_PROGRESS"].includes(l.state),
    ) || lessons.find((l) => ["AVAILABLE", "IN_PROGRESS"].includes(l.state));
  const matches = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "open" && ["AVAILABLE", "IN_PROGRESS"].includes(l.state)) ||
        (filter === "done" && l.state === "COMPLETED")),
  );
  return (
    <div
      className={
        mode === "/dashboard"
          ? overviewStyles.dashboard
          : mode === "/progress"
            ? progressStyles.page
            : undefined
      }
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">{course.group}</span>
          <h1>{mode === "/progress" ? t("progress") : course.title}</h1>
          <p className="muted">
            {t("grade")} <span className="dot">·</span>{" "}
            {course.language === "ru"
              ? "Русская программа"
              : "Қазақ бағдарламасы"}
          </p>
        </div>
        {courses.length > 1 && (
          <select
            aria-label={t("program")}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {mode === "/dashboard" ? (
        <DashboardOverview
          lessons={lessons}
          next={next}
          completed={completed}
          passed={passed}
          viewed={viewed}
        />
      ) : mode === "/progress" ? (
        <ProgressSummary
          lessons={lessons}
          completed={completed}
          passed={passed}
          viewed={viewed}
        />
      ) : (
        <section className="stats-grid">
          <Stat
            icon={<BookOpen />}
            label={t("completeCount")}
            value={`${completed} / ${lessons.length}`}
            percent={(completed / lessons.length) * 100}
          />
          <Stat
            icon={<Target />}
            label={t("passedCount")}
            value={`${passed} / ${lessons.length}`}
            percent={(passed / lessons.length) * 100}
          />
          <Stat
            icon={<Video />}
            label={t("viewCount")}
            value={`${viewed} / ${lessons.length}`}
            percent={(viewed / lessons.length) * 100}
          />
        </section>
      )}
      <div className="section-heading">
        <h2>
          {mode === "/progress"
            ? lang === "ru"
              ? "Результаты по урокам"
              : "Сабақтар бойынша нәтижелер"
            : t("course")}
          <span className="count">{lessons.length}</span>
        </h2>
        <span className="muted">{t("pass")} ≥ 80%</span>
      </div>
      <div className="course-toolbar">
        <SlidingSwitch
          className="tabs"
          label={t("course")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("all") },
            { value: "open", label: t("available") },
            { value: "done", label: t("completed") },
          ]}
        />
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <motion.div
        className="lesson-list"
        initial={false}
        animate={listTransition}
      >
        {!matches.length && <div className="empty-state">{t("noResults")}</div>}
        {matches.map((l, i) => (
          <div key={l.id}>
            {(i === 0 ||
              Math.ceil(matches[i - 1].order / 3) !==
                Math.ceil(l.order / 3)) && (
              <div className="week-label">
                {t("week")} {Math.ceil(l.order / 3)}
              </div>
            )}
            {mode === "/progress" ? (
              <ProgressLessonRow lesson={l} />
            ) : (
              <LessonRow lesson={l} />
            )}
          </div>
        ))}
      </motion.div>
      <p className="muted fine-print">{t("curriculumHelp")}</p>
    </div>
  );
}
function LessonRow({ lesson: l }: { lesson: LessonCard }) {
  const { t, date } = useApp(),
    disabled = ["LOCKED", "PENDING"].includes(l.state);
  const content = (
    <>
      <span
        className={`lesson-number ${l.state === "COMPLETED" ? "done" : ""}`}
      >
        {l.state === "COMPLETED" ? (
          <Check size={22} />
        ) : (
          String(l.order).padStart(2, "0")
        )}
      </span>
      <div className="lesson-info">
        <h3>{l.title}</h3>
        <div className="lesson-meta">
          <span>
            <Video size={13} />
            {t("lesson")} {l.order}
          </span>
          <span>{l.hasHomework ? t("homework") : t("homeworkPending")}</span>
        </div>
      </div>
      <div className="lesson-trailing">
        {l.bestScore !== null && (
          <span className="score-mini">{l.bestScore}%</span>
        )}
        <span className={`badge ${l.state.toLowerCase()}`}>
          {l.state === "PENDING"
            ? t("materialPending")
            : l.state === "LOCKED"
              ? `${t("locked")} ${l.opensAt ? date(l.opensAt) : "—"}`
              : l.state === "COMPLETED"
                ? t("completed")
                : l.state === "IN_PROGRESS"
                  ? t("inProgress")
                  : t("available")}
        </span>
        {disabled ? <Lock size={17} /> : <ChevronRight size={20} />}
      </div>
    </>
  );
  return disabled ? (
    <div className="lesson-row disabled" aria-disabled="true">
      {content}
    </div>
  ) : (
    <Link href={`/course/${l.id}`} className="lesson-row">
      {content}
    </Link>
  );
}
export function Stat({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent?: number;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      {percent !== undefined && (
        <div className="progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
