import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Trophy, Medal, Crown, UserSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Лидерборд ELO — RECORN" },
      { name: "description", content: "Глобальный лидерборд игроков Block Strike по ELO на RECORN." },
      { property: "og:title", content: "Лидерборд ELO — RECORN" },
      { property: "og:description", content: "Сравнивай игроков Block Strike по ELO." },
    ],
  }),
  component: PlayersPage,
});

type Player = {
  id: string;
  nickname: string;
  elo: number;
  wins: number;
  losses: number;
};

function levelForElo(elo: number) {
  const caps = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = caps.findIndex((c) => elo <= c);
  return i === -1 ? 10 : i + 1;
}

function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.rpc("public_leaderboard", { p_limit: 100 })
      .then(({ data }) => {
        if (active) {
          setPlayers((data as Player[]) ?? []);
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(
    () => players.filter((p) => p.nickname.toLowerCase().includes(query.trim().toLowerCase())),
    [players, query],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <Trophy className="size-4" /> Competitive ranking
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Лидерборд ELO</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Игроки отсортированы по ELO. Новый игрок начинает с <b className="text-foreground">1000 ELO</b> — это <b className="text-foreground">4 уровень</b>.
        </p>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по нику..."
          className="w-full rounded-xl border border-input bg-card py-3.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[48px_1fr_90px_90px_80px] gap-3 border-b border-border px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid-cols-[64px_1fr_110px_100px_90px] sm:px-6">
          <span>#</span><span>Игрок</span><span>ELO</span><span>Уровень</span><span>W / L</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Загрузка рейтинга…</div>
        ) : filtered.length === 0 ? (
          <div className="grid-bg flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
            <UserSearch className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Игроки не найдены.</p>
          </div>
        ) : (
          filtered.map((player, index) => {
            const rank = players.findIndex((p) => p.id === player.id) + 1;
            const level = levelForElo(player.elo);
            return (
              <div key={player.id} className="grid grid-cols-[48px_1fr_90px_90px_80px] items-center gap-3 border-b border-border px-4 py-4 last:border-0 hover:bg-secondary/40 sm:grid-cols-[64px_1fr_110px_100px_90px] sm:px-6">
                <div className="font-display text-sm font-bold text-muted-foreground">
                  {rank <= 3 ? <span className="inline-flex items-center gap-1 text-primary"><Medal className="size-4" />{rank}</span> : rank}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate font-bold">
                    {rank === 1 && <Crown className="size-4 shrink-0 text-primary" />}
                    <span className="truncate">{player.nickname}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{player.wins + player.losses} матчей</div>
                </div>
                <div className="font-display font-bold text-primary">{player.elo}</div>
                <div><span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">LVL {level}</span></div>
                <div className="text-xs font-semibold"><span className="text-success">{player.wins}</span> / <span className="text-destructive">{player.losses}</span></div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
