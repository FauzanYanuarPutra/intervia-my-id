import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Input } from '../Input';
it('connects label, description, and error accessibly', () => {
  render(<Input label="Nama usaha" description="Nama yang dilihat pembeli" error="Nama wajib diisi" />);
  const input = screen.getByRole('textbox', { name: 'Nama usaha' });
  expect(input).toHaveAccessibleDescription(/Nama yang dilihat pembeli.*Nama wajib diisi/);
  expect(input).toHaveAttribute('aria-invalid','true');
});
