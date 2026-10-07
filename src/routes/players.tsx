import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, UserSearch } from "lucide-react";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "Найти игрока — ReCorN" },
      { name: "description", content: "Поиск игроков Block Strike по нику на ReCorN." },
      { property: "og:title", content: "Найти игрока — ReCorN" },
      { property: "og:description", content: "Поиск игроков Block Strike по нику на ReCorN." },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Найти игрока</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Введите ник игрока Block Strike, чтобы посмотреть его профиль и статистику.
      </p>

      <div className="relative mt-6">
        <Search className="absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ник игрока..."
          className="w-full rounded-xl border border-input bg-card py-3.5 pl-11 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      <div className="grid-bg mt-6 flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card">
        <UserSearch className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {query ? `Игрок «${query}» не найден.` : "Начните вводить ник игрока."}
        </p>
      </div>
    </div>
  );
}
