import { describe, expect, it } from 'vitest';
import { groupPipelineStage, PIPELINE_COLUMNS } from '../pipeline';
describe('CRM pipeline', () => {
  it('maps API stages into stable operator columns', () => {
    expect(groupPipelineStage('lead')).toBe('new');
    expect(groupPipelineStage('qualified')).toBe('interested');
    expect(groupPipelineStage('negotiation')).toBe('negotiation');
    expect(groupPipelineStage('won')).toBe('completed');
  });
  it('keeps the operator column order stable', () => {
    expect(PIPELINE_COLUMNS.map(column => column.id)).toEqual(['new','interested','negotiation','locked','completed']);
  });
});
