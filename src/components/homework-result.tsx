"use client";
import { Check, X, ArrowRight, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import type { QuestionView, SubmissionView } from "@/lib/types";
import { useApp } from "./context";
import { MathText } from "./math-text";
import { Button } from "./ui/button";
import { usePrefersReducedMotion } from "./ui/use-prefers-reduced-motion";

export function HomeworkResult({
  submission,
  questions,
  passingScore,
  remaining,
  finished,
  onRetry,
}: {
  submission: SubmissionView;
  questions: QuestionView[];
  passingScore: number;
  remaining: number;
  finished: boolean;
  onRetry: () => void;
}) {
  const { lang, t, date } = useApp();
  const reduced = usePrefersReducedMotion();
  const ru = lang === "ru";
  const passed =
    submission.earnedPoints * 100 >= submission.maxPoints * passingScore;
  const correct = submission.result.filter((r) => r.correct).length;
  const percentage = new Intl.NumberFormat(ru ? "ru-RU" : "kk-KZ", {
    maximumFractionDigits: 1,
  }).format(
    submission.maxPoints
      ? (submission.earnedPoints / submission.maxPoints) * 100
      : 0,
  );
  return (
    <motion.section
      className="homework-result"
      aria-labelledby="result-title"
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
    >
      <div className="result-summary">
        <div>
          <div className="result-attempt">
            <span>
              {t("attempt")} {submission.attempt}
            </span>
            <time dateTime={submission.createdAt}>
              {date(submission.createdAt)}
            </time>
          </div>
          <h2 id="result-title" tabIndex={-1}>
            {ru ? "Результат теста" : "Тест нәтижесі"}
          </h2>
          <p
            className={`result-outcome ${passed ? "outcome-passed" : "outcome-retry"}`}
          >
            {passed ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <X size={15} aria-hidden="true" />
            )}
            {passed
              ? t("passed")
              : ru
                ? "Пока ниже проходного балла"
                : "Әзірге өту балынан төмен"}
          </p>
          <p className="muted">
            {ru
              ? `Верно ${correct} из ${questions.length} · Для зачёта нужно ${passingScore}%`
              : `${questions.length} сұрақтың ${correct}-еуі дұрыс · Өту үшін ${passingScore}% қажет`}
          </p>
        </div>
        <div
          className="result-score"
          aria-label={`${ru ? "Результат" : "Нәтиже"}: ${percentage}%`}
        >
          <strong>
            {percentage}
            <span>%</span>
          </strong>
          <span>
            {submission.earnedPoints} / {submission.maxPoints}{" "}
            {ru ? "баллов" : "балл"}
          </span>
        </div>
      </div>
      <div className="result-divider">
        <h3>{ru ? "Ваши ответы" : "Сіздің жауаптарыңыз"}</h3>
        <span className="muted">
          {ru
            ? `Ошибок: ${questions.length - correct}`
            : `Қате: ${questions.length - correct}`}
        </span>
      </div>
      <ol className="result-answers">
        {questions.map((question, index) => {
          const item = submission.result.find((r) => r.id === question.id);
          const answer = submission.answers[question.id] || "—";
          const option =
            question.type === "MULTIPLE_CHOICE"
              ? question.options["ABCDE".indexOf(answer)]
              : undefined;
          const ok = !!item?.correct;
          return (
            <li
              key={question.id}
              className={`result-answer ${ok ? "is-correct" : "is-incorrect"}`}
            >
              <span className="result-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="result-answer-content">
                <h4>
                  <MathText text={question.text} />
                </h4>
                <p>
                  <span className="muted">
                    {ru ? "Ваш ответ" : "Сіздің жауабыңыз"}:{" "}
                  </span>
                  {option !== undefined ? (
                    <>
                      <span className="answer-code">{answer}</span>{" "}
                      <MathText text={option} />
                    </>
                  ) : (
                    <MathText text={answer} />
                  )}
                </p>
              </div>
              <span className="answer-verdict">
                {ok ? <Check size={16} /> : <X size={16} />}
                {ok ? (ru ? "Верно" : "Дұрыс") : ru ? "Ошибка" : "Қате"}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="result-actions">
        <p className="muted">
          {finished
            ? passed
              ? ru
                ? "Отлично, можно продолжать обучение."
                : "Керемет, оқуды жалғастыруға болады."
              : t("noAttempts")
            : ru
              ? `Осталось попыток: ${remaining}. Проверьте отмеченные вопросы перед новой сдачей.`
              : `Қалған әрекеттер: ${remaining}. Қайта тапсырар алдында белгіленген сұрақтарды тексеріңіз.`}
        </p>
        {!finished ? (
          <Button onClick={onRetry}>
            <RotateCcw size={15} />
            {ru ? "Попробовать ещё раз" : "Қайта тапсыру"}
          </Button>
        ) : (
          <Button asChild variant="outline">
            <a href="/course">
              {t("course")}
              <ArrowRight size={15} />
            </a>
          </Button>
        )}
      </div>
    </motion.section>
  );
}
