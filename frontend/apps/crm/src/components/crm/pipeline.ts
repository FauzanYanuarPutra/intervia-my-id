export type PipelineColumnId = 'new' | 'interested' | 'negotiation' | 'locked' | 'completed';
export const PIPELINE_COLUMNS = [
  { id: 'new', label: 'Lead Baru', help: 'Baru masuk dari listing/chat' },
  { id: 'interested', label: 'Tertarik', help: 'Butuh follow-up agent' },
  { id: 'negotiation', label: 'Negosiasi', help: 'Harga dan scope dibahas' },
  { id: 'locked', label: 'Escrow', help: 'Deal mulai dikunci' },
  { id: 'completed', label: 'Selesai', help: 'Deal sukses' },
] as const;
export function groupPipelineStage(stage: string): PipelineColumnId {
  const value=stage.trim().toLowerCase();
  if (['won','completed','done','closed_won'].includes(value)) return 'completed';
  if (['locked','escrow','deal','contract'].includes(value)) return 'locked';
  if (['negotiation','negotiating','proposal'].includes(value)) return 'negotiation';
  if (['qualified','interested','contacted','follow_up'].includes(value)) return 'interested';
  return 'new';
}
