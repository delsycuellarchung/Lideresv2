import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { sendFormEmail } from '@/lib/emailService';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    console.log('🔵 [API] POST /api/send-forms llamado');
    const body = await request.json();
    const { evaluators, formData, mensajePersonalizado } = body;

    console.log(`📋 [API] Recibidos ${evaluators?.length || 0} evaluadores`);

    if (!evaluators || !Array.isArray(evaluators) || evaluators.length === 0) {
      console.error('❌ [API] No evaluators provided');
      return NextResponse.json(
        { error: 'No evaluators provided' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const sendEmails = String(process.env.SEND_EMAILS || 'true').toLowerCase() !== 'false';
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const evaluator of evaluators) {
      try {
        const formToken = uuidv4();
        const email = evaluator.correo || evaluator.correo_evaluador || evaluator.email || null;
        let evaluatorNameResolved = (evaluator.nombre_evaluador || evaluator.nombre || evaluator.nombreEvaluador || evaluator.nombre_evaluador_alt || '').toString().trim();
        const evaluadoName = (evaluator.nombre_evaluado || evaluator.nombre_alt || evaluator.nombreEvaluado || evaluator.nombreEvaluado || 'N/A').toString();
        let evaluadoCodigo = evaluator.codigo_evaluado || evaluator.codigo || evaluator.codigoEvaluado || evaluator.evaluado_codigo || evaluator.evaluadoCodigo || null;
        // If not provided, try best-effort lookup by evaluadoName in personas table
        if (!evaluadoCodigo && supabase) {
          try {
            const nameKey = evaluadoName || evaluator.nombre_evaluado || evaluator.nombre;
            if (nameKey) {
              const { data: personaData, error: personaErr } = await supabase.from('personas').select('codigo').ilike('nombre', `%${String(nameKey).split(' ').slice(0,3).join('%')}%`).limit(1).single();
              if (!personaErr && personaData && personaData.codigo) evaluadoCodigo = personaData.codigo;
            }
          } catch (lookupErr) {
            // ignore lookup errors
          }
        }

        // If name not provided, try to resolve full name from DB by email
        if ((!evaluatorNameResolved || String(evaluatorNameResolved).trim() === '') && email && supabase) {
          try {
            const emailKey = String(email).toLowerCase();
            // Try evaluators table first
            const { data: evData } = await supabase.from('evaluators').select('nombre_evaluador,nombre,correo_evaluador,correo').or(`correo_evaluador.eq.${emailKey},correo.eq.${emailKey}`).limit(1);
            if (Array.isArray(evData) && evData.length > 0) {
              const cand = evData[0] as any;
              evaluatorNameResolved = (cand.nombre_evaluador || cand.nombre || evaluatorNameResolved || '').toString().trim();
            } else {
              // fallback to personas table
              try {
                const { data: pData } = await supabase.from('personas').select('nombre,correo').ilike('correo', `%${emailKey}%`).limit(1);
                if (Array.isArray(pData) && pData.length > 0) {
                  const cand2 = pData[0] as any;
                  evaluatorNameResolved = (cand2.nombre || evaluatorNameResolved || '').toString().trim();
                }
              } catch (e) {}
            }
          } catch (e) {
            // ignore lookup errors
            console.warn('Name lookup by email failed', e);
          }
        }

        // Valida si existe el correo
        if (!email || String(email).trim() === '') {
          failureCount++;
          results.push({
            success: false,
            evaluador: evaluatorNameResolved,
            correo: null,
            evaluando: evaluadoName,
            error: 'No tiene correo asignado',
          });
          continue;
        }

        // enviar email (puede deshabilitarse con SEND_EMAILS=false)
        if (sendEmails) {
          try {
            console.log(`📧 [API] Enviando email a ${email} para ${evaluadoName}`);
            await sendFormEmail({
              evaluatorName: evaluatorNameResolved || '',
              evaluatorEmail: email,
              evaluadoName: evaluadoName,
              evaluadoCargo: evaluator.cargo_evaluado || null,
              formLink: `${appUrl}/formulario/${formToken}`,
              mensajePersonalizado: mensajePersonalizado || '',
              formData: formData,
            });
            console.log(`✅ [API] Email enviado exitosamente a ${email}`);
          } catch (emailError: any) {
            console.error(`Email error for ${email}:`, emailError.message);
            failureCount++;
            results.push({
              success: false,
              evaluador: evaluatorNameResolved,
              correo: email,
              evaluando: evaluadoName,
              error: `Error enviando email: ${emailError.message}`,
            });
            continue;
          }
        } else {
          console.log(`ℹ️ [API] SEND_EMAILS=false — simulando envío a ${email} para ${evaluadoName}`);
        }
        if (supabase) {
          try {
            const { data: insertData, error: insertError } = await supabase
              .from('form_submissions')
              .insert({
                token: formToken,
                evaluator_email: email,
                evaluator_name: evaluatorNameResolved,
                form_data: formData || {},
                responses: {
                  evaluado_nombre: evaluadoName,
                  evaluado_cargo: evaluator.cargo_evaluado || null,
                  evaluado_area: evaluator.area_evaluado || null,
                  evaluador_area: evaluator.area_evaluador || null,
                },
                evaluado_codigo: evaluadoCodigo || null,
                status: 'pending',
              })
              .select('token')
              .single();

            if (insertError) {
              console.warn(`DB save error for ${email}:`, insertError.message || insertError);
              failureCount++;
              results.push({
                success: false,
                evaluador: evaluatorNameResolved,
                correo: email,
                evaluando: evaluadoName,
                error: `DB save error: ${insertError.message || JSON.stringify(insertError)}`,
              });
              continue; // skip counting as success since DB did not persist
            }
          } catch (dbError: any) {
            console.warn(`DB exception for ${email}:`, dbError && dbError.message ? dbError.message : dbError);
            failureCount++;
            results.push({
              success: false,
              evaluador: evaluatorNameResolved,
              correo: email,
              evaluando: evaluadoName,
              error: `DB exception: ${dbError?.message || String(dbError)}`,
            });
            continue;
          }
        }

        // Only mark as success when both email (if enabled) and DB persistence succeeded
        successCount++;
        results.push({
          success: true,
          evaluador: evaluatorNameResolved,
          correo: email,
          evaluando: evaluadoName,
          token: formToken,
        });
      } catch (error: any) {
        console.error('Error processing evaluator:', error);
        failureCount++;
        results.push({
          success: false,
          evaluador: evaluator.nombre_evaluador || 'Unknown',
          correo: evaluator.correo || evaluator.correo_evaluador || 'N/A',
          evaluando: evaluator.nombre_evaluado || 'N/A',
          error: error.message || 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      successCount,
      failureCount,
      results,
    });
  } catch (error: any) {
    console.error('Error in send-forms API:', error);
    return NextResponse.json(
      { error: error.message || 'Error sending forms' },
      { status: 500 }
    );
  }
}
