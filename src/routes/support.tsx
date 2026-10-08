import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Heart, ShieldCheck, Star, Zap } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Поддержать проект — GreetAndWin" },
      { name: "description", content: "Поддержите GreetAndWin и получите кастомную роль и приоритет в репортах и заявках." },
      { property: "og:title", content: "Поддержать проект — GreetAndWin" },
      { property: "og:description", content: "Поддержите GreetAndWin от 50 ₽ и получите кастомную роль." },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-card p-7 shadow-2xl sm:p-10">
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
            <Heart className="size-3.5" /> GreetAndWin
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold sm:text-5xl">Поддержать проект</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Если GreetAndWin тебе нравится и ты хочешь помочь проекту развиваться, можешь поддержать нас от <b className="text-foreground">50 ₽</b>.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <Benefit icon={Star} title="Кастомная роль" text="Выбери название роли и напиши его в комментарии к донату." />
            <Benefit icon={Zap} title="Приоритет" text="Приоритет при рассмотрении репортов и заявок на хоста." />
            <Benefit icon={ShieldCheck} title="Поддержка" text="Помогаешь оплачивать и развивать инфраструктуру GreetAndWin." />
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-background/60 p-5">
            <h2 className="font-display text-base font-bold">Что написать при донате</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Сумма поддержки — <b className="text-foreground">от 50 ₽</b>.</li>
              <li>В комментарии напиши, <b className="text-foreground">какую кастомную роль хочешь получить</b>.</li>
              <li>Там же укажи свой <b className="text-foreground">ник GreetAndWin</b>.</li>
            </ol>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              После проверки поддержки администрация выдаст указанную роль и включит приоритет. Не указывай пароли или другие секретные данные.
            </p>
          </div>

          <a
            href="https://dalink.to/t1she123"
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label="Открыть страницу поддержки GreetAndWin"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20"
          >
            Поддержать GreetAndWin <ArrowRight className="size-4" />
          </a>
        </div>
      </section>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-bold transition hover:bg-secondary"
      >
        На главную
      </Link>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: typeof Star; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <Icon className="size-5 text-primary" />
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
