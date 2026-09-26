"use client";
import { createContext, useContext } from "react";
import { labels, errors, type Lang, type Label } from "@/lib/i18n";
export const AppContext = createContext({
  lang: "ru" as Lang,
  notify: (_message: string) => {},
});
export function useApp() {
  const { lang, notify } = useContext(AppContext);
  return {
    lang,
    notify,
    t: (key: Label) => labels[lang][key],
    error: (e: unknown) =>
      errors[e instanceof Error ? e.message : ""]?.[lang === "ru" ? 0 : 1] ||
      (lang === "ru"
        ? "Не удалось выполнить действие. Проверьте соединение и попробуйте снова."
        : "Әрекет орындалмады. Байланысты тексеріп, қайталаңыз."),
    date: (value: string) =>
      new Intl.DateTimeFormat(lang === "ru" ? "ru-KZ" : "kk-KZ", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Almaty",
      }).format(new Date(value)),
  };
}
