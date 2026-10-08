import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Trophy,
  Skull,
  Percent,
  Gamepad2,
  ImageIcon,
  RefreshCw,
  ExternalLink,
  Upload,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Профиль — RECORN" },
      { name: "description", content: "Профиль игрока RECORN: статистика, ELO и история матчей Block Strike." },
      { property: "og:title", content: "Профиль — RECORN" },
      { property: "og:description", content: "Статистика, ELO и история матчей игрока Block Strike." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, roles, loading, user } = useAuth();
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [securityEmail, setSecurityEmail] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [securityStep, setSecurityStep] = useState<"email" | "code">("email");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!user || !profile) return <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center"><p>Войдите или зарегистрируйтесь по нику Roblox.</p><Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</Link></div>;
  const matches = profile.wins + profile.losses;
  const hasBoundEmail = !!user.email && !user.email.endsWith("@recorn.player");

  async function requestEmailBinding(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError("");
    setSecurityMessage("");
    const cleanEmail = securityEmail.trim().toLowerCase();
    if (!/^\\S+@\\S+\\.\\S+$/.test(cleanEmail)) {
      setSecurityError("Введи корректный адрес электронной почты.");
      return;
    }
    setSecurityBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: cleanEmail });
      if (error) throw error;
      setSecurityEmail(cleanEmail);
      setSecurityStep("code");
      setSecurityMessage("Код отправлен на почту. Введи его ниже, чтобы завершить привязку.");
    } catch (e) {
      setSecurityError(e instanceof Error ? e.message : "Не удалось отправить код.");
    } finally {
      setSecurityBusy(false);
    }
  }

  async function verifyEmailBinding(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError("");
    setSecurityMessage("");
    const token = securityCode.trim();
    if (!/^\\d{6}$/.test(token)) {
      setSecurityError("Введи шестизначный код из письма.");
      return;
    }
    setSecurityBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: securityEmail.trim().toLowerCase(),
        token,
        type: "email_change",
      });
      if (error) throw error;
      setSecurityMessage("Почта успешно привязана. Теперь можно восстановить пароль через неё.");
      setSecurityStep("email");
      setSecurityCode("");
      window.location.reload();
    } catch (e) {
      setSecurityError(e instanceof Error ? e.message : "Код неверный или устарел.");
    } finally {
      setSecurityBusy(false);
    }
  }
  const level = faceitLevel(profile.elo);
  async function uploadMedia(kind: "avatar" | "banner", file: File) {
    if (!user) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) return alert("Разрешены PNG, JPG и WEBP.");
    const max = kind === "avatar" ? 3 : 8;
    if (file.size > max * 1024 * 1024) return alert(`Файл должен быть не больше ${max} МБ.`);
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("profile-media").upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from("profile-media").getPublicUrl(path);
      const { error } = await supabase.rpc("update_profile_media", {
        p_avatar_url: kind === "avatar" ? data.publicUrl : profile.avatar_url ?? null,
        p_banner_url: kind === "banner" ? data.publicUrl : profile.banner_url ?? null,
      });
      if (error) throw error;
      window.location.reload();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message?: unknown }).message ?? "Неизвестная ошибка Supabase.")
            : String(e ?? "Неизвестная ошибка Supabase.");
      alert(`Не удалось загрузить изображение: ${message}`);
    }
    finally { setUploading(null); }
  }
  const stats = [
    { label: "Победы", value: profile.wins, icon: Trophy, valueClass: "text-success" },
    { label: "Поражения", value: profile.losses, icon: Skull, valueClass: "text-destructive" },
    { label: "Win Rate", value: `${matches ? Math.round((profile.wins / matches) * 100) : 0}%`, icon: Percent, valueClass: "text-foreground" },
    { label: "Матчи", value: matches, icon: Gamepad2, valueClass: "text-foreground" },
  ];
  return <div className="mx-auto max-w-5xl">
    <section className="overflow-hidden border border-border bg-card">
      <div className="relative min-h-[520px] overflow-hidden sm:min-h-[420px] lg:min-h-64">
        {profile.banner_url ? (
          <>
            <img
              src={profile.banner_url}
              alt=""
              aria-hidden="true"
              loading="eager"
              className="absolute inset-0 size-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(180,255,80,.14),transparent_38%)] bg-secondary" />
        )}

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
          <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-end gap-3 sm:gap-5">
              <div className="size-20 shrink-0 overflow-hidden rounded-md sm:size-24 border-2 border-background/80 bg-primary/10 shadow-2xl">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.nickname} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/10 font-display text-2xl font-extrabold text-primary">
                    {profile.nickname.slice(0,2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="pb-1 text-white">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="max-w-full break-words font-display text-2xl font-bold lg:text-3xl">{profile.nickname}</h1>
                  <span className="border border-white/30 bg-black/30 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    LVL {level}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {roles.map(r => (
                    <span key={r} className="rounded-sm bg-white/15 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white">{r}</span>
                  ))}
                  <button onClick={()=>supabase.auth.signOut()} className="text-white/75 hover:text-white">Выйти</button>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:justify-end">
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&uploadMedia("banner",e.target.files[0])}/>
                <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&uploadMedia("avatar",e.target.files[0])}/>
                <button disabled={!!uploading} onClick={()=>bannerRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-white/20 disabled:opacity-50 sm:w-auto sm:text-sm">
                  {uploading==="banner"?<Loader2 className="size-4 animate-spin"/>:<ImageIcon className="size-4"/>} Изменить баннер
                </button>
                <button disabled={!!uploading} onClick={()=>avatarRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 disabled:opacity-50">
                  {uploading==="avatar"?<Loader2 className="size-4 animate-spin"/>:<Upload className="size-4"/>} Загрузить аватар
                </button>
              </div>
              <div className="text-left text-white sm:text-right">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/70">ELO</div>
                <div className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{profile.elo}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Безопасность аккаунта</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasBoundEmail ? `Привязанная почта: ${user.email}` : "Привяжи настоящую почту, чтобы восстановить доступ, если забудешь пароль."}
      </p>
      {securityStep === "email" ? (
        <form onSubmit={requestEmailBinding} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            required
            type="email"
            autoComplete="email"
            value={securityEmail}
            onChange={(e) => setSecurityEmail(e.target.value)}
            placeholder={hasBoundEmail ? "Новая почта для привязки" : "Твоя электронная почта"}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm"
          />
          <button disabled={securityBusy} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {securityBusy ? "Отправка..." : hasBoundEmail ? "Изменить почту" : "Привязать почту"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyEmailBinding} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={securityCode}
            onChange={(e) => setSecurityCode(e.target.value.replace(/\\D/g, "").slice(0, 6))}
            placeholder="6-значный код из письма"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm"
          />
          <button disabled={securityBusy} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {securityBusy ? "Проверка..." : "Подтвердить код"}
          </button>
          <button type="button" disabled={securityBusy} onClick={() => { setSecurityStep("email"); setSecurityCode(""); setSecurityMessage(""); }} className="rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold">
            Назад
          </button>
        </form>
      )}
      {securityMessage && <p role="status" className="mt-3 text-sm text-primary">{securityMessage}</p>}
      {securityError && <p role="alert" className="mt-3 text-sm text-destructive">{securityError}</p>}
      <p className="mt-3 text-xs text-muted-foreground">После привязки вход можно выполнять по нику или по почте. Восстановление пароля доступно на странице входа.</p>
    </section>
    <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map(({label,value,icon:Icon,valueClass})=><div key={label} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span><Icon className="size-4 text-muted-foreground"/></div><div className={`font-display mt-3 text-3xl font-bold ${valueClass}`}>{value}</div></div>)}</section>
    <section className="mt-8"><h2 className="font-display text-lg font-bold uppercase tracking-wide">История матчей</h2><div className="grid-bg mt-4 flex h-40 items-center justify-center rounded-2xl border border-border bg-card"><p className="text-sm text-muted-foreground">У игрока пока нет матчей.</p></div></section>
  </div>;
}
function faceitLevel(elo: number) {
  const caps = [500, 750, 900, 1050, 1200, 1350, 1530, 1750, 2000];
  const i = caps.findIndex((c) => elo <= c);
  return i === -1 ? 10 : i + 1;
}
