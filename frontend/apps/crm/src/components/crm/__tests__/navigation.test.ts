import { describe, expect, it } from 'vitest';
import { CRM_NAV_ITEMS, PRIMARY_CRM_PAGES, SECONDARY_CRM_PAGES } from '../navigation';
describe('CRM navigation contract', () => {
  it('keeps operator work primary and admin/analytics secondary', () => {
    expect(PRIMARY_CRM_PAGES).toEqual(['dashboard','pipeline','users','listings','transactions','chat','disputes']);
    expect(SECONDARY_CRM_PAGES).toEqual(['analytics','settings']);
    expect(CRM_NAV_ITEMS.map(item => item.id)).toEqual([...PRIMARY_CRM_PAGES, ...SECONDARY_CRM_PAGES]);
  });
  it('uses task-oriented Indonesian labels for primary work', () => {
    expect(CRM_NAV_ITEMS.find(item => item.id === 'dashboard')?.label).toBe('Hari ini');
    expect(CRM_NAV_ITEMS.find(item => item.id === 'chat')?.label).toBe('Percakapan');
    expect(CRM_NAV_ITEMS.find(item => item.id === 'disputes')?.label).toBe('Support & Risiko');
  });
});
