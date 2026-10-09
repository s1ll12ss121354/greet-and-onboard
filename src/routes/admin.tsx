import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileWarning, History, Palette, Power, Shield, Users, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Админ-панель — RECORN" },
      { name: "description", content: "Административная и модераторская панель RECORN." },
      { property: "og:title", content: "Админ-панель — RECORN" },
      { property: "og:description", content: "Административная и модераторская панель RECORN." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type App = {
  id: string;
  user_id: string;
  roblox_nick: string;
  has_vip: boolean;
  reason: string;
  status: string;
  priority: boolean;
  discord_contact: string | null;
  telegram_contact: string | null;
  created_at: string;
};

type Report = {
  id: string;
  user_id: string;
  target_nick: string;
  reason: string;
  details: string;
  priority: boolean;
  status: string;
  created_at: string;
};

type BanRequest = {
  id: string;
  report_id: string;
  target_nick: string;
  requested_by: string;
  status: string;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type CustomRole = {
  id: string;
  name: string;
  color: string;
  description: string;
};

type UserCustomRole = { user_id: string; role_id: string };

type ActivityLog = {
  id: string;
  user_id: string;
  event_type: string;
  path: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type LoginEvent = {
  id: string;
  user_id: string;
  device_category: string;
  browser: string | null;
  os: string | null;
  ip_hash: string | null;
  created_at: string;
};

const btn = "rounded-md px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50";

function AdminPage() {
  const { roles, loading, profile } = useAuth();
  const isOwner = profile?.nickname.trim().toLowerCase() === "isy_hesy09";
  const isAdmin = roles.includes("admin");
  const isModerator = roles.includes("moderator");
  const effectiveAdmin = isAdmin || isOwner;
  const allowed = effectiveAdmin || isModerator;
  const [tab, setTab] = useState<"reports" | "applications" | "players" | "logs" | "roles">("reports");
  const [apps, setApps] = useState<App[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [allRoles, setAllRoles] = useState<{ user_id: string; role: string }[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [banRequests, setBanRequests] = useState<BanRequest[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [userCustomRoles, setUserCustomRoles] = useState<UserCustomRole[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [logins, setLogins] = useState<LoginEvent[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [banDialogReport, setBanDialogReport] = useState<Report | null>(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  async function load() {
    if (!allowed) return;

    const reportQuery = supabase.from("reports").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false });
    const banQuery = supabase.from("ban_requests").select("*").order("created_at", { ascending: false });
    const [r, br] = await Promise.all([reportQuery, banQuery]);

    setReports((r.data as Report[]) ?? []);
    setBanRequests((br.data as BanRequest[]) ?? []);

    if (!effectiveAdmin) return;

    const [a, p, rolesResult, cr, ucr, logsResult, loginResult] = await Promise.all([
      supabase.from("host_applications").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("elo", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("custom_roles").select("id,name,color,description").order("created_at", { ascending: false }),
      supabase.from("user_custom_roles").select("user_id,role_id"),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("security_login_events").select("*").order("created_at", { ascending: false }).limit(300),
    ]);

    setApps((a.data as App[]) ?? []);
    setPlayers((p.data as Profile[]) ?? []);
    setAllRoles(rolesResult.data ?? []);
    setCustomRoles((cr.data as CustomRole[]) ?? []);
    setUserCustomRoles((ucr.data as UserCustomRole[]) ?? []);
    setActivity((logsResult.data as ActivityLog[]) ?? []);
    setLogins((loginResult.data as LoginEvent[]) ?? []);
  }

  useEffect(() => {
    if (allowed) load();
  }, [allowed, effectiveAdmin]);

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    const readMaintenance = async () => {
      try {
        const { data, error } = await supabase.rpc("get_site_maintenance");
        if (active && !error) setMaintenanceEnabled(Boolean(data));
      } catch {
        if (active) setMsg("Не удалось прочитать статус техработ.");
      }
    };
    void readMaintenance();
    return () => { active = false; };
  }, [isOwner]);

  async function toggleMaintenance() {
    if (!isOwner || maintenanceBusy) return;
    const next = !maintenanceEnabled;
    const confirmed = window.confirm(
      next
        ? "Включить техработы? Все посетители, кроме овнера, увидят экран обслуживания."
        : "Выключить техработы и вернуть обычный сайт всем посетителям?"
    );
    if (!confirmed) return;

    setMaintenanceBusy(true);
    setMsg("");
    try {
      const { data, error } = await supabase.rpc("owner_set_site_maintenance", { p_enabled: next });
      if (error) throw error;
      setMaintenanceEnabled(Boolean(data));
      setMsg(next
        ? "Техработы включены. Обычный сайт скрывается у всех, кроме овнера."
        : "Техработы выключены. Обычный сайт снова доступен.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Не удалось изменить режим техработ.");
    } finally {
      setMaintenanceBusy(false);
    }
  }

  useEffect(() => {
    if (isModerator && !isAdmin) setTab("reports");
  }, [isModerator, isAdmin]);

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <Shield className="mx-auto size-10 text-destructive" />
        <p className="mt-3 font-bold">Доступ только для администрации и модераторов</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary">На главную</Link>
      </div>
    );
  }

  const has = (uid: string, role: string) => allRoles.some((r) => r.user_id === uid && r.role === role);

  async function refresh(message?: string) {
    if (message) setMsg(message);
    await load();
  }

  async function decide(app: App, approve: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_review_host_application", {
      p_application_id: app.id,
      p_approve: approve,
    });
    setBusy(false);
    await refresh(error ? "Ошибка: не удалось обработать заявку" : approve ? app.roblox_nick + " теперь хост" : "Заявка отклонена");
  }

  async function reviewReport(report: Report, status: "resolved" | "rejected", banMinutes: number | null = null, banReason = "") {
    if (status === "resolved" && banMinutes === null && !banReason) {
      setBanDialogReport(report);
      return;
    }
    setBusy(true);
    const args: { p_report_id: string; p_status: string; p_ban_minutes?: number; p_ban_reason?: string } = {
      p_report_id: report.id,
      p_status: status,
    };
    if (status === "resolved") {
      if (banMinutes !== null) args.p_ban_minutes = banMinutes;
      if (banReason) args.p_ban_reason = banReason;
    }
    const { error } = await supabase.rpc("admin_set_report_status", args);
    setBusy(false);
    if (!error) setBanDialogReport(null);
    await refresh(error ? "Ошибка: не удалось обработать жалобу" : status === "resolved" ? "Жалоба одобрена и бан применён" : "Жалоба отклонена");
  }
  async function toggleRole(p: Profile, role: "moderator" | "host") {
    setBusy(true);
    const result = has(p.id, role)
      ? await supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: p.id, role });
    await supabase.rpc("log_activity", {
      p_event_type: has(p.id, role) ? "role_removed" : "role_granted",
      p_path: "/admin",
      p_details: { target_user_id: p.id, role },
    });
    setBusy(false);
    await refresh(result.error ? "Ошибка: роль не изменена" : "Роль обновлена");
  }

  async function setElo(p: Profile, elo: number) {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ elo: Math.max(0, elo) }).eq("id", p.id);
    await supabase.rpc("log_activity", {
      p_event_type: "elo_changed",
      p_path: "/admin",
      p_details: { target_user_id: p.id, elo },
    });
    setBusy(false);
    await refresh(error ? "Ошибка: ELO не изменён" : "ELO изменён");
  }

  async function setBan(p: Profile, banned: boolean) {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ banned }).eq("id", p.id);
    await supabase.rpc("log_activity", {
      p_event_type: banned ? "player_banned" : "player_unbanned",
      p_path: "/admin",
      p_details: { target_user_id: p.id, nickname: p.nickname },
    });
    setBusy(false);
    await refresh(error ? "Ошибка: бан не изменён" : banned ? "Игрок забанен" : "Игрок разбанен");
  }

  async function setSupportPriority(p: Profile, enabled: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_support_priority", {
      p_user_id: p.id,
      p_enabled: enabled,
    });
    setBusy(false);
    await refresh(error ? "Ошибка: приоритет не изменён" : enabled ? "Приоритет поддержки включён" : "Приоритет поддержки выключен");
  }

  async function requestBan(report: Report) {
    setBusy(true);
    const { error } = await supabase.rpc("request_report_ban", { p_report_id: report.id });
    setBusy(false);
    await refresh(error ? "Не удалось создать запрос на бан" : "Запрос на бан отправлен администратору");
  }

  async function reviewBan(request: BanRequest, approve: boolean) {
    setBusy(true);
    const { error } = await supabase.rpc("review_ban_request", {
      p_request_id: request.id,
      p_approve: approve,
    });
    setBusy(false);
    await refresh(error ? "Не удалось обработать запрос" : approve ? "Бан подтверждён" : "Запрос отклонён");
  }

  async function setPlayerPassword(userId: string, password: string) {
    if (!isOwner) {
      setMsg("Менять пароли может только создатель Recorn.");
      return;
    }
    if (password.length < 10) {
      setMsg("Пароль должен содержать минимум 10 символов.");
      return;
    }
    setBusy(true);
    setMsg("");
    const { error } = await supabase.functions.invoke("owner-set-password", {
      body: { target_user_id: userId, password },
    });
    setBusy(false);
    if (error) {
      setMsg("Не удалось изменить пароль. Проверь, что серверная функция owner-set-password опубликована и настроена.");
      return;
    }
    await supabase.rpc("log_activity", {
      p_event_type: "owner_password_changed",
      p_path: "/admin",
      p_details: { target_user_id: userId },
    });
    setMsg("Пароль игрока изменён.");
  }

  const title = effectiveAdmin ? "Админ-панель" : "Модерация";
  const tabs = effectiveAdmin
    ? [
        ["reports", "Жалобы", FileWarning],
        ["applications", "Заявки", ClipboardList],
        ["players", "Игроки", Users],
        ["logs", "Логи", History],
        ["roles", "Роли", Palette],
      ] as const
    : [["reports", "Жалобы", FileWarning]] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-display text-2xl font-bold">
            <Shield className="size-6 text-primary" /> {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Полный контроль проекта и аудит действий." : "Просмотр жалоб. Бан — только после подтверждения администратора."}
          </p>
        </div>
        <Link to="/" className={`${btn} bg-secondary`}>На главную</Link>
      </header>

      {isOwner && (
        <section className={`relative overflow-hidden rounded-2xl border p-5 ${maintenanceEnabled ? "border-amber-400/40 bg-amber-400/5" : "border-border bg-card"}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={`rounded-xl p-3 ${maintenanceEnabled ? "bg-amber-400/10 text-amber-300" : "bg-secondary text-foreground"}`}>
                <Wrench className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Режим технических работ</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {maintenanceEnabled
                    ? "Сайт закрыт для всех посетителей, кроме овнера. На экране показан анимированный код и контакт поддержки."
                    : "Одна кнопка переключает сайт на экран техработ. Твой аккаунт овнера останется с доступом к сайту."}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold">
                  <span className={`size-2 rounded-full ${maintenanceEnabled ? "bg-amber-300" : "bg-emerald-400"}`} />
                  {maintenanceEnabled ? "Техработы включены" : "Сайт работает обычно"}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={maintenanceBusy}
              onClick={toggleMaintenance}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition disabled:opacity-50 ${maintenanceEnabled ? "bg-emerald-400 text-black hover:bg-emerald-300" : "bg-amber-300 text-black hover:bg-amber-200"}`}
            >
              <Power className="size-4" />
              {maintenanceBusy ? "Сохраняем…" : maintenanceEnabled ? "Снять техработы" : "Закрыть на техработы"}
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`${btn} ${tab === key ? "bg-primary text-primary-foreground" : "bg-secondary"} inline-flex items-center gap-2`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {msg && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{msg}</div>}

      {tab === "reports" && (
        <ReportsSection
          reports={reports}
          banRequests={banRequests}
          isAdmin={effectiveAdmin}
          busy={busy}
          onRequestBan={requestBan}
          onReviewBan={reviewBan}
          onReviewReport={reviewReport}
          onRefresh={() => refresh()}
        />
      )}

      {effectiveAdmin && tab === "applications" && (
        <ApplicationsSection apps={apps} busy={busy} onDecide={decide} />
      )}

      {effectiveAdmin && tab === "players" && (
        <PlayersSection
          players={players}
          roles={allRoles}
          userCustomRoles={userCustomRoles}
          customRoles={customRoles}
          busy={busy}
          onElo={setElo}
          onBan={setBan}
          onRole={toggleRole}
          ownerCanAdmin={isOwner}
          onAdmin={async (userId) => {
            setBusy(true);
            const { error } = await supabase.rpc("owner_grant_admin", { p_user_id: userId });
            setBusy(false);
            await refresh(error ? `Не удалось выдать администратора: ${error.message}` : "Права администратора выданы");
          }}
          onSupportPriority={setSupportPriority}
          onAssignCustom={async (userId, roleId) => {
            setBusy(true);
            const { error } = await supabase.rpc("admin_assign_custom_role", { p_user_id: userId, p_role_id: roleId });
            setBusy(false);
            await refresh(error ? "Не удалось выдать кастомную роль" : "Кастомная роль выдана");
          }}
          onRemoveCustom={async (userId, roleId) => {
            setBusy(true);
            const { error } = await supabase.rpc("admin_remove_custom_role", { p_user_id: userId, p_role_id: roleId });
            setBusy(false);
            await refresh(error ? "Не удалось снять кастомную роль" : "Кастомная роль снята");
          }}
          onSetPassword={setPlayerPassword}
        />
      )}

      {effectiveAdmin && tab === "logs" && <LogsSection activity={activity} logins={logins} players={players} />}
      {effectiveAdmin && tab === "roles" && (
        <RolesSection
          customRoles={customRoles}
          busy={busy}
          onRefresh={() => refresh()}
        />
      )}
      {banDialogReport && (
        <BanDialog
          report={banDialogReport}
          busy={busy}
          onCancel={() => setBanDialogReport(null)}
          onConfirm={(minutes, reason) => reviewReport(banDialogReport, "resolved", minutes, reason)}
        />
      )}
    </div>
  );
}

function BanDialog({ report, busy, onCancel, onConfirm }: { report: Report; busy: boolean; onCancel: () => void; onConfirm: (minutes: number | null, reason: string) => void }) {
  const [minutes, setMinutes] = useState<number | null>(1440);
  const [reason, setReason] = useState("");
  const options = [[60, "1 час"], [1440, "1 день"], [4320, "3 дня"], [10080, "7 дней"], [43200, "30 дней"], [null, "Навсегда"]] as const;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
      <h2 className="text-lg font-bold">Одобрение жалобы</h2>
      <p className="mt-1 text-sm text-muted-foreground">Игрок: <b>{report.target_nick}</b></p>
      <label className="mt-4 block text-sm font-semibold">Срок бана</label>
      <select value={minutes ?? "forever"} onChange={(e) => setMinutes(e.target.value === "forever" ? null : Number(e.target.value))} className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
        {options.map(([value, label]) => <option key={label} value={value ?? "forever"}>{label}</option>)}
      </select>
      <label className="mt-4 block text-sm font-semibold">Причина <span className="text-destructive">*</span></label>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} placeholder="Укажите причину бана..." className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      <div className="mt-4 flex justify-end gap-2">
        <button disabled={busy} onClick={onCancel} className={btn + " bg-secondary"}>Отмена</button>
        <button disabled={busy || !reason.trim()} onClick={() => onConfirm(minutes, reason.trim())} className={btn + " bg-destructive text-destructive-foreground"}>Забанить и одобрить</button>
      </div>
    </div>
  </div>;
}

