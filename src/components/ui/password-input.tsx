"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "../context";
import styles from "./password-input.module.css";

export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  const { lang } = useApp();
  const label =
    lang === "ru"
      ? visible
        ? "Скрыть пароль"
        : "Показать пароль"
      : visible
        ? "Құпиясөзді жасыру"
        : "Құпиясөзді көрсету";
  return (
    <span className={styles.field}>
      <input {...props} type={visible ? "text" : "password"} />
      <button
        className={styles.toggle}
        type="button"
        aria-label={label}
        aria-pressed={visible}
        disabled={props.disabled}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={19} aria-hidden="true" />
        ) : (
          <Eye size={19} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
