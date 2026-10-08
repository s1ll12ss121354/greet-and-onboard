import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Crown, LogIn, Plus, RefreshCw, Search, Shield, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

export const Route = createFileRoute("/matchmaking")({
  head: () => ({ meta: [
    { title: "Matchmaking — ReCorN" },
    { name: "description", content: "Поиск соревновательной игры Block Strike по ELO." },
  ]}),
  component: MatchmakingPage,
});

type Lobby = {
  id: string;
  status: string;
  creator_id: string;
  player_count: number;
  spectator_count: number;
  search_started_at: string;
  host_user_id: string | null;
};

type Member = { id: string; user_id: string; member_kind: "player" | "spectator"; joined_at: string };
type Player = { id: string; nickname: string; elo: number };

const text = {
  ru: {
    title:"Поиск игры", subtitle:"Подберём игроков с похожим ELO и расширим диапазон, если поиск затянется.",
    search:"Найти игру", create:"Создать лобби", refresh:"Обновить", leave:"Выйти из лобби",
    login:"Войти", range:"Диапазон поиска", waiting:"Ожидание", players:"Игроки", spectators:"Наблюдатели",
    host:"Хост", hostNeeded:"Нужен хост", ready:"Готово", searching:"Ищем игроков", waitingLobby:"Лобби ожидает игроков",
    friend:"Когда матч найден, добавьте хоста в друзья в Block Strike:", noHost:"Привилегированного хоста пока нет. Онлайн-хосты получили уведомление.",
    open:"Открытые лобби", join:"Присоединиться", full:"Заполнено", staff:"Staff", player:"Игрок",
    error:"Не удалось выполнить действие. Попробуйте ещё раз.", auth:"Для поиска игры войдите в аккаунт.",
    elo:"ELO", minute:"мин", lobby:"Лобби", copied:"Ник хоста",
  },
  en: {
    title:"Find a game", subtitle:"We match players with similar ELO and widen the range if the search takes longer.",
    search:"Find game", create:"Create lobby", refresh:"Refresh", leave:"Leave lobby",
    login:"Log in", range:"Search range", waiting:"Waiting", players:"Players", spectators:"Spectators",
    host:"Host", hostNeeded:"Host needed", ready:"Ready", searching:"Finding players", waitingLobby:"Lobby is waiting for players",
    friend:"When the match is found, add the host as a friend in Block Strike:", noHost:"No privileged host is in the lobby. Online hosts have been notified.",
    open:"Open lobbies", join:"Join", full:"Full", staff:"Staff", player:"Player",
    error:"Action failed. Please try again.", auth:"Log in to start matchmaking.",
    elo:"ELO", minute:"min", lobby:"Lobby", copied:"Host nickname",
  },
} as const;

