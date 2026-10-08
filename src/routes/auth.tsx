import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nickToEmail } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход и регистрация — RECORN" },
      { name: "description", content: "Вход и регистрация на RECORN." },
      { property: "og:title", content: "Вход и регистрация — RECORN" },
      { property: "og:description", content: "Создайте аккаунт RECORN и играйте в Block Strike." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const input =
  "rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary";

type Mode = "login" | "signup" | "forgot" | "reset";

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1" || window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const cleanEmail = email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
          setErr("Введи корректный адрес почты.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth?reset=1`,
        });
        if (error) throw error;
        setNotice("Если аккаунт с этой почтой существует, письмо для восстановления уже отправлено.");
        return;
      }

      if (mode === "reset") {
        if (pass.length < 10) {
          setErr("Пароль должен содержать минимум 10 символов.");
          return;
        }
        if (pass !== confirmPass) {
          setErr("Пароли не совпадают.");
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: pass });
        if (error) throw error;
        setNotice("Пароль изменён. Теперь можешь войти.");
        setPass("");
        setConfirmPass("");
        setMode("login");
        return;
      }

      const clean = nick.trim();
      let authEmail: string;
      if (mode === "signup") {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(clean)) {
          setErr("Ник Roblox: 3–20 символов, латиница, цифры и _");
          return;
        }
        if (pass.length < 10) {
          setErr("Пароль должен содержать минимум 10 символов.");
          return;
        }
        authEmail = nickToEmail(clean);
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: pass,
          options: { data: { nickname: clean } },
        });
        if (error) throw new Error(error.message.includes("registered") ? "Этот ник уже зарегистрирован" : error.message);
        nav({ to: "/profile" });
        return;
      }

      const loginInput = clean.trim();
      if (loginInput.includes("@")) {
        authEmail = loginInput.toLowerCase();
      } else {
        if (!/^[A-Za-z0-9_]{3,20}$/.test(loginInput)) {
          setErr("Введи ник (3–20 символов) или привязанную почту.");
          return;
        }
        authEmail = nickToEmail(loginInput);
      }
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: pass });
      if (error) throw new Error("Неверный ник/почта или пароль. Если почта уже привязана, войди по ней.");
      nav({ to: "/profile" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось выполнить запрос. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Вход" : mode === "signup" ? "Регистрация" : mode === "forgot" ? "Восстановление пароля" : "Новый пароль";

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        {(mode === "login" || mode === "signup") && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{mode === "login" ? "Ник или привязанная почта" : "Ник в Roblox"}</span>
            <input required value={nick} onChange={(e) => setNick(e.target.value)} autoComplete="username" className={input} />
          </label>
        )}
        {mode === "forgot" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Привязанная почта</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
          </label>
        )}
        {(mode === "login" || mode === "signup" || mode === "reset") && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{mode === "reset" ? "Новый пароль" : "Пароль"}</span>
            <input required type="password" minLength={10} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />
            {mode === "signup" && <span className="text-xs font-extrabold uppercase text-destructive">НЕ ВВОДИТЕ ПАРОЛЬ ОТ АККАУНТА ROBLOX</span>}
          </label>
        )}
        {mode === "reset" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Повтори новый пароль</span>
            <input required type="password" minLength={10} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" className={input} />
          </label>
        )}
        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "..." : mode === "login" ? "Войти" : mode === "signup" ? "Зарегистрироваться" : mode === "forgot" ? "Отправить письмо" : "Сохранить пароль"}
        </button>
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          {mode === "login" && <>
            <button type="button" onClick={() => { setMode("signup"); setErr(""); setNotice(""); }} className="text-muted-foreground hover:text-primary">Нет аккаунта? Регистрация</button>
            <button type="button" onClick={() => { setMode("forgot"); setErr(""); setNotice(""); }} className="text-primary hover:underline">Забыл пароль?</button>
          </>}
          {mode === "signup" && <button type="button" onClick={() => { setMode("login"); setErr(""); setNotice(""); }} className="text-muted-foreground hover:text-primary">Уже есть аккаунт? Войти</button>}
          {mode === "forgot" && <button type="button" onClick={() => { setMode("login"); setErr(""); setNotice(""); }} className="text-muted-foreground hover:text-primary">Назад ко входу</button>}
          {mode === "reset" && <button type="button" onClick={() => { setMode("login"); setErr(""); setNotice(""); }} className="text-muted-foreground hover:text-primary">Назад ко входу</button>}
        </div>
      </form>
    </div>
  );
}
