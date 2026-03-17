"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
// Allowed domains for company SSO, comma-separated (optional). If empty, no restriction.
const allowedDomainsEnv = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS || "";
const allowedDomains = allowedDomainsEnv.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

interface User {
  name: string;
  role: string;
}

const UserContext = createContext<User>({ name: "Usuario", role: "Admin" });

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>({ name: "Usuario", role: "Admin" });
  const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';

  useEffect(() => {
    const loadUser = async () => {
      if (!supabase || disableDb) return;
      const { data, error } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        const name = (u.user_metadata as any)?.full_name || u.email || 'Usuario';
        // If allowed domains configured, enforce them immediately after SSO login.
        if (allowedDomains.length > 0 && u.email) {
          const domain = (u.email.split("@")[1] || "").toLowerCase();
          if (!allowedDomains.includes(domain)) {
            // Not allowed: sign out and redirect to login with message.
            try {
              await supabase.auth.signOut();
            } catch (e) {
              // ignore
            }
            localStorage.removeItem('adminAuth');
            // Append query param so login page can display a message if desired.
            if (typeof window !== 'undefined') {
              window.location.href = '/admin/login?error=sso_denied';
            }
            return;
          }
        }
        const isAdminLocal = localStorage.getItem('adminAuth') === 'true';
        const metaRole = ((u.app_metadata as any)?.role || (u.user_metadata as any)?.role || '') as string;
        let role = 'Admin';
        if (isAdminLocal) role = 'Admin';
        else if (metaRole) role = metaRole.toLowerCase() === 'admin' ? 'Admin' : 'Usuario';
        // If user passed allowlist, mark local admin flag for compatibility with existing UI checks.
        if (allowedDomains.length === 0 && !isAdminLocal) {
          // no-op: keep previous behavior
        } else if (allowedDomains.length > 0) {
          localStorage.setItem('adminAuth', 'true');
        }
        setUser({ name, role });
      }
    };
    loadUser();

    // Subscribe to auth state changes to react to SSO redirects.
    // Supabase v2: auth.onAuthStateChange
    // @ts-ignore
    const { data: listener } = supabase?.auth?.onAuthStateChange?.((event: string, session: any) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED') {
        loadUser();
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('adminAuth');
        setUser({ name: 'Usuario', role: 'Admin' });
      }
    }) || { data: null };

    return () => {
      try {
        if (listener?.subscription) listener.subscription.unsubscribe();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
