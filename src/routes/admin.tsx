import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Profile } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Админ-панель — ReCorN" },
      { name: "description", content: "Панель администратора ReCorN." },
      { property: "og:title", content: "Админ-панель — ReCorN" },
      { property: "og:description", content: "Панель администратора ReCorN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type App = { id: string; user_id: string; roblox_nick: string; has_vip: boolean; reason: string; status: string };
type Role = { user_id: string; role: string };

const btn = "rounded-md px-3 py-1.5 text-xs font-bold transition-colors";

function AdminPage() {
  const { roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const [apps, setApps] = useState<App[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const [a, p, r] = await Promise.all([
      supabase.from("host_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("elo", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setApps((a.data as App[]) ?? []);
    setPlayers((p.data as Profile[]) ?? []);
    setAllRoles(r.data ?? []);
  }
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <Shield className="mx-auto size-10 text-destructive" />
        <p className="mt-3 font-bold">Доступ только для администраторов</p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary">На главную</Link>
      </div>
    );

  const has = (uid: string, role: string) => allRoles.some((r) => r.user_id === uid && r.role === role);
  const done = (error: unknown, text: string) => {
    setMsg(error ? "Ошибка: действие не выполнено" : text);
    load();
  };

  async function decide(app: App, approve: boolean) {
    const { error } = await supabase.from("host_applications").update({ status: approve ? "approved" : "rejected" }).eq("id", app.id);
    if (!error && approve && !has(app.user_id, "host"))
      await supabase.from("user_roles").insert({ user_id: app.user_id, role: "host" });
    done(error, approve ? `${app.roblox_nick} теперь хост` : "Заявка отклонена");
  }

  async function toggleRole(p: Profile, role: "moderator" | "host") {
    const { error } = has(p.id, role)
      ? await supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: p.id, role });
    done(error, "Роль обновлена");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="flex items-center gap-3 font-display text-2xl font-bold">
        <Shield className="size-6 text-primary" /> Админ-панель
      </h1>
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <section>
        <h2 className="font-display text-lg font-bold">Заявки на хоста</h2>
        <div className="mt-3 space-y-3">
          {apps.length === 0 && <p className="text-sm text-muted-foreground">Заявок пока нет.</p>}
          {apps.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">
                  {a.roblox_nick} <span className="text-xs text-muted-foreground">VIP: {a.has_vip ? "да" : "нет"}</span>
                </div>
                {a.status === "pending" ? (
                  <div className="flex gap-2">
                    <button onClick={() => decide(a, true)} className={`${btn} bg-success text-success-foreground`}>Одобрить</button>
                    <button onClick={() => decide(a, false)} className={`${btn} bg-destructive text-destructive-foreground`}>Отклонить</button>
                  </div>
                ) : (
                  <span className="text-xs font-bold uppercase text-muted-foreground">{a.status === "approved" ? "одобрена" : "отклонена"}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{a.reason}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold">Игроки</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Ник</th><th className="p-3">ELO</th><th className="p-3">Роли</th><th className="p-3">Действия</th></tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <PlayerRow key={p.id} p={p} roles={allRoles.filter((r) => r.user_id === p.id).map((r) => r.role)}
                  onElo={async (elo) => done((await supabase.from("profiles").update({ elo }).eq("id", p.id)).error, "ELO изменено")}
                  onBan={async () => done((await supabase.from("profiles").update({ banned: !p.banned }).eq("id", p.id)).error, p.banned ? "Разбанен" : "Забанен")}
                  onRole={(r) => toggleRole(p, r)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlayerRow({ p, roles, onElo, onBan, onRole }: {
  p: Profile; roles: string[]; onElo: (n: number) => void; onBan: () => void; onRole: (r: "moderator" | "host") => void;
}) {
  const [elo, setElo] = useState(String(p.elo));
  return (
    <tr className="border-t border-border">
      <td className="p-3 font-semibold">{p.nickname}{p.banned && <span className="ml-2 text-xs text-destructive">БАН</span>}</td>
      <td className="p-3">
        <div className="flex gap-1">
          <input type="number" min={0} value={elo} onChange={(e) => setElo(e.target.value)} className="w-20 rounded border border-input bg-background px-2 py-1" />
          <button onClick={() => onElo(Math.max(0, +elo || 0))} className={`${btn} bg-secondary`}>OK</button>
        </div>
      </td>
      <td className="p-3 text-xs uppercase text-primary">{roles.join(", ") || "—"}</td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          <button onClick={() => onRole("moderator")} className={`${btn} bg-secondary`}>{roles.includes("moderator") ? "Снять модера" : "Дать модера"}</button>
          <button onClick={() => onRole("host")} className={`${btn} bg-secondary`}>{roles.includes("host") ? "Снять хоста" : "Дать хоста"}</button>
          <button onClick={onBan} className={`${btn} bg-destructive text-destructive-foreground`}>{p.banned ? "Разбанить" : "Забанить"}</button>
        </div>
      </td>
    </tr>
  );
}
