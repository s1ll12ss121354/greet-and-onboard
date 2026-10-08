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
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  if (loading) return <div className="text-muted-foreground">Загрузка...</div>;
  if (!user || !profile) return <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center"><p>Войдите или зарегистрируйтесь по нику Roblox.</p><Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Войти</Link></div>;
  const matches = profile.wins + profile.losses;
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
      <div className="relative h-40 border-b border-border bg-cover bg-center" style={profile.banner_url ? {backgroundImage:`linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.55)),url("${profile.banner_url}")`} : undefined}>{!profile.banner_url && <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(180,255,80,.14),transparent_38%)]" />}</div>
      <div className="flex flex-col gap-6 px-6 pb-6 lg:flex-row lg:items-end lg:px-8">
        <div className="-mt-12 flex items-end gap-5"><div className="size-24 shrink-0 overflow-hidden rounded-md border border-primary/50 bg-primary/10">{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.nickname} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center font-display text-2xl font-extrabold text-primary">{profile.nickname.slice(0,2).toUpperCase()}</div>}</div>
          <div className="pb-1"><div className="flex items-center gap-3"><h1 className="font-display text-2xl font-bold lg:text-3xl">{profile.nickname}</h1><span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">LVL {level}</span></div><div className="mt-2 flex flex-wrap gap-2 text-xs">{roles.map(r=><span key={r} className="rounded-sm bg-primary/10 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-primary">{r}</span>)}<button onClick={()=>supabase.auth.signOut()} className="text-muted-foreground hover:text-destructive">Выйти</button></div></div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4"><div className="flex gap-2">
          <input ref={bannerRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&uploadMedia("banner",e.target.files[0])}/>
          <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>e.target.files?.[0]&&uploadMedia("avatar",e.target.files[0])}/>
          <button disabled={!!uploading} onClick={()=>bannerRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50">{uploading==="banner"?<Loader2 className="size-4 animate-spin"/>:<ImageIcon className="size-4"/>} Изменить баннер</button>
          <button disabled={!!uploading} onClick={()=>avatarRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50">{uploading==="avatar"?<Loader2 className="size-4 animate-spin"/>:<Upload className="size-4"/>} Загрузить аватар</button>
        </div><div className="text-right"><div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ELO</div><div className="font-display text-5xl font-extrabold tracking-tight text-primary text-glow-primary">{profile.elo}</div></div></div>
      </div>
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
