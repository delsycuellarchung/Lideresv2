# Líderes - Aplicación de Gestión de Formularios y Evaluaciones

## Resumen

Aplicación web basada en Next.js (TypeScript) para gestión, envío y análisis de formularios y evaluaciones. Incluye un panel administrativo, APIs server-side para importación y persistencia de respuestas, integración con Supabase y utilidades para migraciones e importación de datos.

## Estado del proyecto

- Stack principal: Next.js (App Router), TypeScript, Tailwind CSS.
- Backend ligero: Supabase (cliente en `src/lib/supabaseClient.ts`) y SQL migrations bajo `scripts/migrations/`.
- Scripts de mantenimiento y importación en `scripts/` y `archive/scripts/`.

## Estructura principal

- `package.json` (raíz): dependencias y scripts globales.
- `lideres-web/`: aplicación Next.js (config, documentación operativa y código fuente).
  - `lideres-web/package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.cjs` — configuración.
  - `lideres-web/EMAIL_SETUP.md`, `SSO_SETUP.md`, `VERCEL_SETUP.md` — guías operativas.
  - `lideres-web/src/` — código fuente principal:
    - `app/` — layouts, rutas y contexto (`globals.css`, `layout.tsx`, `page.tsx`, `UserContext.tsx`).
      - `app/admin/` — panel administrativo (dashboard, import, reportes, usuarios, etc.).
      - `app/api/` — handlers API (upload, save-responses, provision, send-forms, etc.).
      - `app/formulario/` — páginas públicas de formularios (por token/estado).
    - `components/` — componentes reutilizables (`DraggableModal.tsx`, `GeneralDonut.tsx`).
    - `lib/` — servicios y utilidades (`emailService.ts`, `excelExporter.ts`, `formularioService.ts`, `serverAuth.ts`).
    - `pages/api/` — rutas API legacy u endpoints adicionales.
    - `types/` — tipos y declaraciones (`custom-modules.d.ts`).
- `scripts/` (raíz): utilidades, migraciones y herramientas de import (p. ej. `run_migrations.js`, `upload-import.mjs`).
- `scripts/migrations/`: archivos SQL con la evolución del esquema (`001_*.sql` ... `010_*.sql`, `run_all_migrations.sql`).
- `uploads-debug/` y `lideres-web/uploads-debug/`: ejemplos JSON de importación y debug (`formulario.json`, `last-import.json`).

## Archivos clave para revisión inmediata

- [lideres-web/package.json](lideres-web/package.json)
- [lideres-web/README.md](lideres-web/README.md)
- [lideres-web/src/app/layout.tsx](lideres-web/src/app/layout.tsx)
- [lideres-web/src/lib/formularioService.ts](lideres-web/src/lib/formularioService.ts)
- `scripts/migrations/*` (ver `scripts/migrations/run_all_migrations.sql`)

## Variables de entorno importantes

Las variables concretas pueden definirse en `.env` o en el entorno del despliegue.

