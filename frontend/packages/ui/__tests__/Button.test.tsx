import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
describe('Button', () => {
  it('blocks duplicate activation and exposes pending text while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button loading loadingLabel="Menyimpan" onClick={onClick}>Simpan</Button>);
    const button = screen.getByRole('button', { name: 'Menyimpan' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy','true');
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
