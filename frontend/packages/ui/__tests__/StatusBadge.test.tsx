import * as React from 'react'; import { render, screen } from '@testing-library/react'; import { it, expect } from 'vitest'; import { StatusBadge } from '../StatusBadge';
it('exposes status meaning as text rather than color alone',()=>{render(<StatusBadge tone="warning">Perlu tindakan</StatusBadge>);expect(screen.getByText('Perlu tindakan')).toBeVisible()});
