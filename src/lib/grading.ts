export type Gradable = {
  id: string;
  type: string;
  correctAnswer: string;
  acceptableAnswers: unknown;
  tolerance: string;
  points: number;
};
type Rational = { n: bigint; d: bigint };
function numeric(raw: string): Rational | null {
  const value = raw.trim().replace(",", ".");
  if (value.length > 100) return null;
  if (value.endsWith("%")) {
    const v = numeric(value.slice(0, -1));
    return v ? { n: v.n, d: v.d * 100n } : null;
  }
  if (/^[+-]?\d+\s*\/\s*[+-]?\d+$/.test(value)) {
    const [n, d] = value.split("/").map((v) => BigInt(v.trim()));
    if (d === 0n) return null;
    return d < 0n ? { n: -n, d: -d } : { n, d };
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [a, b = ""] = value.replace(/^[+-]/, "").split(".");
  return {
    n: BigInt((a || "0") + b) * (negative ? -1n : 1n),
    d: 10n ** BigInt(b.length),
  };
}
export function isCorrect(q: Gradable, input: string) {
  const allowed = [
    q.correctAnswer,
    ...(Array.isArray(q.acceptableAnswers)
      ? q.acceptableAnswers.filter((x): x is string => typeof x === "string")
      : []),
  ];
  if (q.type === "MULTIPLE_CHOICE")
    return input.trim().toUpperCase() === q.correctAnswer;
  if (q.type === "SHORT_TEXT")
    return allowed.some(
      (v) =>
        v.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
        input.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    );
  const actual = numeric(input),
    tol = numeric(q.tolerance);
  if (!actual || !tol || tol.n < 0n) return false;
  return allowed.some((v) => {
    const expected = numeric(v);
    if (!expected) return false;
    const delta = actual.n * expected.d - expected.n * actual.d;
    return (
      (delta < 0n ? -delta : delta) * tol.d <= tol.n * actual.d * expected.d
    );
  });
}
export function grade(questions: Gradable[], answers: Record<string, string>) {
  const result = questions.map((q) => ({
    id: q.id,
    correct: isCorrect(q, answers[q.id] ?? ""),
    points: q.points,
  }));
  const maxPoints = questions.reduce((s, q) => s + q.points, 0),
    earnedPoints = result.reduce((s, q) => s + (q.correct ? q.points : 0), 0);
  return {
    result,
    maxPoints,
    earnedPoints,
    score: maxPoints ? Math.floor((100 * earnedPoints) / maxPoints) : 0,
  };
}
export function opensAt(
  lesson: {
    unlockType: string;
    availableFrom: Date | null;
    unlockOffsetDays: number;
  },
  startDate: Date,
) {
  if (lesson.unlockType === "ABSOLUTE_DATE") return lesson.availableFrom;
  return new Date(startDate.getTime() + lesson.unlockOffsetDays * 86400000);
}
