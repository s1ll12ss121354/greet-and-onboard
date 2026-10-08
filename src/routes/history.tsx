import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "История — GreetAndWin" },
      { name: "description", content: "История ваших матчей и действий на GreetAndWin." },
      { property: "og:title", content: "История — GreetAndWin" },
      { property: "og:description", content: "История ваших матчей и действий на GreetAndWin." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold">История</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Все ваши матчи и действия на платформе.
      </p>
      <div className="grid-bg mt-6 flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card">
        <History className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">История пока пуста.</p>
      </div>
    </div>
  );
}
