import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nickToEmail } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — GreetAndWin" },
      { name: "description", content: "Регистрация на GreetAndWin по нику Roblox: один ник — один аккаунт." },
      { property: "og:title", content: "Вход и регистрация — GreetAndWin" },
      { property: "og:description", content: "Создайте аккаунт GreetAndWin по нику Roblox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input =
  "rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nick, setNick] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const clean = nick.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(clean)) {
      setErr("Ник Roblox: 3–20 символов, латиница, цифры и _");
      return;
    }
    setBusy(true);
    const email = nickToEmail(clean);
    if (mode === "signup") {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .ilike("nickname", clean)
        .maybeSingle();
      if (taken) {
        setErr("Этот ник Roblox уже зарегистрирован");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { nickname: clean } },
      });
      if (error) setErr(error.message.includes("registered") ? "Этот ник уже зарегистрирован" : error.message);
      else nav({ to: "/profile" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr("Неверный ник или пароль");
      else nav({ to: "/profile" });
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-bold">{mode === "login" ? "Вход" : "Регистрация"}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Ник в Roblox</span>
          <input required value={nick} onChange={(e) => setNick(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Пароль</span>
          <input required type="password" minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} className={input} />
        </label>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "..." : mode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm text-muted-foreground hover:text-primary">
          {mode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}
        </button>
      </form>
    </div>
  );
}
