import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'uploads-debug', 'formulario.json');

function ensureDir() {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    ensureDir();
    if (req.method === 'GET') {
      if (!fs.existsSync(FILE_PATH)) return res.status(200).json({ afirmaciones: [], competencias: [], estilos: [], instrucciones: [] });
      const raw = fs.readFileSync(FILE_PATH, 'utf8');
      const data = JSON.parse(raw || '{}');
      return res.status(200).json({ afirmaciones: data.afirmaciones || [], competencias: data.competencias || [], estilos: data.estilos || [], instrucciones: data.instrucciones || [] });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const toSave = {
        afirmaciones: Array.isArray(body.afirmaciones) ? body.afirmaciones : [],
        competencias: Array.isArray(body.competencias) ? body.competencias : [],
        estilos: Array.isArray(body.estilos) ? body.estilos : [],
        instrucciones: Array.isArray(body.instrucciones) ? body.instrucciones : [],
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(FILE_PATH, JSON.stringify(toSave, null, 2), 'utf8');
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('/api/formulario error', err);
    return res.status(500).json({ error: 'Could not read/write formulario' });
  }
}
