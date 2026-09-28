"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Target,
  ChartNoAxesCombined,
  CheckCircle2,
  Plus,
  Search,
  ArrowLeft,
  Save,
  Download,
} from "lucide-react";
import { api } from "@/lib/client";
import type {
  Overview,
  StudentRow,
  Issued,
  Editor,
  EditableQuestion,
  Me,
} from "@/lib/types";
import { isSuperAdmin } from "@/lib/roles";
import { Button } from "./ui/button";
import { useApp } from "./context";
import { Loading, ErrorState, Stat } from "./portal";
import { MathText } from "./math-text";
import { AdminOverview } from "./admin-overview";
import { Staff } from "./staff";

export function Admin({ pathname, me }: { pathname: string; me: Me }) {
  const { t, error } = useApp();
  const [data, setData] = useState<Overview | null>(null),
    [failed, setFailed] = useState("");
  async function load() {
    try {
      setData(await api<Overview>("admin"));
      setFailed("");
    } catch (e) {
      setFailed(error(e));
    }
  }
  useEffect(() => {
    void load();
  }, [pathname]);
  if (failed) return <ErrorState message={failed} retry={load} />;
  if (!data) return <Loading />;
  if (pathname === "/admin/staff")
    return isSuperAdmin(me.role) ? (
      <Staff me={me} />
    ) : (
      <ErrorState
        message={error(new Error("FORBIDDEN"))}
        retry={() => window.location.assign("/admin")}
      />
    );
  if (pathname.startsWith("/admin/lesson/"))
    return <LessonEditor id={pathname.split("/")[3]} />;
  if (pathname === "/admin/students") return <Students overview={data} />;
  if (pathname === "/admin/groups")
    return <Groups overview={data} refresh={load} />;
  if (pathname === "/admin")
    return <AdminOverview data={data} curator={!isSuperAdmin(me.role)} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TALAN · {t("admin")}</span>
          <h1>
            {pathname === "/admin/course" ? t("lessons") : t("dashboard")}
          </h1>
        </div>
      </div>
      {pathname !== "/admin/course" && (
        <section className="stats-grid four">
          <Stat
            icon={<Users />}
            label={t("totalStudents")}
            value={String(data.students)}
          />
          <Stat
            icon={<Users />}
            label={t("activeStudents")}
            value={String(data.active)}
          />
          <Stat
            icon={<CheckCircle2 />}
            label={t("submissions")}
            value={String(data.submissions)}
          />
          <Stat
            icon={<ChartNoAxesCombined />}
            label={t("averageScore")}
            value={
              data.averageScore === null
                ? "—"
                : `${Math.round(data.averageScore)}%`
            }
          />
        </section>
      )}
      {data.courses.map((c) => (
        <section key={c.id} className="admin-course">
          <div className="section-heading">
            <h2>{c.title}</h2>
            <span className="badge">{c.id.toUpperCase()}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{t("lesson")}</th>
                  <th>{t("status")}</th>
                  <th>{t("homework")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.lessons
                  .filter((l) => l.courseId === c.id)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{l.order}</td>
                      <td>
                        <strong>{l.title}</strong>
                        {!l.videoId && (
                          <small className="table-note">
                            {t("materialPending")}
                          </small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${l.status === "PUBLISHED" ? "available" : ""}`}
                        >
                          {l.status === "PUBLISHED"
                            ? t("published")
                            : t("draft")}
                        </span>
                      </td>
                      <td>
                        {l.homework
                          ? `${l.homework._count.questions} · ${t("questions").toLowerCase()}`
                          : "—"}
                      </td>
                      <td>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/lesson/${l.id}`}>
                            {t("edit")}
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
export function Credentials({
  rows,
  onClose,
}: {
  rows: Issued[];
  onClose: () => void;
}) {
  const { t } = useApp();
  function download() {
    const csv =
      "\uFEFFname,username,password\n" +
      rows
        .map((r) =>
          [r.name || "", r.username, r.password]
            .map(
              (v) =>
                '"' +
                (/^[=+@-]/.test(v) ? "\u0027" + v : v).replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "talan-credentials.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel credentials">
      <div className="section-heading">
        <h3>{t("issued")}</h3>
        <Button variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
      {rows.map((r) => (
        <div className="credential" key={r.username}>
          <strong>{r.name}</strong>
          <code>{r.username}</code>
          <code>{r.password}</code>
        </div>
      ))}
      <Button variant="outline" onClick={download}>
        <Download size={15} />
        {t("download")} CSV
      </Button>
    </section>
  );
}
function Students({ overview }: { overview: Overview }) {
  const { t, error, notify, date, lang } = useApp();
  const [rows, setRows] = useState<StudentRow[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [showCreate, setShowCreate] = useState(false),
    [issued, setIssued] = useState<Issued[]>([]),
    [csv, setCsv] = useState(""),
    [importGroup, setImportGroup] = useState(""),
    [preview, setPreview] = useState<
      | {
          row: number;
          name: string;
          username?: string;
          cohortId: string;
          error: string;
        }[]
      | null
    >(null),
    [detail, setDetail] = useState<{
      student: { name: string };
      submissions: {
        id: string;
        attempt: number;
        score: number;
        createdAt: string;
        homework: { lesson: { title: string } };
      }[];
    } | null>(null);
  async function load() {
    try {
      const result = await api<{ rows: StudentRow[]; total: number }>(
        "students",
        undefined,
        { q: query, page: String(page) },
      );
      setRows(result.rows);
      setTotal(result.total);
    } catch (e) {
      notify(error(e));
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [query, page]);
  async function action(name: string, data: Record<string, unknown>) {
    setBusy(true);
    try {
      const result = await api<Issued>(name, data);
      if (name === "resetPassword") setIssued([result]);
      await load();
    } catch (e) {
      notify(error(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">TALAN</span>
          <h1>
            {t("students")} <span className="count">{total}</span>
          </h1>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={17} />
          {t("addStudent")}
        </Button>
      </div>
      {issued.length > 0 && (
        <Credentials rows={issued} onClose={() => setIssued([])} />
      )}
      {showCreate && (
        <form
          className="panel inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget,
              f = new FormData(form);
            try {
              const row = await api<Issued>("createStudent", {
                name: f.get("name"),
                cohortId: f.get("cohortId"),
                ...(f.get("username") ? { username: f.get("username") } : {}),
              });
              setIssued([row]);
              form.reset();
              setShowCreate(false);
              await load();
            } catch (e) {
              notify(error(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("name")}
            <input name="name" required minLength={2} />
          </label>
          <label>
            {t("username")}
            <input
              name="username"
              placeholder="auto"
              pattern="[a-z0-9_.\-]{3,40}"
            />
          </label>
          <label>
            {t("group")}
            <select name="cohortId">
              {overview.cohorts.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy}>{t("create")}</Button>
        </form>
      )}
      <div className="search-field standalone-search">
        <Search size={18} />
        <input
          aria-label={t("search")}
          placeholder={`${t("name")} / ${t("username")}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("group")}</th>
              <th>{t("passedCount")}</th>
              <th>{t("status")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small className="table-note">{u.username}</small>
                </td>
                <td>
                  {u.enrollments.map((e) => (
                    <div key={e.id}>
                      {e.cohort.name}
                      <button
                        disabled={busy}
                        className="text-button"
                        onClick={() =>
                          action("enrollment", {
                            id: e.id,
                            status:
                              e.status === "ACTIVE" ? "REVOKED" : "ACTIVE",
                          })
                        }
                      >
                        {e.status === "ACTIVE" ? t("revoke") : t("restore")}
                      </button>
                    </div>
                  ))}
                </td>
                <td>{u._count.homeworkProgress}</td>
                <td>
                  <span
                    className={`badge ${u.status === "ACTIVE" ? "available" : ""}`}
                  >
                    {u.status === "ACTIVE" ? t("active") : t("blocked")}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      disabled={busy}
                      onClick={() =>
                        action("studentStatus", {
                          id: u.id,
                          status: u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE",
                        })
                      }
                    >
                      {u.status === "ACTIVE" ? t("block") : t("unblock")}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => action("resetPassword", { id: u.id })}
                    >
                      {t("reset")}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          setDetail(
                            await api("student", undefined, { id: u.id }),
                          );
                        } catch (e) {
                          notify(error(e));
                        }
                      }}
                    >
                      {t("viewStats")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty-state">{t("noResults")}</p>}
      </div>
      <div className="pagination">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t("previous")}
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil(total / 20))}
        </span>
        <Button
          variant="outline"
          disabled={page * 20 >= total}
          onClick={() => setPage(page + 1)}
        >
          {t("next")}
        </Button>
      </div>
      {detail && (
        <section className="panel">
          <div className="section-heading">
            <h2>{detail.student.name}</h2>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              {t("close")}
            </Button>
          </div>
          {detail.submissions.length ? (
            detail.submissions.map((s) => (
              <div className="detail-row" key={s.id}>
                <span>
                  {s.homework.lesson.title}
                  <small className="table-note">
                    {date(s.createdAt)} · {t("attempt")} {s.attempt}
                  </small>
                </span>
                <strong>{s.score}%</strong>
              </div>
            ))
          ) : (
            <p>{t("noData")}</p>
          )}
        </section>
      )}
      <details className="panel import-panel">
        <summary>{t("import")}</summary>
        <p className="muted">{t("csvHint")}</p>
        <label>
          {lang === "ru" ? "Группа для импорта" : "Импортқа арналған топ"}
          <select
            value={importGroup}
            aria-label={
              lang === "ru" ? "Группа для импорта" : "Импортқа арналған топ"
            }
            disabled={busy}
            onChange={(e) => {
              setImportGroup(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">
              {lang === "ru"
                ? "Брать группу из столбца cohortId"
                : "Топты cohortId бағанынан алу"}
            </option>
            {overview.cohorts.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        {importGroup && (
          <p className="muted">
            {lang === "ru"
              ? "Все ученики из файла попадут в выбранную группу. Столбец cohortId не нужен."
              : "Файлдағы барлық оқушылар таңдалған топқа қосылады. cohortId бағаны қажет емес."}
          </p>
        )}
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          aria-label={t("import")}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              setCsv(await file.text());
              setPreview(null);
            }
          }}
        />
        <Button
          variant="outline"
          disabled={!csv || busy}
          onClick={async () => {
            setBusy(true);
            try {
              setPreview(
                await api("importPreview", {
                  csv,
                  ...(importGroup ? { cohortId: importGroup } : {}),
                }),
              );
            } catch (e) {
              notify(error(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("preview")}
        </Button>
        {preview && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>№</th>
                    <th>{t("name")}</th>
                    <th>{t("group")}</th>
                    <th>{t("errors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td>{r.name}</td>
                      <td>
                        {overview.cohorts.find(
                          (group) => group.id === r.cohortId,
                        )?.name || r.cohortId}
                      </td>
                      <td>{r.error || "✓"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              disabled={busy || !preview.length || preview.some((r) => r.error)}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await api<{
                    created: Issued[];
                    failed: { row: number; name: string; error: string }[];
                  }>("importCommit", {
                    csv,
                    ...(importGroup ? { cohortId: importGroup } : {}),
                  });
                  setIssued(result.created);
                  setPreview(
                    result.failed.length
                      ? result.failed.map((r) => ({ ...r, cohortId: "" }))
                      : null,
                  );
                  setCsv("");
                  notify(
                    `${t("importDone")}: ${result.created.length}; ${t("errors")}: ${result.failed.length}`,
                  );
                  await load();
                } catch (e) {
                  notify(error(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("create")} ({preview.length})
            </Button>
          </>
        )}
      </details>
    </>
  );
}
function localDate(iso: string) {
  return new Date(new Date(iso).getTime() + 5 * 3600000)
    .toISOString()
    .slice(0, 16);
}
function toUtc(value: string) {
  return new Date(`${value}:00+05:00`).toISOString();
}
function Groups({
  overview,
  refresh,
}: {
  overview: Overview;
  refresh: () => void;
}) {
  const { t, notify, error, date } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="page-heading">
        <h1>{t("groups")}</h1>
      </div>
      {overview.cohorts.map((g) => (
        <form
          className="panel inline-form"
          key={g.id}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api("cohort", {
                id: g.id,
                courseId: g.courseId,
                name: f.get("name"),
                startDate: toUtc(String(f.get("startDate"))),
              });
              notify(t("saved"));
              refresh();
            } catch (e) {
              notify(error(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("name")}
            <input name="name" defaultValue={g.name} required />
            <small>
              {g.id} · {g._count.enrollments} {t("students").toLowerCase()}
            </small>
          </label>
          <label>
            {t("groupStart")}
            <input
              name="startDate"
              type="datetime-local"
              defaultValue={localDate(g.startDate)}
              required
            />
          </label>
          <Button disabled={busy}>{t("save")}</Button>
        </form>
      ))}
      <section className="panel">
        <h2>{t("createGroup")}</h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            setBusy(true);
            try {
              await api("cohort", {
                name: f.get("name"),
                courseId: f.get("courseId"),
                startDate: toUtc(String(f.get("startDate"))),
              });
              form.reset();
              refresh();
              notify(t("saved"));
            } catch (e) {
              notify(error(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("name")}
            <input name="name" required minLength={2} />
          </label>
          <label>
            {t("program")}
            <select name="courseId">
              {overview.courses.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("groupStart")}
            <input type="datetime-local" name="startDate" required />
          </label>
          <Button disabled={busy}>{t("create")}</Button>
        </form>
      </section>
    </>
  );
}
function LessonEditor({ id }: { id: string }) {
  const { t, notify, error } = useApp();
  const [lesson, setLesson] = useState<Editor | null>(null),
    [questions, setQuestions] = useState<EditableQuestion[]>([]),
    [hwStatus, setHwStatus] = useState("DRAFT"),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState("");
  async function load() {
    try {
      const l = await api<Editor>("editor", undefined, { id });
      if (!l) throw new Error("NOT_FOUND");
      setLesson(l);
      setQuestions(l.homework?.questions || []);
      setHwStatus(l.homework?.status || "DRAFT");
    } catch (e) {
      setFailed(error(e));
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  if (failed) return <ErrorState message={failed} retry={load} />;
  if (!lesson) return <Loading />;
  function updateQuestion(index: number, data: Partial<EditableQuestion>) {
    setQuestions((old) =>
      old.map((q, i) => (i === index ? { ...q, ...data } : q)),
    );
  }
  return (
    <>
      <Link className="back-link" href="/admin/course">
        <ArrowLeft size={16} />
        {t("lessons")}
      </Link>
      <div className="page-heading">
        <h1>{lesson.title}</h1>
      </div>
      <form
        className="panel editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("lesson", { ...lesson });
            notify(t("saved"));
          } catch (e) {
            notify(error(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t("title")}
          <input
            value={lesson.title}
            required
            onChange={(e) => setLesson({ ...lesson, title: e.target.value })}
          />
        </label>
        <label>
          {t("description")}
          <textarea
            value={lesson.description}
            onChange={(e) =>
              setLesson({ ...lesson, description: e.target.value })
            }
          />
        </label>
        <div className="form-grid">
          <label>
            {t("videoId")}
            <input
              value={lesson.videoId || ""}
              onChange={(e) =>
                setLesson({ ...lesson, videoId: e.target.value.trim() || null })
              }
            />
          </label>
          <label>
            {t("status")}
            <select
              value={lesson.status}
              onChange={(e) => setLesson({ ...lesson, status: e.target.value })}
            >
              <option value="DRAFT">{t("draft")}</option>
              <option value="PUBLISHED">{t("published")}</option>
            </select>
          </label>
          <label>
            {t("opening")}
            <select
              value={lesson.unlockType}
              onChange={(e) =>
                setLesson({ ...lesson, unlockType: e.target.value })
              }
            >
              <option value="RELATIVE_TO_COHORT_START">{t("relative")}</option>
              <option value="ABSOLUTE_DATE">{t("absolute")}</option>
            </select>
          </label>
          {lesson.unlockType === "RELATIVE_TO_COHORT_START" ? (
            <label>
              {t("offset")}
              <input
                type="number"
                min={0}
                max={3650}
                value={lesson.unlockOffsetDays}
                onChange={(e) =>
                  setLesson({
                    ...lesson,
                    unlockOffsetDays: Number(e.target.value),
                  })
                }
              />
            </label>
          ) : (
            <label>
              {t("date")}
              <input
                type="datetime-local"
                required
                value={
                  lesson.availableFrom ? localDate(lesson.availableFrom) : ""
                }
                onChange={(e) =>
                  setLesson({
                    ...lesson,
                    availableFrom: e.target.value
                      ? toUtc(e.target.value)
                      : null,
                  })
                }
              />
            </label>
          )}
        </div>
        <Button disabled={busy}>
          <Save size={16} />
          {t("save")}
        </Button>
      </form>
      <section className="panel question-editor">
        <div className="section-heading">
          <h2>{t("homework")}</h2>
          <span className="badge">3 · {t("attempts")} / ≥80%</span>
        </div>
        <label>
          {t("status")}
          <select
            value={hwStatus}
            onChange={(e) => setHwStatus(e.target.value)}
          >
            <option value="DRAFT">{t("draft")}</option>
            <option value="PUBLISHED">{t("published")}</option>
          </select>
        </label>
        {questions.map((q, index) => (
          <details
            className="edit-question"
            key={q.id}
            open={questions.length === 1}
          >
            <summary>
              {index + 1}.{" "}
              <MathText text={q.text.slice(0, 100) || t("question")} />
            </summary>
            <label>
              {t("question")}
              <textarea
                value={q.text}
                onChange={(e) =>
                  updateQuestion(index, { text: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                {t("type")}
                <select
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(index, { type: e.target.value })
                  }
                >
                  {[
                    "MULTIPLE_CHOICE",
                    "NUMBER",
                    "DECIMAL",
                    "FRACTION",
                    "SHORT_TEXT",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                {t("level")}
                <select
                  value={q.level}
                  onChange={(e) =>
                    updateQuestion(index, { level: e.target.value })
                  }
                >
                  {["A", "B", "C"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            {q.type === "MULTIPLE_CHOICE" &&
              q.options.map((v, i) => (
                <label key={i}>
                  {t("option")} {"ABCDE"[i]}
                  <input
                    value={v}
                    onChange={(e) =>
                      updateQuestion(index, {
                        options: q.options.map((o, n) =>
                          n === i ? e.target.value : o,
                        ),
                      })
                    }
                  />
                </label>
              ))}
            <label>
              {t("answer")}
              <input
                value={q.correctAnswer}
                onChange={(e) =>
                  updateQuestion(index, { correctAnswer: e.target.value })
                }
              />
            </label>
            <label>
              {t("explanation")}
              <textarea
                value={q.explanation}
                onChange={(e) =>
                  updateQuestion(index, { explanation: e.target.value })
                }
              />
            </label>
            <Button
              variant="danger"
              onClick={() =>
                setQuestions(questions.filter((_, i) => i !== index))
              }
            >
              {t("delete")}
            </Button>
          </details>
        ))}
        <div className="editor-actions">
          <Button
            variant="outline"
            onClick={() =>
              setQuestions([
                ...questions,
                {
                  id: crypto.randomUUID(),
                  order: questions.length + 1,
                  level: "A",
                  type: "MULTIPLE_CHOICE",
                  text: "",
                  options: ["", "", "", "", ""],
                  correctAnswer: "A",
                  acceptableAnswers: [],
                  tolerance: "0",
                  points: 1,
                  explanation: "",
                },
              ])
            }
          >
            <Plus size={16} />
            {t("addQuestion")}
          </Button>
          <Button
            disabled={busy || !questions.length}
            onClick={async () => {
              setBusy(true);
              try {
                await api("homework", {
                  lessonId: id,
                  status: hwStatus,
                  questions,
                });
                notify(t("saved"));
                await load();
              } catch (e) {
                notify(error(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save size={16} />
            {t("save")}
          </Button>
        </div>
      </section>
    </>
  );
}
