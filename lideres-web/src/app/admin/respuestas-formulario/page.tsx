'use client';

import React from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function RespuestasFormularioPage() {
  const [responses, setResponses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'pending' | 'completed'>('all');

  React.useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const disableDb = String(process.env.NEXT_PUBLIC_DISABLE_DB || '').toLowerCase() === 'true';

      if (!supabase || disableDb) {
        setResponses([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('form_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error loading responses:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadResponses();
  }, [filter]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B' },
      completed: { bg: 'rgba(34, 197, 94, 0.1)', text: '#16A34A' },
      expired: { bg: 'rgba(255, 107, 107, 0.1)', text: '#FF6B6B' },
    };

    const color = colors[status] || colors.pending;
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      completed: 'Completado',
      expired: 'Expirado',
    };

    return (
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          background: color.bg,
          color: color.text,
        }}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ margin: '-85px 0 24px 0', fontSize: 32, fontWeight: 800 }}>RESPUESTAS DEL FORMULARIO</h2>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '10px 20px',
                background: filter === f ? '#4F46E5' : 'rgba(15,23,42,0.05)',
                color: filter === f ? 'white' : '#0F172A',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'rgba(15,23,42,0.6)' }}>Cargando respuestas...</div>
      ) : responses.length === 0 ? (
        <div style={{ padding: 32, background: 'rgba(15,23,42,0.02)', borderRadius: 8, textAlign: 'center', color: 'rgba(15,23,42,0.6)' }}>
          No hay respuestas disponibles
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.02)', borderBottom: '2px solid rgba(15,23,42,0.1)' }}>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Evaluador</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Correo destino</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Evaluado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Estado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Enviado</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Fecha Creación</th>
                <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>Completado</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((response, index) => (
                <tr key={response.id} style={{ borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
                  <td style={{ padding: 16, color: '#0F172A', fontWeight: 500 }}>{response.evaluator_name}</td>
                  <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>{response.evaluator_email || '-'}</span>
                    {((String(response.id || '').startsWith('test-')) || String(response.evaluator_email || '').includes('@ethereal.email')) && (
                      <span style={{ marginLeft: 6, padding: '4px 8px', background: 'rgba(99,102,241,0.08)', color: '#4f46e5', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Prueba</span>
                    )}
                  </td>
                  <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>{response.responses?.evaluado_nombre || response.responses?.evaluado || response.evaluado_name || '-'}</td>
                  <td style={{ padding: 16 }}>{getStatusBadge(response.status)}</td>
                  <td style={{ padding: 16 }}>
                    {response.status === 'completed' ? (
                      <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.08)', color: '#16A34A', fontWeight: 700 }}>Sí</span>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(15,23,42,0.04)', color: '#374151', fontWeight: 700 }}>No</span>
                    )}
                  </td>
                  <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>
                    {formatDate(response.created_at)}
                  </td>
                  <td style={{ padding: 16, color: 'rgba(15,23,42,0.65)', fontSize: 13 }}>
                    {response.completed_at ? formatDate(response.completed_at) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
