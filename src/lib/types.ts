export type Me = {
  id: string;
  name: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
};
export type LessonCard = {
  id: string;
  order: number;
  title: string;
  state: string;
  opensAt: string | null;
  viewed: boolean;
  hasHomework: boolean;
  bestScore: number | null;
  attempts: number;
};
export type CourseView = {
  id: string;
  title: string;
  language: string;
  group: string;
  timezone: string;
  lessons: LessonCard[];
};
export type QuestionView = {
  id: string;
  order: number;
  level: string;
  type: string;
  text: string;
  options: string[];
  points: number;
};
export type SubmissionView = {
  id: string;
  attempt: number;
  score: number;
  earnedPoints: number;
  maxPoints: number;
  createdAt: string;
  answers: Record<string, string>;
  result: { id: string; correct: boolean; points: number }[];
};
export type LessonView = {
  id: string;
  title: string;
  description: string;
  order: number;
  courseId: string;
  courseTitle: string;
  language: string;
  videoUrl: string;
  videoExternalUrl: string;
  viewed: boolean;
  homework: null | {
    id: string;
    revision: number;
    maxAttempts: number;
    passingScore: number;
    questionCount: number;
    questions: QuestionView[];
    progress: null | {
      draft: Record<string, string>;
      attemptCount: number;
      bonusAttempts: number;
      bestScore: number;
      passedAt: string | null;
    };
    submissions: SubmissionView[];
  };
};
export type CohortView = {
  id: string;
  name: string;
  courseId: string;
  startDate: string;
  _count: { enrollments: number };
};
export type Overview = {
  students: number;
  active: number;
  submissions: number;
  passed: number;
  averageScore: number | null;
  courses: { id: string; title: string }[];
  cohorts: CohortView[];
  lessons: {
    id: string;
    courseId: string;
    order: number;
    title: string;
    status: string;
    videoId: string | null;
    homework: null | {
      id: string;
      status: string;
      _count: { questions: number; submissions: number };
    };
  }[];
};
export type StudentRow = {
  id: string;
  name: string;
  username: string;
  status: string;
  lastActivityAt: string | null;
  enrollments: {
    id: string;
    status: string;
    courseId: string;
    cohort: { name: string };
  }[];
  _count: { homeworkProgress: number };
};
export type Issued = {
  id?: string;
  name?: string;
  username: string;
  password: string;
};
export type EditableQuestion = QuestionView & {
  correctAnswer: string;
  acceptableAnswers: string[];
  tolerance: string;
  explanation: string;
};
export type Editor = {
  id: string;
  title: string;
  description: string;
  videoId: string | null;
  status: string;
  unlockType: string;
  availableFrom: string | null;
  unlockOffsetDays: number;
  homework: null | { status: string; questions: EditableQuestion[] };
};
