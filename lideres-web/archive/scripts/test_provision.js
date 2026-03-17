// Script de prueba local para verificar el mapeo que hacemos al provisionar usuarios SSO.
// No requiere conexión a Supabase; solo simula el payload que se enviaría a la tabla `personas`.

function buildProvisionPayload(user) {
  const fullName = (user.user_metadata && user.user_metadata.full_name) || user.email || null;
  const codigoFromMeta = (user.user_metadata && user.user_metadata.codigo) || null;
  const email = user.email || null;
  const payload = {
    id: user.id,
    codigo: codigoFromMeta || (email && email.includes('@') ? email.split('@')[0] : null),
    nombre: fullName,
    correo: email,
    cargo: (user.user_metadata && user.user_metadata.cargo) || null,
    tipo: (user.app_metadata && user.app_metadata.role) || 'Usuario',
  };
  return payload;
}

function main() {
  const mockUser = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'juan.perez@tuempresa.com',
    user_metadata: { full_name: 'Juan Pérez', cargo: 'Analista', codigo: 'JP123' },
    app_metadata: { role: 'Admin' },
  };

  const payload = buildProvisionPayload(mockUser);
  console.log('Payload de provisioning (simulado):');
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) main();
