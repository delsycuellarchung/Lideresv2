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
  const disableLogin = String(process.env.NEXT_PUBLIC_DISABLE_LOGIN || '').toLowerCase() === 'true';
  const [isSignup, setIsSignup] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success' | null>(null);

  async function handleSSO() {
    if (disableLogin) {
      alert('El login está deshabilitado temporalmente');
      return;
    }
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

  async function handleSignin() {
    if (disableLogin) {
      alert('El login está deshabilitado temporalmente');
      return;
    }
    if (!supabase) {
      alert('Servicio de autenticación no disponible');
      return;
    }
    if (!email || !password) {
      alert('Ingrese email y contraseña');
      return;
    }
    setLoading(true);
    try {
      // @ts-ignore - supabase typings may differ
      const res = await supabase.auth.signInWithPassword({ email, password });
      const anyRes: any = res;
      const sessionToken = anyRes?.data?.session?.access_token || anyRes?.session?.access_token || null;
      const maybeError = (res as any)?.error || (anyRes && anyRes.error);
      if (maybeError) {
        const errMsg = maybeError.message || JSON.stringify(maybeError);
        setMessage(errMsg);
        setMessageType('error');
        return;
      }

      if (sessionToken) {
        try {
          await fetch('/api/provision', { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } });
        } catch (provErr) { /* ignore provisioning errors */ }
        setMessage('Autenticado correctamente. Redirigiendo...');
        setMessageType('success');
        router.push('/admin/dashboard');
      } else {
        setMessage('No se obtuvo sesión. Revisa tu correo para confirmar la cuenta.');
        setMessageType('error');
      }
    } catch (err: any) {
      console.error('Signin error', err);
      setMessage(err?.message || JSON.stringify(err) || 'Error al iniciar sesión');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    if (disableLogin) {
      alert('El registro está deshabilitado temporalmente');
      return;
    }
    if (!supabase) {
      alert('Servicio de autenticación no disponible');
      return;
    }
    if (!email || !password) {
      alert('Ingrese email y contraseña');
      return;
    }
    setLoading(true);
    try {
      // @ts-ignore - supabase typings may differ
      const res = await supabase.auth.signUp({ email, password });
      const anyRes: any = res;
      const maybeError = (res as any)?.error || (anyRes && anyRes.error);
      const sessionToken = anyRes?.data?.session?.access_token || anyRes?.session?.access_token || null;
      if (maybeError) {
        const errMsg = maybeError.message || JSON.stringify(maybeError);
        setMessage(errMsg);
        setMessageType('error');
        return;
      }
      if (sessionToken) {
        try {
          await fetch('/api/provision', { method: 'POST', headers: { Authorization: `Bearer ${sessionToken}` } });
        } catch (provErr) { /* ignore provisioning errors */ }
        router.push('/admin/dashboard');
      } else {
        setConfirming(true);
        setMessage('Revisa tu correo para confirmar la cuenta.');
        setMessageType('success');
      }
    } catch (err: any) {
      console.error('Signup error', err);
      setMessage(err?.message || JSON.stringify(err) || 'Error al crear cuenta');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  function handleTogglePassword() {
    setShowPassword((s) => !s);
  }

  return (
    disableLogin ? (
      <div className="login-container">
        <main className="login-card card-enter">
          <h1 className="login-title">Acceso deshabilitado</h1>
          <p style={{ color: '#444' }}>El acceso al sistema está temporalmente deshabilitado. Contacta al administrador para más información.</p>
        </main>
      </div>
    ) : (
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {/* Primary action: Email/password */}
              {!isSignup ? (
                <>
                  <button
                    type="button"
                    className="login-button primary"
                    onClick={handleSignin}
                    disabled={loading}
                    style={{ minWidth: 280 }}
                  >
                    {loading ? "Procesando..." : "Ingresar"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="login-button primary"
                    onClick={handleSignup}
                    disabled={loading}
                    style={{ minWidth: 280 }}
                  >
                    {loading ? "Procesando..." : "Crear cuenta"}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" className="link-btn" onClick={() => setIsSignup(false)}>
                      Volver a Iniciar Sesión
                    </button>
                    <div />
                  </div>
                </>
              )}
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
            <div style={{ marginTop: 8 }}>
              <button type="button" className="link-btn" onClick={() => setIsSignup((s) => !s)}>
                {isSignup ? 'Volver a Iniciar Sesión' : 'Crear cuenta'}
              </button>
            </div>
          </div>
          {message ? (
            <div style={{ marginTop: 12 }}>
              <div className={messageType === 'error' ? 'login-error' : 'login-success'}>
                {message}
              </div>
            </div>
          ) : null}
        </form>
      </main>
    </div>
    )
  );
}
