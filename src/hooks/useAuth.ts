import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const nickToEmail = (nick: string) =>
  `${nick.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@recorn.player`;

export type Profile = {
  id: string;
  nickname: string;
  elo: number;
  wins: number;
  losses: number;
  banned: boolean;
  support_priority: boolean;
  avatar_url: string | null;
  banner_url: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Keep the auth callback synchronous. Awaiting network work inside
    // onAuthStateChange can hold Supabase's internal auth lock and cause
    // session-dependent calls (like email binding) to fail with missing session.
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" && s?.user) {
        window.setTimeout(() => {
          void supabase.functions.invoke("login-audit");
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      setRoles([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]).then(([p, r]) => {
      setProfile((p.data as Profile) ?? null);
      setRoles((r.data ?? []).map((x) => x.role));
      setLoading(false);
    });
  }, [session?.user.id]);

  return { session, user: session?.user ?? null, profile, roles, loading };
}
