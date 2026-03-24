import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey);

async function findPersonaCodigoByName(name) {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/).slice(0, 3);
  const q = parts.join('%');
  try {
    const { data, error } = await client
      .from('personas')
      .select('codigo,nombre')
      .ilike('nombre', `%${q}%`)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data?.codigo || null;
  } catch (err) {
    return null;
  }
}

async function backfillBatch(limit = 500) {
  // fetch rows missing evaluado_codigo
  const { data: rows, error } = await client
    .from('form_responses')
    .select('id,token,evaluado_nombre')
    .is('evaluado_codigo', null)
    .limit(limit);
  if (error) throw error;
  if (!rows || rows.length === 0) return 0;

  let updated = 0;
  for (const r of rows) {
    const name = r.evaluado_nombre || '';
    const codigo = await findPersonaCodigoByName(name);
    if (codigo) {
      const { error: upErr } = await client
        .from('form_responses')
        .update({ evaluado_codigo: codigo })
        .eq('id', r.id);
      if (!upErr) {
        updated++;
      }
      // also try to update matching form_submissions by token when missing
      if (r.token) {
        await client
          .from('form_submissions')
          .update({ evaluado_codigo: codigo })
          .eq('token', r.token)
          .is('evaluado_codigo', null);
      }
    }
  }
  return updated;
}

async function main() {
  console.log('Starting backfill for evaluado_codigo...');
  let totalUpdated = 0;
  while (true) {
    const updated = await backfillBatch(500);
    if (!updated) break;
    totalUpdated += updated;
    console.log(`Batch updated: ${updated} (total ${totalUpdated})`);
    // small delay to be gentle on DB
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Backfill complete. Total rows updated: ${totalUpdated}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Backfill failed:', err instanceof Error ? err.message : String(err));
  process.exit(2);
});
