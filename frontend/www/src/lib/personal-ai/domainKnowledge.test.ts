import { describe, expect, it } from 'vitest';
import {
  buildLajukanDomainKnowledgePrompt,
  normalizeDomainKnowledgeItems,
} from './domainKnowledge';

describe('Lajukan domain knowledge', () => {
  it('prioritizes an exact alias phrase over generic token overlap', () => {
    const items = normalizeDomainKnowledgeItems([
      {
        id: 'generic',
        category: 'tool',
        name: 'Alat produksi',
        aliases: ['alat makanan'],
        description: 'Alat umum untuk produksi makanan.',
      },
      {
        id: 'vacuum',
        category: 'machine',
        name: 'Vacuum sealer',
        aliases: ['mesin vakum makanan'],
        description: 'Mesin untuk kemasan vakum.',
      },
    ]);

    const prompt = buildLajukanDomainKnowledgePrompt({
      query: 'Saya cari mesin vakum makanan untuk frozen food',
      media: [],
      locale: 'id',
      items,
      limit: 2,
    });

    expect(prompt.indexOf('Vacuum sealer')).toBeLessThan(
      prompt.indexOf('Alat produksi'),
    );
  });

  it('drops non-http source URLs from external datasets', () => {
    const [item] = normalizeDomainKnowledgeItems([
      {
        id: 'unsafe-source',
        name: 'Contoh',
        sourceUrl: 'javascript:alert(1)',
        imageUrl: 'data:text/html;base64,abc',
      },
    ]);

    expect(item?.sourceUrl).toBe('');
    expect(item?.imageUrl).toBe('');
  });
});
