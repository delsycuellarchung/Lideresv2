"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const ssoProvider = process.env.NEXT_PUBLIC_SSO_PROVIDER || "google";
  const enableDebugLogin = (process.env.NODE_ENV === 'development') || String(process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGIN || '').toLowerCase() === 'true';

  async function handleSSO() {
    setLoading(true);
    try {
      if (!supabase) {
        console.error("Supabase client not available");
        return;
      }
      // @ts-ignore
      await supabase.auth.signInWithOAuth({ provider: ssoProvider });
    } catch (err) {
      console.error("SSO error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleTogglePassword() {
    setShowPassword((s) => !s);
  }

  return (
    <div className="login-container">
      <main className="login-card card-enter">
        <h1 className="login-title">Login</h1>

        <form onSubmit={(e) => e.preventDefault()} className="login-form">
          <label className="login-field">
            <span className="mb-1 text-sm" style={{ display: "block", marginBottom: "6px" }}>
              Correo
            </span>
            <div className="password-wrapper">
              <input
                className="login-input input-anim"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                type="email"
                style={{ paddingLeft: 44 }}
              />
            </div>
          </label>

          <label className="login-field">
            <span className="mb-1 text-sm" style={{ display: "block", marginBottom: "6px" }}>
              Contraseña
            </span>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="login-input input-anim"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingLeft: 44 }}
              />
              <button
                type="button"
                className={"pw-toggle " + (showPassword ? "active" : "")}
                onClick={handleTogglePassword}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>

          <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Acceder</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="login-button sso-button"
                onClick={handleSSO}
                disabled={loading}
                style={{ minWidth: 220 }}
              >
                {loading ? "Procesando..." : "Ingresar"}
              </button>
              {enableDebugLogin ? (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      localStorage.setItem('adminAuth', 'true');
                      router.push('/admin/dashboard');
                    }}
                  >
                    Forzar login dev
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