function MatchmakingPage() {
  const { user, profile, roles, loading } = useAuth();
  const { language } = useLanguage();
  const t = text[language];
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [openLobbies, setOpenLobbies] = useState<Lobby[]>([]);
  const [notifications, setNotifications] = useState<{id:string; message:string}[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const [resultScreenshot, setResultScreenshot] = useState<File | null>(null);
  const [resultStats, setResultStats] = useState<Record<string, { kills: number; deaths: number; won: boolean }>>({});

  const staff = roles.some((r) => ["host","moderator","admin"].includes(r));

  async function loadLobby(id: string | null) {
    if (!id) { setLobby(null); setMembers([]); setPlayers([]); return; }
    const [l, m] = await Promise.all([
      supabase.from("match_lobbies").select("id,status,creator_id,search_started_at,host_user_id").eq("id",id).maybeSingle(),
      supabase.from("match_lobby_members").select("id,user_id,member_kind,joined_at").eq("lobby_id",id).order("joined_at"),
    ]);
    if (l.error || !l.data) { setLobby(null); return; }
    const rows = (m.data ?? []) as Member[];
    const ids = rows.map((x) => x.user_id);
    const p = ids.length ? await supabase.from("profiles").select("id,nickname,elo").in("id",ids) : { data: [] };
    const mapped = (p.data ?? []) as Player[];
    setMembers(rows);
    setPlayers(mapped);
    setLobby({
      ...(l.data as Omit<Lobby,"player_count"|"spectator_count">),
      player_count: rows.filter((x) => x.member_kind === "player").length,
      spectator_count: rows.filter((x) => x.member_kind === "spectator").length,
    });
  }

  async function loadOpen() {
    const { data } = await supabase.rpc("mm_open_lobbies");
    setOpenLobbies((data ?? []) as Lobby[]);
  }

  async function loadNotifications() {
    if (!user || !staff) return;
    const { data } = await supabase.from("host_notifications").select("id,message").eq("host_user_id",user.id).eq("status","unread").order("created_at",{ascending:false}).limit(5);
    setNotifications((data ?? []) as {id:string;message:string}[]);
  }

  useEffect(() => {
    if (!user) return;
    const tick = async () => {
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
      await loadOpen();
      await loadNotifications();
    };
    tick();
    const timer = window.setInterval(tick, 30000);
    return () => window.clearInterval(timer);
  }, [user?.id, staff]);

  useEffect(() => {
    if (!user) return;
    const saved = window.sessionStorage.getItem("recorn-lobby");
    if (saved) loadLobby(saved);
  }, [user?.id]);

  useEffect(() => {
    if (!lobby) return;
    const timer = window.setInterval(() => loadLobby(lobby.id), 2000);
    return () => window.clearInterval(timer);
  }, [lobby?.id]);

  const waitMinutes = lobby ? Math.max(0, Math.floor((Date.now() - new Date(lobby.search_started_at).getTime()) / 60000)) : 0;
  const elo = profile?.elo ?? 1000;
  const eloRange = { low: Math.max(0, elo - 100 - 300 * waitMinutes), high: elo + 500 + 500 * waitMinutes };

  async function searchGame() {
    if (!user) return;
    setBusy(true); setError("");
    const { data, error: e } = await supabase.rpc("mm_search_lobby");
    if (e || !data) setError(e?.message ?? t.error);
    else {
      const id = String(data);
      window.sessionStorage.setItem("recorn-lobby", id);
      await loadLobby(id);
    }
    setBusy(false);
  }

  async function createLobby() {
    if (!user) return;
    setBusy(true); setError("");
    const { data, error: e } = await supabase.rpc("mm_create_lobby");
    if (e || !data) setError(e?.message ?? t.error);
    else {
      const id = String(data);
      window.sessionStorage.setItem("recorn-lobby", id);
      await loadLobby(id);
    }
    setBusy(false);
  }

  async function joinLobby(id: string) {
    setBusy(true); setError("");
    const { error: e } = await supabase.rpc("mm_join_lobby", { p_lobby_id:id, p_spectator:false });
    if (e) setError(e.message.includes("PLAYER_SLOTS_FULL") ? t.full : t.error);
    else {
      window.sessionStorage.setItem("recorn-lobby", id);
      await loadLobby(id);
    }
    setBusy(false);
  }

  async function joinAsSpectator(id: string) {
    if (!staff) return;
    setBusy(true); setError("");
    const { error: e } = await supabase.rpc("mm_join_lobby", { p_lobby_id:id, p_spectator:true });
    if (e) setError(e.message.includes("LOBBY_FULL") ? t.full : t.error);
    else {
      window.sessionStorage.setItem("recorn-lobby", id);
      await loadLobby(id);
    }
    setBusy(false);
  }

  async function leaveLobby() {
    if (!lobby) return;
    setBusy(true);
    await supabase.rpc("mm_leave_lobby", { p_lobby_id:lobby.id });
    window.sessionStorage.removeItem("recorn-lobby");
    setLobby(null); setMembers([]); setPlayers([]);
    setBusy(false);
    loadOpen();
  }

  async function submitResult() {
    if (!lobby || lobby.host_user_id !== user.id || resultBusy) return;
    const playerRows = members.filter((m) => m.member_kind === "player");
    if (playerRows.length < 2) { setError("В матче недостаточно игроков."); return; }
    setResultBusy(true); setError("");
    try {
      let screenshotPath = "";
      if (resultScreenshot) {
        if (!["image/png","image/jpeg","image/webp"].includes(resultScreenshot.type)) throw new Error("Можно загрузить только PNG, JPG или WEBP.");
        if (resultScreenshot.size > 5 * 1024 * 1024) throw new Error("Скриншот должен быть не больше 5 МБ.");
        const ext = resultScreenshot.name.split(".").pop()?.toLowerCase() || "png";
        screenshotPath = user.id + "/" + lobby.id + "." + ext;
        const up = await supabase.storage.from("match-screenshots").upload(screenshotPath, resultScreenshot, { upsert: true, contentType: resultScreenshot.type });
        if (up.error) throw up.error;
      }
      const payload = playerRows.map((m) => ({
        user_id: m.user_id,
        kills: Math.max(0, Math.floor(resultStats[m.user_id]?.kills ?? 0)),
        deaths: Math.max(0, Math.floor(resultStats[m.user_id]?.deaths ?? 0)),
        won: Boolean(resultStats[m.user_id]?.won),
      }));
      const { error: e } = await supabase.rpc("submit_match_result", {
        p_lobby_id: lobby.id, p_screenshot_path: screenshotPath || null, p_players: payload,
      });
      if (e) throw e;
      window.sessionStorage.removeItem("recorn-lobby");
      setLobby(null); setMembers([]); setPlayers([]); setResultOpen(false); setResultScreenshot(null); setResultStats({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить результат матча.");
    } finally {
      setResultBusy(false);
    }
  }

  async function markNotification(id: string) {
    await supabase.from("host_notifications").update({status:"read"}).eq("id",id);
    loadNotifications();
  }

  const hostPlayer = lobby?.host_user_id ? players.find((p) => p.id === lobby.host_user_id) : null;

  if (loading) return <div className="mx-auto max-w-6xl animate-pulse rounded-3xl border border-border bg-card p-8">Loading…</div>;
  if (!user || !profile) return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-10 text-center">
      <Search className="mx-auto size-12 text-primary" />
      <h1 className="mt-5 font-display text-2xl font-bold">{t.title}</h1>
      <p className="mt-3 text-muted-foreground">{t.auth}</p>
      <Link to="/auth" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground"><LogIn className="size-4"/>{t.login}</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="banner-gradient overflow-hidden rounded-3xl border border-border p-6 sm:p-8">
        <div className="grid-bg -mx-6 -mt-6 mb-6 h-24 sm:-mx-8 sm:-mt-8" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-primary"><Bot className="size-4"/>{t.lobby}</div>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{t.title}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t.subtitle}</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-6 py-4 text-center">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t.elo}</div>
            <div className="font-display text-4xl font-bold text-primary">{profile.elo}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button disabled={busy} onClick={searchGame} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"><Search className="size-4"/>{busy ? "…" : t.search}</button>
          <button disabled={busy} onClick={createLobby} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-5 py-3 font-bold hover:bg-secondary disabled:opacity-50"><Plus className="size-4"/>{t.create}</button>
          <button onClick={() => { loadOpen(); if (lobby) loadLobby(lobby.id); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 font-semibold hover:bg-secondary"><RefreshCw className="size-4"/>{t.refresh}</button>
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 font-bold"><Crown className="size-4 text-primary"/> {t.host}</div>
          <div className="mt-3 space-y-2">{notifications.map((n) => <button key={n.id} onClick={() => markNotification(n.id)} className="flex w-full items-start justify-between gap-4 rounded-xl border border-border bg-card p-3 text-left text-sm hover:bg-secondary"><span>{n.message}</span><X className="size-4 shrink-0 text-muted-foreground"/></button>)}</div>
        </section>
      )}

      {lobby && (
        <section className="grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t.lobby}</div>
                <h2 className="mt-1 font-display text-xl font-bold">{lobby.player_count}/5 {t.players}</h2>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase text-primary">
                {lobby.status === "host_needed" ? t.hostNeeded : lobby.status === "ready" ? t.ready : lobby.status === "waiting" ? t.waitingLobby : t.searching}
              </span>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {members.map((m) => {
                const p = players.find((x) => x.id === m.user_id);
                return <div key={m.id} className="flex items-center justify-between rounded-2xl border border-border bg-background/50 p-4">
                  <div className="min-w-0"><div className="truncate font-bold">{p?.nickname ?? "Player"}</div><div className="text-xs text-muted-foreground">{p?.elo ?? "—"} ELO • {m.member_kind === "spectator" ? t.spectators : t.player}</div></div>
                  {lobby.host_user_id === m.user_id && <Crown className="size-5 text-primary"/>}
                </div>;
              })}
              {Array.from({length: Math.max(0,5-lobby.player_count)}).map((_,i)=><div key={i} className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground"><Users className="size-4"/> Slot {lobby.player_count+i+1}</div>)}
            </div>

            {lobby.player_count < 5 && lobby.status === "searching" && (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{t.range}</span><span className="font-display font-bold text-primary">{eloRange.low} — {eloRange.high}</span></div>
                <div className="mt-2 text-xs text-muted-foreground">{waitMinutes} {t.minute}</div>
              </div>
            )}

            {lobby.player_count >= 5 && lobby.host_user_id && hostPlayer && (
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="text-sm font-bold">{t.friend}</div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="font-display text-lg font-bold">{hostPlayer.nickname}</span><Crown className="size-5 text-primary"/></div>
              </div>
            )}
            {lobby.player_count >= 5 && !lobby.host_user_id && (
              <div className="mt-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm">{t.noHost}</div>
            )}

            {lobby.host_user_id === user.id && lobby.player_count >= 2 && (
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><div className="font-bold">Результат матча</div><div className="mt-1 text-xs text-muted-foreground">Загрузите скрин хоста и перенесите K/D. ELO посчитает сервер.</div></div>
                  <button onClick={() => setResultOpen(true)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Внести результат</button>
                </div>
              </div>
            )}
            <button disabled={busy} onClick={leaveLobby} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"><X className="size-4"/>{t.leave}</button>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2 font-display font-bold"><Users className="size-4 text-primary"/>{t.open}</div>
            <div className="mt-4 space-y-2">
              {openLobbies.filter((x) => x.id !== lobby.id).map((x) => <div key={x.id} className="rounded-2xl border border-border p-3"><div className="flex items-center justify-between gap-2"><span className="font-bold">{x.player_count}/5</span><span className="text-xs text-muted-foreground">{x.status}</span></div><div className="mt-2 flex gap-2"><button disabled={busy || x.player_count>=5} onClick={() => joinLobby(x.id)} className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">{t.join}</button>{staff && <button disabled={busy} onClick={() => joinAsSpectator(x.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold"><Shield className="inline size-3"/> {t.spectators}</button>}</div></div>)}
              {openLobbies.filter((x) => x.id !== lobby.id).length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
        </section>
      )}

      {!lobby && (
        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-3"><Users className="size-5 text-primary"/><h2 className="font-display text-xl font-bold">{t.open}</h2></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {openLobbies.map((x) => <div key={x.id} className="rounded-2xl border border-border bg-background/40 p-4"><div className="flex items-center justify-between"><span className="font-bold">{x.player_count}/5</span><span className="text-xs text-muted-foreground">{x.status}</span></div><div className="mt-3 flex gap-2"><button disabled={busy || x.player_count>=5} onClick={() => joinLobby(x.id)} className="flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">{t.join}</button>{staff && <button disabled={busy} onClick={() => joinAsSpectator(x.id)} className="rounded-lg border border-border px-3 py-2 text-xs font-bold"><Shield className="inline size-3"/> {t.spectators}</button>}</div></div>)}
            {openLobbies.length === 0 && <p className="text-sm text-muted-foreground">{t.waitingLobby}</p>}
          </div>
        </section>
      )}
    {resultOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
          <h2 className="font-display text-xl font-bold">Результат матча</h2>
          <p className="mt-1 text-sm text-muted-foreground">K/D берётся со скрина хоста. Изменение ELO рассчитывается сервером.</p>
          <label className="mt-4 block text-sm font-semibold">Скриншот (PNG/JPG/WEBP, до 5 МБ)
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setResultScreenshot(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </label>
          <div className="mt-5 space-y-2">
            {members.filter((m) => m.member_kind === "player").map((m) => {
              const p = players.find((x) => x.id === m.user_id);
              const s = resultStats[m.user_id] ?? { kills: 0, deaths: 0, won: false };
              const kd = (s.kills / Math.max(s.deaths, 1)).toFixed(2);
              return <div key={m.user_id} className="grid grid-cols-[1fr_64px_64px_auto] items-center gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0"><div className="truncate text-sm font-bold">{p?.nickname ?? "Player"}</div><div className="text-xs text-muted-foreground">K/D: {kd}</div></div>
                <input type="number" min="0" max="999" value={s.kills} onChange={(e) => setResultStats(v => ({...v,[m.user_id]:{...s,kills:Number(e.target.value)}}))} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm" />
                <input type="number" min="0" max="999" value={s.deaths} onChange={(e) => setResultStats(v => ({...v,[m.user_id]:{...s,deaths:Number(e.target.value)}}))} className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm" />
                <label className="flex items-center gap-1 text-xs font-bold"><input type="checkbox" checked={s.won} onChange={(e) => setResultStats(v => ({...v,[m.user_id]:{...s,won:e.target.checked}}))} /> WIN</label>
              </div>;
            })}
          </div>
          <div className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">ELO: ±20 за WIN/LOSS + бонус K/D, итог от −50 до +50 ELO.</div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button disabled={resultBusy} onClick={() => setResultOpen(false)} className="rounded-xl bg-secondary px-4 py-2 text-sm font-bold">Отмена</button>
            <button disabled={resultBusy} onClick={submitResult} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{resultBusy ? "Сохраняем…" : "Сохранить результат"}</button>
          </div>
        </div>
      </div>
    )}
  </div>
  );
}
