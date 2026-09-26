"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, LoaderCircle, CircleAlert } from "lucide-react";
import { useApp } from "./context";
import { Button } from "./ui/button";
import styles from "./login-screen.module.css";

export function LoginScreen({
  controls,
  loading,
}: {
  controls: ReactNode;
  loading: boolean;
}) {
  const { t, lang } = useApp();
  const ru = lang === "ru";
  return (
    <div className={styles.page}>
      <section className={styles.cover} aria-labelledby="course-title">
        <div className={styles.brand}>
          <img src="/talan-logo.png" alt="" />
          <div>
            <strong>TALAN</strong>
            <span>{t("center")}</span>
          </div>
        </div>
        <div className={styles.course}>
          <p className={styles.grade}>{t("grade")}</p>
          <h1 id="course-title">
            {ru ? "Математическая грамотность" : "Математикалық сауаттылық"}
          </h1>
          <p className={styles.description}>
            {ru
              ? "Видеоуроки и домашние задания. Материалы курса и ваши результаты — в одном учебном кабинете."
              : "Бейнесабақтар мен үй тапсырмалары. Курс материалдары мен нәтижелеріңіз — бір оқу кабинетінде."}
          </p>
          <div className={styles.sketch} aria-hidden="true">
            <svg viewBox="0 0 280 170" fill="none">
              <path
                d="M38 24V140H240Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M38 124H54V140" stroke="currentColor" opacity=".5" />
              <circle cx="38" cy="24" r="3" fill="currentColor" />
              <circle cx="38" cy="140" r="3" fill="currentColor" />
              <circle cx="240" cy="140" r="3" fill="currentColor" />
              <g
                fill="currentColor"
                fontSize="18"
                fontFamily="var(--font-display)"
              >
                <text x="17" y="88">
                  a
                </text>
                <text x="132" y="164">
                  b
                </text>
                <text x="146" y="70">
                  c
                </text>
              </g>
            </svg>
            <span>a² + b² = c²</span>
          </div>
        </div>
        <p className={styles.coverFooter}>
          {ru
            ? "Русская и казахская программы"
            : "Қазақ және орыс тіліндегі бағдарламалар"}
        </p>
      </section>
      <main className={styles.access}>
        <div className={styles.controls}>{controls}</div>
        <div className={styles.formWrap}>
          {loading ? (
            <div className={styles.loading} role="status">
              <LoaderCircle size={22} className="spin" aria-hidden="true" />
              <span>{t("loading")}</span>
            </div>
          ) : (
            <LoginForm />
          )}
        </div>
        <p className={styles.footer}>© TALAN</p>
      </main>
    </div>
  );
}

function LoginForm() {
  const { t, lang } = useApp();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setFailed(false);
        const form = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/auth/sign-in/username", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: form.get("username"),
              password: form.get("password"),
            }),
          });
          if (!r.ok) throw new Error();
          window.location.assign("/dashboard");
        } catch {
          setFailed(true);
          setBusy(false);
        }
      }}
    >
      <h2>
        {lang === "ru" ? "Вход в учебный кабинет" : "Оқу кабинетіне кіру"}
      </h2>
      <p className={styles.formIntro}>
        {lang === "ru"
          ? "Используйте логин и пароль, которые выдал центр."
          : "Орталық берген логин мен құпиясөзді пайдаланыңыз."}
      </p>
      <label>
        {t("username")}
        <input
          name="username"
          autoComplete="username"
          required
          autoFocus
          placeholder="talan-…"
          aria-invalid={failed || undefined}
          aria-describedby={failed ? "login-error" : undefined}
        />
      </label>
      <label>
        {t("password")}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={failed || undefined}
          aria-describedby={failed ? "login-error" : undefined}
        />
      </label>
      {failed && (
        <p className={styles.error} id="login-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{t("loginError")}</span>
        </p>
      )}
      <Button disabled={busy} type="submit">
        {busy ? t("loading") : t("login")}
        {busy ? (
          <LoaderCircle size={17} className="spin" aria-hidden="true" />
        ) : (
          <ArrowRight size={17} aria-hidden="true" />
        )}
      </Button>
      <div className={styles.help}>
        <h3>{lang === "ru" ? "Нужен доступ?" : "Кіруге көмек керек пе?"}</h3>
        <p>
          {lang === "ru"
            ? "Если у вас ещё нет данных для входа или вы забыли пароль, обратитесь к администратору центра TALAN."
            : "Кіру деректеріңіз болмаса немесе құпиясөзді ұмытып қалсаңыз, TALAN орталығының әкімшісіне хабарласыңыз."}
        </p>
      </div>
    </form>
  );
}
