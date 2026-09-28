"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { Organization, OrganizationSettings, Profile, SessionUser, UserRole } from "@/types";
import { ROLE_HOME } from "@/lib/constants";

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refresh: () => Promise<void>;
  homePath: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadSessionUser(userId: string): Promise<SessionUser> {
  const supabase = getSupabase();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error("Perfil não encontrado para este usuário.");
  }

  const typedProfile = profile as Profile;

  const [{ data: organization }, { data: settings }, { data: roleRows }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", typedProfile.organization_id).single(),
    supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", typedProfile.organization_id)
      .single(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (!organization) {
    throw new Error("Organização não encontrada.");
  }

  const roles = Array.from(
    new Set([
      typedProfile.primary_role,
      ...((roleRows ?? []) as Array<{ role: UserRole }>).map((row) => row.role),
    ]),
  );

  return {
    profile: typedProfile,
    organization: organization as Organization,
    settings: (settings ?? {
      organization_id: typedProfile.organization_id,
      currency: "BRL",
      service_fee_percent: 10,
      allow_discount: true,
      allow_negative_stock: false,
      print_enabled: true,
      timezone: "America/Sao_Paulo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }) as OrganizationSettings,
    roles,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    setSession(current);
    if (!current?.user) {
      setUser(null);
      return;
    }
    const sessionUser = await loadSessionUser(current.user.id);
    setUser(sessionUser);
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          try {
            const sessionUser = await loadSessionUser(data.session.user.id);
            if (mounted) setUser(sessionUser);
          } catch {
            if (mounted) setUser(null);
          }
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const sessionUser = await loadSessionUser(nextSession.user.id);
        setUser(sessionUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    const redirectTo = `${window.location.origin}/login/`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  const homePath = user ? ROLE_HOME[user.profile.primary_role] : "/login";

  const value = useMemo(
    () => ({ loading, session, user, signIn, signOut, resetPassword, refresh, homePath }),
    [loading, session, user, signIn, signOut, resetPassword, refresh, homePath],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
