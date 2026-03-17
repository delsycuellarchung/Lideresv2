import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;

/*
  NOTA (Validación server-side y allowlist) - en primera persona:
  - Debo implementar aquí la validación estricta de tokens en el servidor.
    * Debo validar: issuer, audience, expiry, firma y opcionalmente nonce/state.
    * Debo usar los métodos server de Supabase con `serviceKey` cuando sea posible para obtener el usuario.
  - Debo forzar la comprobación de dominios permitidos o del claim `company_code` en el servidor
    para evitar que se eluda la validación desde el cliente.
    Ejemplo de env (solo servidor):
      NEXT_ALLOWED_DOMAINS=tuempresa.com,otrodominio.com
  - Cuando un usuario SSO válido inicie sesión, debo crear o actualizar el registro en la BD con roles mínimos.
    Recomiendo crear una ruta API segura (por ejemplo `/api/provision`) que acepte el token validado y haga el provisioning.
  - Nunca debo subir `serviceKey` o `IDP_CLIENT_SECRET` al control de versiones.
*/

export async function getUserFromAuthHeader(req: { headers: Record<string, any> }) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return { error: 'Missing Authorization header' };
  }
  const token = auth.split(' ')[1];
  if (!supabaseUrl || !serviceKey) return { error: 'Server misconfiguration' };

  const client = createClient(supabaseUrl, serviceKey);
  try {
    // supabase-js v2: auth.getUser(token)
    const { data, error } = await client.auth.getUser(token);
    if (error) return { error: error.message };
    if (!data?.user) return { error: 'Invalid token' };
    return { user: data.user };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Valida token SSO en servidor y comprueba allowlist por dominio.
 * Devuelve { user } cuando es válido o { error } cuando falla.
 */
export async function validateSSOToken(token: string) {
  if (!supabaseUrl || !serviceKey) return { error: 'Server misconfiguration' };
  const client = createClient(supabaseUrl, serviceKey);
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error) return { error: error.message };
    const u = data?.user;
    if (!u) return { error: 'Invalid token' };

    // Allowlist server-side: env NEXT_ALLOWED_DOMAINS (comma-separated)
    const allowed = (process.env.NEXT_ALLOWED_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (allowed.length > 0) {
      const email = (u.email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      if (!domain || !allowed.includes(domain)) {
        return { error: 'Email domain not allowed' };
      }
    }

    return { user: u };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Provisiona (crea/actualiza) usuario en la base de datos usando la service role key.
 * Nota: este método asume que existe una tabla `users` con al menos { id, email, full_name, role }.
 * Si la tabla no existe, la operación fallará de forma segura.
 */
export async function provisionUserInDB(user: any) {
  if (!supabaseUrl || !serviceKey) return { error: 'Server misconfiguration' };
  const client = createClient(supabaseUrl, serviceKey);
  try {
    // Mapear datos básicos
    const fullName = (user.user_metadata as any)?.full_name || user.email || null;
    const codigoFromMeta = (user.user_metadata as any)?.codigo || null;
    const email = user.email || null;
    const payload: any = {
      id: user.id,
      codigo: codigoFromMeta || (email && email.includes('@') ? email.split('@')[0] : null),
      nombre: fullName,
      correo: email,
      cargo: (user.user_metadata as any)?.cargo || null,
      tipo: (user.app_metadata as any)?.role || 'Usuario',
    };

    // Upsert en tabla `personas` (según migraciones existe `personas` con columnas id,codigo,nombre,correo,cargo,tipo)
    const { data, error } = await client.from('personas').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    if (error) {
      // devolver advertencia en lugar de fallo crítico
      return { warning: 'Provisioning failed', details: error.message };
    }
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
