# 📧 Sistema de Envío de Formularios por Correo

## Configuración

### 1. Configurar Variables de Entorno

Copia `.env.local.example` a `.env.local` y configura tus credenciales de correo:

```bash
# Para Gmail (recomendado para pruebas):
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noeliachung270@gmail.com
SMTP_PASS=Chungnoelia251103@@  # Generar en: https://myaccount.google.com/apppasswords

# Para otros proveedores (SendGrid, AWS SES, etc):
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx

NEXT_PUBLIC_APP_URL=http://localhost:3000  # O tu URL de producción
```

### 2. Generar Contraseña de Aplicación (Gmail)

1. Ve a: https://myaccount.google.com/apppasswords
2. Selecciona "Mail" y "Windows Computer"
3. Copia la contraseña generada
4. Pégala en `SMTP_PASS` en `.env.local`

### 3. Crear Tabla en Supabase (Opcional)

Si usas Supabase, crea estas tablas:

**form_submissions**
```sql
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID NOT NULL UNIQUE,
  evaluator_email TEXT NOT NULL,
  evaluator_name TEXT,
  form_data JSONB,
  responses JSONB,
  status TEXT DEFAULT 'pending',  -- pending, completed, expired
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + interval '30 days')
);
```

## Flujo de Uso

### 1. Crear el Formulario

1. Ve a `/admin/formulario/competencias` y añade competencias
2. Ve a `/admin/formulario/estilos` y añade estilos
3. Ve a `/admin/formulario/afirmaciones` y crea afirmaciones
4. Ve a `/admin/formulario/instrucciones` y añade instrucciones

### 2. Enviar Formulario a Evaluadores

1. Ve a `/admin/enviar-formulario`
2. Selecciona los evaluadores
3. Haz clic en "Enviar a X evaluadores"
4. Los correos serán enviados inmediatamente

### 3. Los Evaluadores Responden

1. Reciben un correo con un enlace único
2. Hacen clic en el enlace → `/formulario/[token]`
3. Completan el formulario
4. Las respuestas se guardan automáticamente

### 4. Ver Respuestas

Ve a `/admin/respuestas-formulario` para ver:
- Evaluadores que ya respondieron
- Evaluadores pendientes
- Fecha de envío y completación

## Pruebas en Desarrollo

### Opción 1: Usar Gmail
- Rápido y fácil
- Ideal para pruebas
- No requiere servidor SMTP externo

### Opción 2: Usar Mailtrap
- Captura correos sin enviarlos realmente
- Perfecto para testing
- URL: https://mailtrap.io

**Configuración Mailtrap:**
```
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=tu-usuario
SMTP_PASS=tu-contraseña
```

### Opción 3: Test Local con nodemailer
```typescript
// Para testing sin enviar correos
const transporter = nodemailer.createTestAccount();
```

## Estructura de Datos

### Respuesta del Usuario
```json
{
  "comp-0": "Muy Alto",
  "comp-1": "Alto",
  "est-0": "Liderazgo Transformacional",
  "est-1": "Liderazgo Transaccional"
}
```

## API Endpoints

### POST `/api/send-forms`
Envía formularios a múltiples evaluadores

**Request:**
```json
{
  "evaluators": [
    { "id": "1", "nombre": "Juan", "correo": "juan@example.com" }
  ],
  "formData": { ... }
}
```

**Response:**
```json
{
  "successCount": 1,
  "failureCount": 0,
  "results": [ ... ]
}
```

### POST `/api/save-responses`
Guarda las respuestas del evaluador

**Request:**
```json
{
  "token": "uuid-xxx",
  "responses": { "comp-0": "Alto", ... }
}
```

## Solución de Problemas

### Error: "Email service not configured"
- Verifica que `.env.local` tiene `SMTP_USER` y `SMTP_PASS`
- Reinicia el servidor dev

### Gmail: "Invalid credentials"
- Usa contraseña de App, no tu contraseña de Gmail
- Genera nueva en: https://myaccount.google.com/apppasswords

### Correos no llegan
- Verifica la carpeta de spam
- Comprueba en Mailtrap si estás en desarrollo

### Token inválido
- El token expiró (30 días por defecto)
- Reenvía el formulario

## Seguridad

- Los tokens son UUID v4 (imposible de adivinar)
- Los tokens expiran en 30 días (configurable)
- Las respuestas se guardan encriptadas en la BD
- Los correos son HTTPS

## Customización

### Cambiar Tiempo de Expiración
En `src/pages/api/send-forms.ts`:
```typescript
expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
```

### Cambiar Contenido del Email
Ve a `src/lib/emailService.ts` y modifica `htmlContent`

### Personalizar Página del Formulario
Ve a `src/app/formulario/[token]/page.tsx`

---

¡Listo! Tu sistema de formularios por correo está operativo. 🚀
