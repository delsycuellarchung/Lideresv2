export const LABEL_TO_VALUE: Record<string, number> = {
  'nunca': 1,
  'rara vez': 2,
  'rara vez.': 2,
  'rara-vez': 2,
  'casi nunca': 3,
  'casi-nunca': 3,
  'ocasionalmente': 4,
  'a veces': 4,
  'a-veces': 4,
  'frecuentemente': 4,
  'a menudo': 4,
  'siempre': 5,
  'casi siempre': 5,
};

export function mapLabelToNumeric(label?: string): number | null {
  if (!label || typeof label !== 'string') return null;
  const norm = label.trim().toLowerCase();
  if (norm in LABEL_TO_VALUE) return LABEL_TO_VALUE[norm];
  return null;
}

// Convert label to a percentage in range 0..100.
// If label matches a known 1..5 scale (see LABEL_TO_VALUE), map using (value/5)*100.
// Otherwise, if an instrucciones array is provided, map linearly across its length.
export function labelToPercent(label: string, instrucciones?: string[]): number | null {
  const numeric = mapLabelToNumeric(label);
  if (numeric !== null) {
    return (numeric / 5) * 100;
  }

  if (instrucciones && instrucciones.length > 0) {
    const idx = instrucciones.findIndex(ins => ins.trim().toLowerCase() === label.trim().toLowerCase());
    if (idx === -1) return null;
    const n = instrucciones.length;
    return n === 1 ? 100 : (idx / (n - 1)) * 100;
  }

  return null;
}
