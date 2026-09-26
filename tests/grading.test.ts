import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, isCorrect, opensAt } from "../src/lib/grading";
import homeworks from "../content/homeworks.json";
const q = {
  id: "q",
  type: "DECIMAL",
  correctAnswer: "3.14",
  acceptableAnswers: [],
  tolerance: "0.01",
  points: 1,
};
test("decimal tolerance includes exact endpoints, accepts comma, rejects out of range", () => {
  for (const x of ["3.13", "3,14", "3.15"]) assert.ok(isCorrect(q, x));
  for (const x of ["3.129", "3.151", "NaN", "Infinity", "1/0"])
    assert.equal(isCorrect(q, x), false);
});
test("equivalent fractions and percentages use exact rational comparison", () => {
  for (const x of ["0.5", "1/2", "50%", "2/4"])
    assert.ok(isCorrect({ ...q, correctAnswer: "0.5", tolerance: "0" }, x));
  assert.equal(
    isCorrect({ ...q, correctAnswer: "0.5", tolerance: "0" }, "50"),
    false,
  );
});
test("7 of 8 passes while 6 of 8 does not; maximum weighted points are server-owned", () => {
  const qs = Array.from({ length: 8 }, (_, i) => ({
    ...q,
    id: String(i),
    type: "MULTIPLE_CHOICE",
    correctAnswer: "A",
  }));
  assert.equal(
    grade(qs, Object.fromEntries(qs.map((v, i) => [v.id, i < 7 ? "A" : "B"])))
      .score,
    87,
  );
  assert.equal(
    grade(qs, Object.fromEntries(qs.map((v, i) => [v.id, i < 6 ? "A" : "B"])))
      .score,
    75,
  );
});
test("user keys preserved separately for each curriculum", () => {
  assert.equal(
    homeworks[0].questions.map((q) => q.correctAnswer).join(""),
    "CDACBBEB",
  );
  assert.equal(
    homeworks[1].questions.map((q) => q.correctAnswer).join(""),
    "CCEDABEA",
  );
});
test("unlock is exact, cohort-specific, and invalid absolute schedule stays closed", () => {
  const relative = {
    unlockType: "RELATIVE_TO_COHORT_START",
    availableFrom: null,
    unlockOffsetDays: 3,
  };
  assert.equal(
    opensAt(relative, new Date("2026-10-01T04:00:00Z"))?.toISOString(),
    "2026-10-04T04:00:00.000Z",
  );
  assert.equal(
    opensAt({ ...relative, unlockType: "ABSOLUTE_DATE" }, new Date()),
    null,
  );
});
