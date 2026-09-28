"use client";
import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import type { Issued, Me } from "@/lib/types";
import { api } from "@/lib/client";
import { useApp } from "./context";
import { Button } from "./ui/button";
import { Credentials } from "./admin";
import styles from "./staff.module.css";

type StaffRow = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status: string;
  _count: { assignedStudents: number };
};
type Assignments = {
  total: number;
  rows: { id: string; name: string; username: string; assigned: boolean }[];
};

export function Staff({ me }: { me: Me }) {
  const { lang, t, error, notify } = useApp();
  const ru = lang === "ru";
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued[]>([]);
  const [selected, setSelected] = useState("");
  async function load() {
    try {
      setRows(await api<StaffRow[]>("staff"));
      setFailure("");
    } catch (e) {
      setFailure(error(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function change(action: string, row: StaffRow) {
    const nextRole = row.role === "ADMIN" ? "SUPER_ADMIN" : "ADMIN";
    if (
      action === "staffRole" &&
      !window.confirm(
        ru
          ? `Изменить роль ${row.name}? ${nextRole === "SUPER_ADMIN" ? "Будет открыт доступ ко всем ученикам и администраторам." : "Останется доступ только к назначенным ученикам."}`
          : `${row.name} рөлін өзгертесіз бе? ${nextRole === "SUPER_ADMIN" ? "Барлық оқушылар мен әкімшілерге қолжетімділік ашылады." : "Тек бекітілген оқушыларға қолжетімділік қалады."}`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api<Issued>(action, {
        id: row.id,
        ...(action === "staffRole"
          ? { role: nextRole }
          : action === "staffStatus"
            ? { status: row.status === "ACTIVE" ? "BLOCKED" : "ACTIVE" }
            : {}),
      });
      if (action === "staffPassword") setIssued([result]);
      if (action === "staffRole" && selected === row.id) setSelected("");
      await load();
      notify(ru ? "Изменения сохранены." : "Өзгерістер сақталды.");
    } catch (e) {
      notify(error(e));
    } finally {
      setBusy(false);
    }
  }
  const curator = rows.find(
    (row) => row.id === selected && row.role === "ADMIN",
  );
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <h1>{ru ? "Администраторы" : "Әкімшілер"}</h1>
          <p>
            {ru
              ? "Суперадмин видит всех учеников. Куратор — только тех, кого вы ему назначили."
              : "Бас әкімші барлық оқушыларды көреді. Куратор тек сіз бекіткен оқушыларды көреді."}
          </p>
        </div>
        <Button onClick={() => setCreating(!creating)}>
          <Plus size={17} />
          {ru ? "Добавить администратора" : "Әкімші қосу"}
        </Button>
      </header>
      {issued.length > 0 && (
        <Credentials rows={issued} onClose={() => setIssued([])} />
      )}
      {creating && (
        <form
          className={styles.create}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fields = new FormData(form);
            setBusy(true);
            try {
              const result = await api<Issued>("createStaff", {
                name: fields.get("name"),
                username: fields.get("username"),
                role: fields.get("role"),
              });
              setIssued([result]);
              setCreating(false);
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
            <input name="name" required minLength={2} maxLength={150} />
          </label>
          <label>
            {t("username")}
            <input
              name="username"
              required
              pattern="[a-z0-9_.\-]{3,40}"
              autoComplete="off"
            />
          </label>
          <label>
            {ru ? "Роль" : "Рөл"}
            <select name="role">
              <option value="ADMIN">
                {ru ? "Администратор-куратор" : "Әкімші-куратор"}
              </option>
              <option value="SUPER_ADMIN">
                {ru ? "Суперадминистратор" : "Бас әкімші"}
              </option>
            </select>
          </label>
          <Button disabled={busy} type="submit">
            {t("create")}
          </Button>
          <p>
            {ru
              ? "Временный пароль появится после создания. При первом входе его нужно сменить."
              : "Уақытша құпиясөз тіркелгеннен кейін көрсетіледі. Алғашқы кіруде оны өзгерту қажет."}
          </p>
        </form>
      )}
      {failure && (
        <div role="alert" className={styles.message}>
          {failure}
          <Button onClick={load} variant="outline">
            {t("retry")}
          </Button>
        </div>
      )}
      {loading ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <div className={styles.layout}>
          <section
            aria-label={ru ? "Список администраторов" : "Әкімшілер тізімі"}
            className={styles.roster}
          >
            {rows.map((row) => (
              <article
                className={styles.member}
                key={row.id}
                data-selected={selected === row.id}
              >
                <div className={styles.memberHeading}>
                  {row.role === "SUPER_ADMIN" ? (
                    <ShieldCheck size={20} aria-hidden="true" />
                  ) : (
                    <UserRound size={20} aria-hidden="true" />
                  )}
                  <div>
                    <h2>
                      {row.name}
                      {row.id === me.id && (
                        <small>{ru ? " (вы)" : " (сіз)"}</small>
                      )}
                    </h2>
                    <p>{row.username}</p>
                  </div>
                  <span className={styles.status}>
                    {row.status === "ACTIVE" ? t("active") : t("blocked")}
                  </span>
                </div>
                <p className={styles.role}>
                  {row.role === "SUPER_ADMIN"
                    ? ru
                      ? "Суперадминистратор · все ученики"
                      : "Бас әкімші · барлық оқушылар"
                    : `${ru ? "Куратор · назначено учеников" : "Куратор · бекітілген оқушылар"}: ${row._count.assignedStudents}`}
                </p>
                <div className={styles.actions}>
                  {row.role === "ADMIN" && (
                    <Button
                      variant={selected === row.id ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => setSelected(row.id)}
                    >
                      {ru ? "Назначить учеников" : "Оқушыларды бекіту"}
                    </Button>
                  )}
                  {row.id !== me.id && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => change("staffRole", row)}
                      >
                        {row.role === "ADMIN"
                          ? ru
                            ? "Сделать суперадмином"
                            : "Бас әкімші ету"
                          : ru
                            ? "Сделать куратором"
                            : "Куратор ету"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => change("staffStatus", row)}
                      >
                        {row.status === "ACTIVE" ? t("block") : t("unblock")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => change("staffPassword", row)}
                      >
                        {t("reset")}
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </section>
          {curator ? (
            <AssignmentPanel
              key={curator.id}
              curator={curator}
              onChange={load}
            />
          ) : (
            <section className={styles.assignments}>
              <h2>{ru ? "Ученики куратора" : "Куратордың оқушылары"}</h2>
              <p className={styles.hint}>
                {ru
                  ? "Выберите «Назначить учеников» рядом с куратором. Один ученик может быть закреплён за несколькими кураторами."
                  : "Куратор жанындағы «Оқушыларды бекіту» батырмасын таңдаңыз. Бір оқушы бірнеше кураторға бекітіле алады."}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentPanel({
  curator,
  onChange,
}: {
  curator: StaffRow;
  onChange: () => Promise<void>;
}) {
  const { lang, t, error, notify } = useApp();
  const ru = lang === "ru";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Assignments>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure("");
    const timer = setTimeout(() => {
      void api<Assignments>("assignments", undefined, {
        curatorId: curator.id,
        q,
        page: String(page),
      })
        .then((value) => {
          if (!cancelled) setData(value);
        })
        .catch((e) => {
          if (!cancelled) setFailure(error(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [curator.id, q, page, retry]);
  return (
    <section
      className={styles.assignments}
      aria-label={ru ? "Назначение учеников" : "Оқушыларды бекіту"}
    >
      <h2>{curator.name}</h2>
      <p className={styles.hint}>
        {ru
          ? "Отметьте учеников, доступных этому куратору. Изменения сохраняются сразу."
          : "Осы кураторға қолжетімді оқушыларды белгілеңіз. Өзгерістер бірден сақталады."}
      </p>
      <label className={styles.search}>
        <Search size={18} aria-hidden="true" />
        <input
          aria-label={
            ru
              ? "Поиск учеников для назначения"
              : "Бекітуге арналған оқушыларды іздеу"
          }
          placeholder={`${t("name")} / ${t("username")}`}
          value={q}
          disabled={busy}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {failure ? (
        <div role="alert">
          {failure}
          <Button variant="outline" onClick={() => setRetry(retry + 1)}>
            {t("retry")}
          </Button>
        </div>
      ) : loading ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          <ul className={styles.students}>
            {data.rows.map((student) => (
              <li key={student.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={student.assigned}
                    disabled={busy}
                    onChange={async (e) => {
                      const assigned = e.target.checked;
                      setBusy(true);
                      setData((old) => ({
                        ...old,
                        rows: old.rows.map((row) =>
                          row.id === student.id ? { ...row, assigned } : row,
                        ),
                      }));
                      try {
                        await api("assignStudent", {
                          curatorId: curator.id,
                          studentId: student.id,
                          assigned,
                        });
                        await onChange();
                        notify(
                          ru ? "Назначение сохранено." : "Бекіту сақталды.",
                        );
                      } catch (e) {
                        setData((old) => ({
                          ...old,
                          rows: old.rows.map((row) =>
                            row.id === student.id
                              ? { ...row, assigned: !assigned }
                              : row,
                          ),
                        }));
                        notify(error(e));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                  <span>
                    <strong>{student.name}</strong>
                    <small>{student.username}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {!data.rows.length && <p>{t("noResults")}</p>}
          <div className={styles.pagination}>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t("previous")}
            </Button>
            <span>
              {page} / {Math.max(1, Math.ceil(data.total / 20))}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || page * 20 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
