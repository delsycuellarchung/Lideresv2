import nodemailer from 'nodemailer';

let transporter: any = null;

export const getEmailTransporter = () => {
  if (transporter) return transporter;

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const pool = String(process.env.SMTP_POOL || 'true').toLowerCase() !== 'false';

  console.log('📧 Email Config:', {
    host,
    port,
    user: user ? `${user.substring(0, 5)}...${user.substring(user.length - 5)}` : 'NOT SET',
    pass: pass ? `${pass.substring(0, 3)}...${pass.substring(pass.length - 3)}` : 'NOT SET',
    pool,
  });


  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      pool: pool,
      maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10),
      maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10),
      auth: {
        user,
        pass,
      },
      logger: String(process.env.SMTP_LOGGER || 'false').toLowerCase() === 'true',
      debug: String(process.env.SMTP_DEBUG || 'false').toLowerCase() === 'true',
      tls: {
        // In development we disable strict TLS validation so self-signed
        // certificates from a test SMTP are accepted. In production the
        // behavior is controlled by `SMTP_TLS_REJECT_UNAUTHORIZED`.
        rejectUnauthorized: process.env.NODE_ENV === 'production'
          ? String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true'
          : false,
      },
    });

    console.log('✅ Nodemailer transporter created successfully');
    return transporter;
  } catch (error) {
    console.error('❌ Error creating transporter:', error);
    return null;
  }
};

