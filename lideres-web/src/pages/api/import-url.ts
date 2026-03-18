import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabaseClient';
import { processImportRows } from '@/lib/importProcessor';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

type RawRow = Record<string, unknown>;

type ImportUrlBody = {
  url?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = (req.body || {}) as ImportUrlBody;
    const url = String(body.url || '').trim();
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to download file: ${response.status}` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null }) as RawRow[];

    if (String(process.env.DISABLE_DB || '').toLowerCase() === 'true') {
      try {
        const debugDir = './uploads-debug';
        try { fs.mkdirSync(debugDir, { recursive: true }); } catch { /* ignore */ }
        fs.writeFileSync(`${debugDir}/last-import.json`, JSON.stringify({ rows: jsonData, savedAt: new Date().toISOString() }));
      } catch (writeErr) {
        console.warn('API /api/import-url - could not persist last import', writeErr);
      }
      return res.status(200).json({ inserted: jsonData.length, preview: true, rows: jsonData });
    }

    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const insertados = await processImportRows(jsonData, supabase);
    return res.status(200).json({ inserted: insertados });
  } catch (err: unknown) {
    console.error('API /api/import-url error', err);
    return res.status(500).json({ error: 'Import url failed', details: String((err as Error)?.message || err) });
  }
}
