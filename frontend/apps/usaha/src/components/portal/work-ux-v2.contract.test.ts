import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const workQueue = source('src/components/portal/WorkQueue.tsx');
const flowGuide = source('src/components/portal/UsahaFlowGuide.tsx');

describe('Usaha workspace UX v2', () => {
  it('keeps work creation free from long native dropdowns', () => {
    expect(workQueue).toContain('ChoiceChips');
    expect(workQueue).toContain('SearchPicker');
    expect(workQueue).not.toContain('<select');
  });

  it('uses a modal picker for assignees and keeps role context visible', () => {
    expect(workQueue).toContain('mode="modal"');
    expect(workQueue).toContain('organizationRoleLabel(member.role)');
    expect(workQueue).toContain('Penanggung jawab');
  });

  it('keeps the flow guide available without forcing it open on every workspace', () => {
    expect(flowGuide).toContain('<details');
    expect(flowGuide).toContain('expandedByDefault = currentSection === \'home\'');
    expect(flowGuide).toContain('group-open:hidden');
  });
});
