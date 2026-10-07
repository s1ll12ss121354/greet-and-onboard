import { createFileRoute } from "@tanstack/react-router";
import { Shield, Users, Flag, Swords } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Админ-панель — ReCorN" },
      { name: "description", content: "Панель администратора ReCorN." },
      { property: "og:title", content: "Админ-панель — ReCorN" },
      { property: "og:description", content: "Панель администратора ReCorN." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const CARDS = [
  { icon: Users, label: "Игроки", value: 0 },
  { icon: Swords, label: "Заявки", value: 0 },
  { icon: Flag, label: "Жалобы", value: 0 },
];

function AdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15">
          <Shield className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">Админ-панель</h1>
          <p className="text-sm text-muted-foreground">Управление платформой ReCorN.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CARDS.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="font-display mt-3 text-3xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-bg mt-6 flex h-48 items-center justify-center rounded-2xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">
          Разделы управления появятся после подключения базы данных.
        </p>
      </div>
    </div>
  );
}
