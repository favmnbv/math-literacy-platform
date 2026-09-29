"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import type { Me } from "@/lib/types";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { api } from "@/lib/client";
import { useApp } from "./context";
import { Button } from "./ui/button";
import { PasswordInput } from "./ui/password-input";
import styles from "./profile-screen.module.css";

export function Profile({ me, onRefresh }: { me: Me; onRefresh: () => void }) {
  const { t, lang, notify, error } = useApp();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const ru = lang === "ru";
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>{t("account")}</h1>
        <p>
          {ru
            ? "Данные для входа и доступ к учебному кабинету."
            : "Кіру деректері және оқу кабинетіне қолжетімділік."}
        </p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.identity} aria-labelledby="profile-name">
          <div className={styles.nameplate}>
            <span className={styles.initial} aria-hidden="true">
              {me.name[0]}
            </span>
            <p>
              {isSuperAdmin(me.role)
                ? ru
                  ? "Суперадминистратор"
                  : "Бас әкімші"
                : isAdmin(me.role)
                  ? ru
                    ? "Администратор-куратор"
                    : "Әкімші-куратор"
                  : ru
                    ? "Ученик TALAN"
                    : "TALAN оқушысы"}
            </p>
            <h2 id="profile-name">{me.name}</h2>
            <dl>
              <div>
                <dt>{t("username")}</dt>
                <dd>{me.username}</dd>
              </div>
            </dl>
          </div>
          <p className={styles.accountHelp}>
            {ru
              ? "Имя и логин выдаёт образовательный центр. Если в данных ошибка, обратитесь к администратору."
              : "Аты-жөніңіз бен логинді білім беру орталығы береді. Деректерде қате болса, әкімшіге хабарласыңыз."}
          </p>
        </aside>
        <section
          className={styles.passwordSection}
          aria-labelledby="password-title"
        >
          <div className={styles.sectionHeading}>
            <KeyRound size={19} aria-hidden="true" />
            <h2 id="password-title">
              {ru ? "Смена пароля" : "Құпиясөзді өзгерту"}
            </h2>
          </div>
          {me.mustChangePassword ? (
            <div className={styles.requiredNotice} role="status">
              <strong>{ru ? "Первый вход" : "Алғашқы кіру"}</strong>
              <p>{t("mustChange")}</p>
            </div>
          ) : (
            <p className={styles.intro}>
              {ru
                ? "Введите текущий пароль и задайте новый. Логин останется прежним."
                : "Қазіргі құпиясөзді енгізіп, жаңасын орнатыңыз. Логин өзгермейді."}
            </p>
          )}
          <form
            className={styles.form}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const form = e.currentTarget,
                data = new FormData(form);
              try {
                await api("password", {
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                });
                form.reset();
                notify(t("passwordChanged"));
                onRefresh();
                router.push(isAdmin(me.role) ? "/admin" : "/dashboard");
              } catch (e) {
                notify(error(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className={styles.passwordField}>
              <label htmlFor="current-password">{t("currentPassword")}</label>
              <PasswordInput
                id="current-password"
                name="currentPassword"
                autoComplete="current-password"
                required
              />
            </div>
            <div className={styles.passwordField}>
              <label htmlFor="new-password">{t("newPassword")}</label>
              <PasswordInput
                id="new-password"
                name="newPassword"
                autoComplete="new-password"
                minLength={12}
                maxLength={64}
                required
                aria-describedby="password-length"
              />
            </div>
            <p id="password-length" className={styles.fieldHint}>
              {ru ? "От 12 до 64 символов." : "12–64 таңба."}
            </p>
            <div className={styles.actions}>
              <Button disabled={busy} type="submit">
                {busy && (
                  <LoaderCircle size={16} className="spin" aria-hidden="true" />
                )}
                {busy ? t("saving") : t("changePassword")}
              </Button>
              <p>
                {ru
                  ? "После смены пароля другие сеансы будут завершены."
                  : "Құпиясөз өзгергеннен кейін басқа сеанстар аяқталады."}
              </p>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
