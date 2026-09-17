import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/forms/InviteMemberQuickForm.tsx', 'utf8');

describe('invite member UX V3', () => {
  it('uses visible role choices while preserving permission preview and payload', () => {
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('Peran anggota');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{role\}/);
    expect(source).toContain('roleSummaryMap');
    expect(source).toContain('username: selectedUser.username');
    expect(source).toContain('role,');
  });
});
