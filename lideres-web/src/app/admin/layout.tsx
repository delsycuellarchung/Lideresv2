
"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { UserProvider, useUser } from "../UserContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isResultadosActive = pathname?.startsWith("/admin/resultados");
  if (typeof window !== 'undefined') {
    // debug: show current pathname and if resultados considered active
    // eslint-disable-next-line no-console
    console.log('[AdminLayout] pathname=', pathname, 'resultadosActive=', isResultadosActive);
  }
  const [formOpen, setFormOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';
  const devAuth = String(process.env.NEXT_PUBLIC_DEV_AUTH || '').toLowerCase();
  useEffect(() => {
    if (pathname?.startsWith("/admin/formulario")) setFormOpen(true);
    if (pathname?.startsWith("/admin/resultados")) setResultOpen(true);
  }, [pathname]);
  const topbarMarginTop = -8;
  
  const handleLogout = async () => {
    localStorage.removeItem("adminAuth");


    if (supabase && !disableDb) {
      await supabase.auth.signOut();
    }
    router.push('/admin/login');
  };

  if (pathname?.startsWith("/admin/login")) {
    return <main style={{ padding: 28 }}>{children}</main>;
  }

  return (
    <UserProvider>
      <div className="admin-shell" style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
        <aside className={"admin-sidebar " + (sidebarOpen ? "" : "collapsed")} style={{ width: sidebarOpen ? 220 : 64, padding: 0, transition: 'width 0.28s cubic-bezier(.4,0,.2,1), box-shadow 0.3s', overflowY: 'auto', maxHeight: '100vh', boxShadow: sidebarOpen ? '0 2px 8px #0001' : 'none', position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div
              className="admin-brand"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: 40,
                paddingLeft: 6,
                paddingRight: 12,
                width: '100%',
                gap: 8,
              }}
            >
              <button
                aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
                onClick={() => setSidebarOpen((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 8,
                  margin: 0,
                  marginRight: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1001,
                  position: 'relative',
                  width: 44,
                  height: 48,
                  borderRadius: 10,
                  transition: 'background 0.18s, transform 120ms',
                }}
                tabIndex={0}
              >
                <img src="/images/menuhamburguesa.png" alt="Menú" className={"hamburguer-anim" + (sidebarOpen ? "" : " closed")} style={{ width: 34, height: 34, display: 'block', margin: 0, padding: 0, transform: 'translateX(-6px)' }} />
              </button>
            </div>
            {sidebarOpen && (
              <nav style={{ padding: '2px 0', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'flex-start', alignItems: 'stretch', position: 'relative' }}>
                <Link href="/admin/dashboard" className={"menu-btn " + (pathname?.startsWith("/admin/dashboard") ? "active" : "") } aria-current={pathname?.startsWith('/admin/dashboard') ? 'page' : undefined} title="Dashboard">
                  <span className="menu-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M3 13h8V3H3v10zM13 21h8v-8h-8v8zM13 3v6h8V3h-8zM3 21h8v-6H3v6z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="menu-label">Dashboard</span>
                </Link>
                <Link href="/admin/import" className={"menu-btn " + (pathname?.startsWith("/admin/import") ? "active" : "") } aria-current={pathname?.startsWith('/admin/import') ? 'page' : undefined} title="Importar">
                  <span className="menu-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M12 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M21 21H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="menu-label">Importar</span>
                </Link>
                <Link href="/admin/datos-importados" className={"menu-btn " + (pathname?.startsWith("/admin/datos-importados") ? "active" : "") } aria-current={pathname?.startsWith('/admin/datos-importados') ? 'page' : undefined} title="Datos Importados">
                  <span className="menu-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M3 3h18v4H3V3zm0 7h18v11H3V10z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="menu-label">Datos</span>
                </Link>
                <button
                  type="button"
                  className={"menu-btn " + (pathname?.startsWith("/admin/formulario") ? "active" : "")}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}
                  onClick={() => setFormOpen((v) => !v)}
                  aria-expanded={formOpen}
                  aria-controls="submenu-formulario"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="menu-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className="menu-label">Formulario</span>
                  </span>
                  <span style={{ fontSize: 13, transition: 'transform 0.2s', position: 'absolute', right: 20, top: '50%', transform: formOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)' }}>▼</span>
                </button>
                {formOpen && (
                  <div id="submenu-formulario" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Link href="/admin/formulario/competencias" className={"menu-btn " + (pathname?.startsWith("/admin/formulario/competencias") ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname?.startsWith('/admin/formulario/competencias') ? 'page' : undefined} title="Competencias">
                      <span className="menu-label">Competencias</span>
                    </Link>
                    <Link href="/admin/formulario/estilos" className={"menu-btn " + (pathname?.startsWith("/admin/formulario/estilos") ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname?.startsWith('/admin/formulario/estilos') ? 'page' : undefined} title="Estilos">
                      <span className="menu-label">Estilos</span>
                    </Link>
                    <Link href="/admin/formulario/instrucciones" className={"menu-btn " + (pathname?.startsWith("/admin/formulario/instrucciones") ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname?.startsWith('/admin/formulario/instrucciones') ? 'page' : undefined} title="Instrucciones">
                      <span className="menu-label">Instrucciones</span>
                    </Link>
                    <Link href="/admin/formulario/afirmaciones" className={"menu-btn " + (pathname?.startsWith("/admin/formulario/afirmaciones") ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname?.startsWith('/admin/formulario/afirmaciones') ? 'page' : undefined} title="Afirmaciones">
                      <span className="menu-label">Afirmaciones</span>
                    </Link>
                    <Link href="/admin/enviar-formulario" className={"menu-btn " + (pathname?.startsWith("/admin/enviar-formulario") ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname?.startsWith('/admin/enviar-formulario') ? 'page' : undefined} title="Enviar Formulario">
                      <span className="menu-label">Enviar Formulario</span>
                    </Link>
                    <Link href="/admin/respuestas-formulario" className={"menu-btn " + (pathname?.startsWith("/admin/respuestas-formulario") ? "active" : "") } style={{ paddingLeft: 28, marginTop: -6 }} aria-current={pathname?.startsWith('/admin/respuestas-formulario') ? 'page' : undefined} title="Respuestas Formulario">
                      <span className="menu-label">Respuestas Formulario</span>
                    </Link>
                  </div>
                )}
                <button
                  type="button"
                  className={"menu-btn " + (pathname?.startsWith("/admin/resultados") ? "active" : "")}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', position: 'relative' }}
                  onClick={() => setResultOpen((v) => !v)}
                  aria-expanded={resultOpen}
                  aria-controls="submenu-resultados"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="menu-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M3 3h6v18H3V3zm8 6h10v12H11V9z" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="menu-label">Resultados</span>
                  </span>
                  <span style={{ fontSize: 13, transition: 'transform 0.2s', position: 'absolute', right: 27, top: '50%', transform: resultOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)' }}>▼</span>
                </button>
                {resultOpen && (
                  <div id="submenu-resultados" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Link href="/admin/resultados" className={"menu-btn " + (pathname === "/admin/resultados" ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname === '/admin/resultados' ? 'page' : undefined} title="Resultados Detalle">
                      <span className="menu-label">Resultados Detalle</span>
                    </Link>
                    <Link href="/admin/resultados/datos-evaluacion" className={"menu-btn " + (pathname === "/admin/resultados/datos-evaluacion" ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname === '/admin/resultados/datos-evaluacion' ? 'page' : undefined} title="Datos Evaluacion">
                      <span className="menu-label">Datos Evaluacion</span>
                    </Link>
                    <Link href="/admin/resultados/resultados-finales" className={"menu-btn " + (pathname === "/admin/resultados/resultados-finales" ? "active" : "") } style={{ paddingLeft: 28 }} aria-current={pathname === '/admin/resultados/resultados-finales' ? 'page' : undefined} title="Resultados Finales">
                      <span className="menu-label">Resultados Finales</span>
                    </Link>
                  </div>
                )}
                <Link href="/admin/reportes" className={"menu-btn " + (pathname?.startsWith("/admin/reportes") ? "active" : "") } aria-current={pathname?.startsWith('/admin/reportes') ? 'page' : undefined} title="Reportes">
                  <span className="menu-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M3 3h18v4H3V3zm0 7h18v11H3V10z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="menu-label">Reportes</span>
                </Link>
                <Link href="/admin/gestion" className={"menu-btn " + (pathname?.startsWith("/admin/gestion") ? "active" : "") } aria-current={pathname?.startsWith('/admin/gestion') ? 'page' : undefined} title="Gestión">
                  <span className="menu-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M12 2l3 7h7l-5.6 4.1L20 22l-8-5-8 5 1.6-8.9L0 9h7l3-7z" fill="currentColor" />
                    </svg>
                  </span>
                  <span className="menu-label">Gestión</span>
                </Link>
              </nav>
            )}
          </div>
          {/* sidebar footer removed - user header moved to top bar */}
        </aside>
        <main
          className="admin-content"
          style={{
            flex: 1,
            padding: '24px 32px 24px 0',
            marginLeft: sidebarOpen ? 236 : 56,
            marginTop: 0,
            transition: 'margin-left 0.3s cubic-bezier(.4,0,.2,1)',
            overflowY: 'auto',
            height: '100vh',
          }}
        >
          <div className="admin-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '8px 16px', marginBottom: 12, marginTop: topbarMarginTop }}>
            <div className="user-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -12 }}>
              <div style={{ fontWeight: 700, color: 'rgba(0,0,0,0.9)', paddingRight: 6 }}>Usuario</div>
              <button type="button" onClick={handleLogout} aria-label="Cerrar sesión" title="Cerrar sesión" className="user-logout-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>
    </UserProvider>
  );
}