- `SUPABASE_URL` — URL del proyecto Supabase.
- `SUPABASE_KEY` — clave pública/privada para el cliente Supabase.
- `DATABASE_URL` — URL de la base de datos (si se usa DB externa).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` — configuración SMTP para envío de correos.
- `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL` — URL base de la aplicación para callbacks y links.
- `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET` — configuración del SSO (si aplica).
- `VERCEL_*` y otras vars específicas de despliegue — según `VERCEL_SETUP.md`.

Revisar `lideres-web/src/lib/emailService.ts` y `scripts/test-smtp.js` para ver cómo se usan las variables SMTP.

## Comandos y scripts comunes

Ejecutar desde `lideres-web/` (subproyecto Next.js):

```bash
npm install
npm run dev    # desarrollo
npm run build  # build para producción
npm run start  # start (según package.json)
```

Migraciones y utilidades (raíz `scripts/`):

```bash
# Ejecutar migraciones SQL según instrucciones internas
node scripts/run_migrations.js   # o revisar scripts/migrations/run_all_migrations.sql
node scripts/upload-import.mjs   # importación personalizada
```

## Migraciones y esquema de base de datos

- Mantener los archivos en `scripts/migrations/` sincronizados con los cambios del modelo.
- Revisar y aplicar siempre `run_all_migrations.sql` en entornos nuevos.

## Importaciones, depuración y datos de ejemplo

- Los JSON de ejemplo para pruebas están en `uploads-debug/` y `lideres-web/uploads-debug/`.
- `archive/scripts/` contiene utilidades históricas y scripts de importación; revisar antes de reutilizar.

## Mantenimiento y operaciones

- Revisar `EMAIL_SETUP.md` y `SSO_SETUP.md` para configurar servicios externos.
- Backups: realizar backups regulares de la BD; las migraciones están en `scripts/migrations/`.

## Recomendaciones para documentación adicional

1. Añadir un README detallado en `lideres-web/` (si falta) con pasos de desarrollo locales y variables env específicas.
2. Crear pequeños READMEs en carpetas grandes: `src/lib/`, `app/admin/`, `scripts/`, `scripts/migrations/`.
3. Documentar el flujo de importación de formularios (entrada JSON → validación → persistencia) en `docs/`.
4. Añadir una sección de debugging con comandos útiles y cómo reproducir errores comunes.

## Contribuir

- Abrir ramas por feature y PRs bien descritos.
- Incluir pasos para probar manualmente o tests automatizados al añadir funcionalidades.

---

Si quieres, genero ahora un `README.md` más detallado específicamente para `lideres-web/` o README por carpetas (`src/lib`, `app/admin`, `scripts`). Indica cuál prefieres y lo creo listo para pegar.

## Seguridad (detalle)

### Resumen y modelo de amenazas

El sistema gestiona datos sensibles (respuestas de formularios, información de usuarios y datos asistenciales). Asumir amenazas típicas: acceso no autorizado, exfiltración de datos, inyección de consultas, CSRF, XSS, exposición de secretos en repositorios o logs y compromisos en dependencias.

### Autenticación y autorización

- Punto central: control de acceso en el panel `app/admin/` y endpoints API. Usar sesiones seguras y cookies HttpOnly.
- Recomendar revisar y centralizar la lógica en [lideres-web/src/lib/serverAuth.ts](lideres-web/src/lib/serverAuth.ts) o el archivo de autenticación que provea la app.
- Para APIs: validar tokens/claims en cada handler antes de realizar operaciones de escritura o lectura sensibles.

### Protección de datos en tránsito y en reposo

- En tránsito: forzar HTTPS en producción (Vercel ya lo hace por defecto). Asegurar `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL` use HTTPS.
- En reposo: la base de datos debe tener cifrado por defecto (config DB/host). Para almacenamiento de objetos (si aplica), usar políticas de acceso restringido.

### Gestión de secretos

- No guardar claves en el repositorio. Usar variables de entorno en Vercel/host.
- Variables críticas: `SUPABASE_KEY`, `DATABASE_URL`, `SMTP_PASSWORD`, `SSO_CLIENT_SECRET`.
- Rotar claves periódicamente y usar roles con permisos mínimos (principio de least privilege).

### Validación y saneamiento

- Validar y sanitizar todas las entradas en endpoints que reciben formularios (`app/api/save-responses/`, `app/api/insert-response/`, `app/api/upload/`).
- Evitar concatenación de SQL; usar queries parametrizadas o el cliente oficial (Supabase) para prevenir SQL injection.

### Prevención XSS / CSP

- Escapar contenido renderizado que provenga de respuestas de formularios antes de insertarlo en el DOM.
- Considerar políticas CSP estrictas y `Content-Security-Policy` en producción.

### CSRF

- Para endpoints que usan cookies de sesión, usar tokens CSRF o mecanismos de SameSite en cookies.

### Logs y monitoreo

- Evitar loggear datos sensibles (respuestas enteras, claves). Filtrar PII en logs.
- Implementar alertas para errores críticos y accesos inusuales.

### Dependencias y mantenimiento

- Mantener dependencias actualizadas (`npm audit`, dependabot o similar).
- Revisar dependencias con código nativo o binarios por posibles CVEs.

### Copias de seguridad y recuperación

- Planificar backups regulares de la base de datos y pruebas periódicas de restauración.

### Recomendaciones de despliegue segura

- Usar entornos separados (development, staging, production) con variables independientes.
- Habilitar RLS (Row Level Security) en Supabase cuando aplique y definir políticas mínimas.

## Archivos y rutas con funcionalidades críticas

Abajo se listan archivos y carpetas clave con su responsabilidad. Revisarlos cuando se audite seguridad o datos.

- `lideres-web/src/lib/formularioService.ts` — lógica central para validación y persistencia de formularios.
- `lideres-web/src/lib/supabaseClient.ts` — cliente Supabase; punto donde se configuran las credenciales (`SUPABASE_URL`, `SUPABASE_KEY`).
- `lideres-web/src/lib/emailService.ts` — envío de correos; usa variables SMTP.
- `lideres-web/src/app/api/save-responses/` — endpoints que reciben y guardan respuestas (revisar validación y permisos).
- `lideres-web/src/app/api/insert-response/` — endpoints para inserciones puntuales desde imports o formularios.
- `lideres-web/src/app/api/upload/` y `lideres-web/src/app/api/blob-upload/` — manejo de ficheros/subidas.
- `lideres-web/src/app/api/provision/` — endpoints de provisión/creación de recursos (revisar restricciones).
- `lideres-web/src/app/api/send-forms/` — lógica para enviar formularios por correo.
- `lideres-web/src/app/api/update-submission-status/` — actualización de estados de envíos.
- `scripts/upload-import.mjs` y `archive/scripts/*` — scripts de importación masiva: validar antes de ejecutar en producción.
- `scripts/migrations/*.sql` — esquema y cambios: revisar antes de aplicar en producción.

## Flujo de envío y persistencia de formularios (alto nivel)

1. Usuario completa formulario público (UI en `app/formulario/` o ruta por token).
2. Frontend envía datos al endpoint API correspondiente (por ejemplo `app/api/save-responses/` o `app/api/insert-response/`).
3. Endpoint valida datos (schema, campos obligatorios) y verifica autorización/ratelimits.
4. Servicio de persistencia (`formularioService.ts`) transforma y persiste la información en la base de datos a través de `supabaseClient.ts`.
5. Si aplica, se envían correos de confirmación usando `emailService.ts` (SMTP) y registros de auditoría.
6. El sistema registra eventos relevantes en logs (sin PII) y encola tareas posteriores (exportes, notificaciones).

## Checklist de seguridad rápida (para auditorías)

- [ ] No hay secretos en el repositorio.
- [ ] Endpoints que escriben datos validan y autenticán correctamente.
- [ ] Dependencias actualizadas y sin CVEs críticos.
- [ ] Backups configurados y probados.
- [ ] RLS y/o policies de acceso en la BD (si se usa Supabase).
- [ ] CSP y headers de seguridad habilitados en producción.


---