export const sendFormEmail = async (params: {
  evaluatorName: string;
  evaluatorEmail: string;
  evaluadoName: string;
  evaluadoCargo?: string | null;
  formLink: string;
  mensajePersonalizado?: string;
  formData?: any;
}) => {
  const transporter = getEmailTransporter();
  if (!transporter) {
    throw new Error('Email service not configured');
  }

  const { evaluatorName, evaluatorEmail, evaluadoName, evaluadoCargo, formLink, mensajePersonalizado, formData } = params;

  const deriveNameFromEmail = (email?: string) => {
    if (!email) return 'Evaluador';
    const local = String(email).split('@')[0];
    // replace common separators with space
    const cleaned = local.replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'Evaluador';
    // remove trailing numbers and non-letter chars from tokens, preserve accented letters
    const parts = cleaned.split(' ').map(p => p.replace(/[^\p{L}]+/gu, '')).filter(Boolean);
    if (parts.length === 0) return 'Evaluador';
    const pick = parts[0];
    // capitalize using locale to preserve accents
    return pick.charAt(0).toLocaleUpperCase('es-ES') + pick.slice(1).toLocaleLowerCase('es-ES');
  };

  const displayName = (evaluatorName && String(evaluatorName).trim()) ? String(evaluatorName).trim() : deriveNameFromEmail(evaluatorEmail);

  if (String(process.env.SMTP_DEBUG || 'false').toLowerCase() === 'true') {
    console.log('📨 [DEBUG] Email greeting values:', { evaluatorName, evaluatorEmail, displayName });
  }

  const defaultOptions = ['Nunca', 'Rara vez', 'A veces', 'Frecuentemente', 'Siempre'];

  const buildQuestions = () => {
    try {
      if (!formData) return [];
      if (Array.isArray(formData.afirmaciones) && formData.afirmaciones.length > 0) {
        return formData.afirmaciones.map((a: any) => ({
          question: a.pregunta || a.texto || 'Pregunta',
          options: Array.isArray(a.opciones) && a.opciones.length > 0 ? a.opciones : defaultOptions,
          descripcion: a.descripcion || ''
        }));
      }
      const comps = Array.isArray(formData.competencias) ? formData.competencias.map((c: any) => ({ question: c.pregunta || 'Pregunta', options: Array.isArray(c.opciones) ? c.opciones : defaultOptions, descripcion: c.descripcion || '' })) : [];
      const ests = Array.isArray(formData.estilos) ? formData.estilos.map((c: any) => ({ question: c.pregunta || 'Pregunta', options: Array.isArray(c.opciones) ? c.opciones : defaultOptions, descripcion: c.descripcion || '' })) : [];
      return [...comps, ...ests];
    } catch (e) {
      return [];
    }
  };

  const instrucciones = (formData && Array.isArray(formData.instrucciones)) ? formData.instrucciones : [];
  const questions = buildQuestions().slice(0, 12); // cap preview to 12 rows

  const htmlContent = `
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f0f4ff 0%, #f8f9ff 100%); margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        
        <!-- Header con branding -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
          <h1 style="font-size: 28px; margin: 0 0 8px 0; font-weight: 700;">Formulario de Evalucion de Lideres</h1>
          <p style="font-size: 14px; margin: 0; opacity: 0.9;">Te invitamos a compartir tu respuesta</p>
        </div>

        <!-- Contenido principal -->
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);">
          
          <!-- Saludo personalizado -->
          <div style="margin-bottom: 24px;">
            <p style="font-size: 18px; color: #0f172a; margin: 0 0 8px 0; font-weight: 600;">¡Hola, <span style="color: #4f46e5;">${displayName}</span>!</p>
            <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
              Esperamos tu valiosa evaluación sobre el desempeño de:
            </p>
            <!-- Texto informado por el cliente -->
            <div style="margin-top:12px; font-size:14px; color:#475569; line-height:1.7;">
              <p style="margin:0 0 8px 0;">Esta herramienta nos permitirá conocer los estilos de liderazgo de nuestros Gerentes y Subgerentes, así como identificar oportunidades de mejora que aporten al desarrollo de toda la organización.</p>
              <p style="margin:0 0 8px 0;">Su participación es clave, les pedimos que respondan la evaluación con total objetividad y sinceridad, ya que solo así podremos obtener resultados que reflejen la realidad y nos ayuden a evolucionar.</p>
              <p style="margin:0 0 8px 0;">Al momento de completar el formulario, piensen en su líder directo. En la parte superior izquierda del formulario encontrará el nombre del líder asignado, lo cual les permitirá confirmar que están evaluando correctamente.</p>
              <p style="margin:0 0 8px 0;">El formulario contiene diversas afirmaciones sobre situaciones laborales reales que se han presentado o que se presentan. Seleccionen únicamente una opción para cada afirmación, evaluando la frecuencia con la que su líder generalmente actúa o se comporta de esa manera.</p>
            </div>
          </div>

          <!-- Card del evaluado removida por petición del cliente -->

          <!-- Mensaje personalizado destacado -->
          ${mensajePersonalizado ? `
          <div style="background: #eff6ff; border: 2px solid #93c5fd; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 13px; color: #0369a1; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase;">📋 Mensaje especial</p>
            <p style="font-size: 14px; color: #0f172a; margin: 0; line-height: 1.6;">${mensajePersonalizado}</p>
          </div>
          ` : ''}

          <!-- Descripción (texto simplificado) -->
          <div style="margin-bottom: 28px;">
            
          </div>

          <!-- Botón CTA -->
          <div style="text-align: center; margin-bottom: 32px;">
            <a href="${formLink}" style="
              display: inline-block;
              background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
              color: white;
              padding: 16px 48px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 15px;
              box-shadow: 0 8px 24px rgba(79, 70, 229, 0.3);
              transition: transform 0.2s;
            " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
              ➔ Completar Evaluación
            </a>
          </div>

          <!-- Detalles importantes (simplificados) -->
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 12px; color: #475569; margin: 0 0 8px 0; font-weight: 600;">⏰ Información importante:</p>
            <ul style="font-size: 13px; color: #64748b; margin: 0; padding-left: 20px; line-height: 1.7;">
              <li>Puedes guardar tu progreso y continuar después</li>
              <li>Toda la información es confidencial</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px 30px; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">Este es un mensaje automático. Por favor no respondas a este correo.</p>
          <p style="margin: 6px 0 0 0;">© Líderes | Sistema de Evaluación de Liderazgo</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `${process.env.SMTP_FROM_NAME || 'Líderes'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: evaluatorEmail,
    subject: `Evaluación de Lideres`,
    html: htmlContent,
  };
  const maxAttempts = parseInt(process.env.EMAIL_SEND_RETRIES || '3', 10);
  let attempt = 0;
  let lastError: any = null;
  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      console.log(`📤 Enviando email a: ${evaluatorEmail} (intento ${attempt}/${maxAttempts})`);
      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email enviado exitosamente:', result.messageId);
      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Error enviando email (intento ${attempt}):`, error && error.message ? error.message : error);
      // backoff
      const backoff = Math.min(2000 * attempt, 10000);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
  console.error('❌ Todos los intentos fallaron. Último error:', lastError && lastError.message ? lastError.message : lastError);
  throw lastError || new Error('Email send failed');
};