function ReportsSection({
  reports,
  banRequests,
  isAdmin,
  busy,
  onRequestBan,
  onReviewBan,
  onReviewReport,
  onRefresh,
}: {
  reports: Report[];
  banRequests: BanRequest[];
  isAdmin: boolean;
  busy: boolean;
  onRequestBan: (r: Report) => void;
  onReviewBan: (r: BanRequest, approve: boolean) => void;
  onReviewReport: (r: Report, status: "resolved" | "rejected") => void;
  onRefresh: () => void;
}) {
  const pending = banRequests.filter((x) => x.status === "pending");
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Жалобы</h2>
        <button onClick={onRefresh} className={`${btn} bg-secondary`}>Обновить</button>
      </div>

      {isAdmin && pending.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="font-bold">Запросы модераторов на бан</h3>
          <div className="mt-3 space-y-2">
            {pending.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div className="text-sm">
                  <b>{request.target_nick}</b>
                  <span className="ml-2 text-xs text-muted-foreground">запрос: {request.id.slice(0, 8)}</span>
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => onReviewBan(request, true)} className={`${btn} bg-destructive text-destructive-foreground`}>Подтвердить бан</button>
                  <button disabled={busy} onClick={() => onReviewBan(request, false)} className={`${btn} bg-secondary`}>Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {reports.length === 0 && <p className="text-sm text-muted-foreground">Жалоб пока нет.</p>}
        {reports.map((report) => {
          const pendingRequest = pending.find((x) => x.report_id === report.id);
          return (
            <article key={report.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-bold">
                    {report.target_nick}
                    {report.priority && <span className="ml-2 rounded bg-primary/10 px-2 py-1 text-[10px] uppercase text-primary">приоритет</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{report.reason} · {formatDate(report.created_at)} · {report.status}</div>
                </div>
                {isAdmin && report.status === "open" ? (
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => onReviewReport(report, "resolved")} className={`${btn} bg-success text-success-foreground`}>Одобрить</button>
                    <button disabled={busy} onClick={() => onReviewReport(report, "rejected")} className={`${btn} bg-destructive text-destructive-foreground`}>Отклонить</button>
                  </div>
                ) : !isAdmin && report.status === "open" && !pendingRequest ? (
                  <button disabled={busy} onClick={() => onRequestBan(report)} className={`${btn} bg-destructive text-destructive-foreground`}>
                    Запросить бан
                  </button>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{report.details || "Без дополнительного описания."}</p>
              {pendingRequest && <p className="mt-3 text-xs font-semibold text-primary">Запрос на бан уже отправлен администратору.</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ApplicationsSection({ apps, busy, onDecide }: { apps: App[]; busy: boolean; onDecide: (a: App, approve: boolean) => void }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold">Заявки на хоста</h2>
      <div className="mt-3 space-y-3">
        {apps.length === 0 && <p className="text-sm text-muted-foreground">Заявок пока нет.</p>}
        {apps.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-bold">
                {a.roblox_nick}
                {a.priority && <span className="ml-2 rounded bg-primary/10 px-2 py-1 text-[10px] uppercase text-primary">приоритет</span>}
                <span className="ml-2 text-xs text-muted-foreground">VIP: {a.has_vip ? "да" : "нет"}</span>
              </div>
              {a.status === "pending" ? (
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => onDecide(a, true)} className={`${btn} bg-success text-success-foreground`}>Одобрить</button>
                  <button disabled={busy} onClick={() => onDecide(a, false)} className={`${btn} bg-destructive text-destructive-foreground`}>Отклонить</button>
                </div>
              ) : (
                <span className="text-xs font-bold uppercase text-muted-foreground">{a.status === "approved" ? "одобрена" : "отклонена"}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{a.reason}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-border bg-background/60 px-2 py-1">Discord: {a.discord_contact || "—"}</span>
              <span className="rounded-lg border border-border bg-background/60 px-2 py-1">Telegram: {a.telegram_contact || "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayersSection({
  players,
  roles,
  userCustomRoles,
  customRoles,
  busy,
  onElo,
  onBan,
  onRole,
  ownerCanAdmin,
  onAdmin,
  onSupportPriority,
  onAssignCustom,
  onRemoveCustom,
  onSetPassword,
}: {
  players: Profile[];
  roles: { user_id: string; role: string }[];
  userCustomRoles: UserCustomRole[];
  customRoles: CustomRole[];
  busy: boolean;
  onElo: (p: Profile, n: number) => void;
  onBan: (p: Profile, banned: boolean) => void;
  onRole: (p: Profile, role: "moderator" | "host") => void;
  ownerCanAdmin: boolean;
  onAdmin: (userId: string) => void;
  onSupportPriority: (p: Profile, enabled: boolean) => void;
  onAssignCustom: (userId: string, roleId: string) => void;
  onRemoveCustom: (userId: string, roleId: string) => void;
  onSetPassword: (userId: string, password: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold">Игроки</h2>
      <div className="mt-3 space-y-3">
        {players.map((p) => (
          <PlayerCard
            key={p.id}
            p={p}
            roles={roles.filter((r) => r.user_id === p.id).map((r) => r.role)}
            customRoles={customRoles}
            assigned={userCustomRoles.filter((r) => r.user_id === p.id).map((r) => r.role_id)}
            busy={busy}
            onElo={(n) => onElo(p, n)}
            onBan={() => onBan(p, !p.banned)}
            onRole={(r) => onRole(p, r)}
            ownerCanAdmin={ownerCanAdmin}
            onAdmin={() => onAdmin(p.id)}
            onSupportPriority={(enabled) => onSupportPriority(p, enabled)}
            onAssign={(roleId) => onAssignCustom(p.id, roleId)}
            onRemove={(roleId) => onRemoveCustom(p.id, roleId)}
            onSetPassword={(password) => onSetPassword(p.id, password)}
          />
        ))}
      </div>
    </section>
  );
}

function PlayerCard({
  p,
  roles,
  customRoles,
  assigned,
  busy,
  onElo,
  onBan,
  onRole,
  ownerCanAdmin,
  onAdmin,
  onSupportPriority,
  onAssign,
  onRemove,
  onSetPassword,
}: {
  p: Profile;
  roles: string[];
  customRoles: CustomRole[];
  assigned: string[];
  busy: boolean;
  onElo: (n: number) => void;
  onBan: () => void;
  onRole: (r: "moderator" | "host") => void;
  ownerCanAdmin: boolean;
  onAdmin: () => void;
  onSupportPriority: (enabled: boolean) => void;
  onAssign: (roleId: string) => void;
  onRemove: (roleId: string) => void;
  onSetPassword: (password: string) => void;
}) {
  const [elo, setElo] = useState(String(p.elo));
  const [roleId, setRoleId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const assignedRoles = customRoles.filter((r) => assigned.includes(r.id));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-bold">{p.nickname}{p.banned && <span className="ml-2 text-xs text-destructive">БАН</span>}</div>
          <div className="mt-1 text-xs uppercase text-primary">{roles.join(", ") || "user"}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {assignedRoles.map((r) => (
              <button key={r.id} disabled={busy} onClick={() => onRemove(r.id)} title="Снять кастомную роль" className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{ borderColor: r.color, color: r.color }}>
                {r.name} ×
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" checked={p.support_priority} disabled={busy} onChange={(e) => onSupportPriority(e.target.checked)} />
          Приоритет поддержки
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="flex gap-1">
          <input type="number" min={0} value={elo} onChange={(e) => setElo(e.target.value)} className="w-24 rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <button disabled={busy} onClick={() => onElo(Math.max(0, Number(elo) || 0))} className={`${btn} bg-secondary`}>ELO</button>
        </div>
        <button disabled={busy} onClick={() => onRole("moderator")} className={`${btn} bg-secondary`}>{roles.includes("moderator") ? "Снять модера" : "Дать модера"}</button>
        <button disabled={busy} onClick={() => onRole("host")} className={`${btn} bg-secondary`}>{roles.includes("host") ? "Снять хоста" : "Дать хоста"}</button>
        {ownerCanAdmin && (
          <button disabled={busy || roles.includes("admin")} onClick={onAdmin} className={`${btn} bg-primary text-primary-foreground`}>
            {roles.includes("admin") ? "Уже админ" : "Дать админа"}
          </button>
        )}
        <button disabled={busy} onClick={onBan} className={`${btn} bg-destructive text-destructive-foreground`}>{p.banned ? "Разбанить" : "Забанить"}</button>
      </div>

      {ownerCanAdmin && (
        <form
          className="mt-3 flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 10) return;
            if (!window.confirm(`Изменить пароль игрока ${p.nickname}?`)) return;
            onSetPassword(newPassword);
            setNewPassword("");
          }}
        >
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Новый пароль (минимум 10 символов)"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button disabled={busy || newPassword.length < 10} className={`${btn} bg-primary text-primary-foreground`}>
            Установить пароль
          </button>
        </form>
      )}

      {customRoles.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs">
            <option value="">Кастомная роль...</option>
            {customRoles.filter((r) => !assigned.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button disabled={busy || !roleId} onClick={() => { onAssign(roleId); setRoleId(""); }} className={`${btn} bg-primary text-primary-foreground`}>Выдать роль</button>
        </div>
      )}
    </div>
  );
}

function RolesSection({ customRoles, busy, onRefresh }: { customRoles: CustomRole[]; busy: boolean; onRefresh: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7c3aed");
  const [description, setDescription] = useState("");

  async function createRole() {
    const { error } = await supabase.rpc("admin_create_custom_role", {
      p_name: name,
      p_color: color,
      p_description: description,
    });
    if (error) return;
    setName("");
    setDescription("");
    onRefresh();
  }

  async function deleteRole(id: string) {
    if (!window.confirm("Удалить кастомную роль?")) return;
    await supabase.rpc("admin_delete_custom_role", { p_role_id: id });
    onRefresh();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">Кастомные роли</h2>
        <p className="mt-1 text-sm text-muted-foreground">Создай роль, затем выдай её игроку во вкладке «Игроки».</p>
        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_120px_2fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Например: Supporter" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="text" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160} placeholder="Описание" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={busy || name.trim().length < 2} onClick={createRole} className={`${btn} bg-primary text-primary-foreground`}>Создать</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {customRoles.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold" style={{ color: r.color }}>{r.name}</span>
              <button disabled={busy} onClick={() => deleteRole(r.id)} className={`${btn} bg-destructive text-destructive-foreground`}>Удалить</button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{r.description || "Без описания"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogsSection({ activity, logins, players }: { activity: ActivityLog[]; logins: LoginEvent[]; players: Profile[] }) {
  const names = useMemo(() => new Map(players.map((p) => [p.id, p.nickname])), [players]);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-bold">Логи действий</h2>
        <p className="mt-1 text-sm text-muted-foreground">Кто куда заходил и какие административные действия выполнялись.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Игрок</th><th className="p-3">Событие</th><th className="p-3">Страница</th><th className="p-3">Время</th></tr>
          </thead>
          <tbody>
            {activity.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="p-3 font-semibold">{names.get(log.user_id) ?? log.user_id.slice(0, 8)}</td>
                <td className="p-3">{eventLabel(log.event_type)}</td>
                <td className="p-3 text-muted-foreground">{log.path || "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {activity.length === 0 && <p className="p-5 text-sm text-muted-foreground">Логов пока нет.</p>}
      </div>

      <div>
        <h2 className="font-display text-lg font-bold">Входы и устройства</h2>
        <p className="mt-1 text-sm text-muted-foreground">IP хранится в виде хеша, чтобы не показывать администраторам исходный IP.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Игрок</th><th className="p-3">Устройство</th><th className="p-3">ОС / браузер</th><th className="p-3">IP hash</th><th className="p-3">Время</th></tr>
          </thead>
          <tbody>
            {logins.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="p-3 font-semibold">{names.get(log.user_id) ?? log.user_id.slice(0, 8)}</td>
                <td className="p-3">{log.device_category}</td>
                <td className="p-3 text-xs text-muted-foreground">{log.os || "—"} / {log.browser || "—"}</td>
                <td className="p-3 font-mono text-[10px] text-muted-foreground">{log.ip_hash || "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logins.length === 0 && <p className="p-5 text-sm text-muted-foreground">Входов пока нет.</p>}
      </div>
    </section>
  );
}

function eventLabel(event: string) {
  const labels: Record<string, string> = {
    page_view: "Открыл страницу",
    host_application_approved: "Одобрил заявку хоста",
    host_application_rejected: "Отклонил заявку хоста",
    role_granted: "Выдал роль",
    role_removed: "Снял роль",
    elo_changed: "Изменил ELO",
    player_banned: "Забанил игрока",
    player_unbanned: "Разбанил игрока",
    support_priority_enabled: "Включил приоритет поддержки",
    support_priority_disabled: "Выключил приоритет поддержки",
    custom_role_created: "Создал кастомную роль",
    custom_role_assigned: "Выдал кастомную роль",
    custom_role_removed: "Снял кастомную роль",
    custom_role_deleted: "Удалил кастомную роль",
    ban_request_created: "Создал запрос на бан",
    ban_request_approved: "Подтвердил бан",
    ban_request_rejected: "Отклонил запрос на бан",
    report_approved: "Одобрил жалобу и забанил игрока",
    report_rejected: "Отклонил жалобу",
  };
  return labels[event] || event;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" });
}
