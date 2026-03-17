SSO Setup — Instrucciones para administradores

Propósito
- Documentar los pasos exactos que deben ejecutar los administradores de IdP/infra para habilitar SSO en esta aplicación.

1) Decidir IdP y protocolo
- Preferir OIDC (OpenID Connect) si está disponible (Azure AD, Okta, Google Workspace).

2) Registrar la aplicación en el IdP
- Crear una nueva aplicación/cliente en el IdP.
- Tipo: Web / OIDC.
- Scopes: `openid email profile`.
- Habilitar MFA si la política de la empresa lo exige.

3) Redirect URIs (añadir para cada entorno)
- Dev: `http://localhost:3000/admin/login`
- Staging: `https://staging.tu-dominio.com/admin/login` (ejemplo)
- Prod: `https://app.tu-dominio.com/admin/login`

4) Obtener client_id y client_secret
- Guardar `client_id` y `client_secret` provistos por el IdP.

5) Variables de entorno a configurar (production: usar panel de despliegue Secrets)
- Server-only (NO subir a repositorio):
  - `SUPABASE_SERVICE_ROLE_KEY` = <<service-role-key>>
  - `IDP_CLIENT_SECRET` = <<client-secret>>
  - `IDP_CLIENT_ID` = <<client-id>>  (si es necesario para integraciones directas)
  - `NEXT_ALLOWED_DOMAINS` = tuempresa.com,otrodominio.com
- Público (solo para control UX, no son secrets):
  - `NEXT_PUBLIC_SSO_PROVIDER` = google | azure | okta
  - `NEXT_PUBLIC_ALLOWED_DOMAINS` = tuempresa.com  (solo para pruebas locales)

6) Configurar provider en Supabase (si se usa Supabase Auth)
- Ir al dashboard de Supabase -> Authentication -> Providers.
- Añadir Google / Azure / OpenID Connect según corresponda.
- Pegar `client_id`/`client_secret` y Redirect URIs iguales a las registradas en el IdP.

7) Qué hace la app del lado del servidor (resumen técnico)
- `src/lib/serverAuth.ts` valida tokens server-side y aplica allowlist por dominio.
- `src/app/api/provision/route.ts` valida el token y provisiones el usuario en la tabla `personas`.
- `src/app/UserContext.tsx` maneja la experiencia cliente (suscripciones) pero NO reemplaza la validación server-side.

8) Pruebas (staging)
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_ALLOWED_DOMAINS` están en los secrets del entorno.
- Hacer login SSO con cuenta permitida (dominio configurado) y verificar que `/api/provision` devuelve `ok: true`.
- Probar con una cuenta denegada (otro dominio) y comprobar que la app redirige con `?error=sso_denied`.

9) Rollback y seguridad
- Si algo falla, deshabilitar el provider en el dashboard de Supabase o eliminar los Redirect URIs.
- Rotar `IDP_CLIENT_SECRET` si se sospecha filtración.
