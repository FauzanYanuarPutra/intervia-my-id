import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Modal } from '../Modal';
it('moves focus in, closes on Escape, and restores trigger focus', async () => {
  const user=userEvent.setup();
  function Harness(){const [open,setOpen]=React.useState(false);return <><button onClick={()=>setOpen(true)}>Buka</button><Modal open={open} onClose={()=>setOpen(false)} title="Edit data"><button>Simpan</button></Modal></>}
  render(<Harness/>);
  const trigger=screen.getByRole('button',{name:'Buka'});
  await user.click(trigger);
  const dialog=screen.getByRole('dialog');
  await waitFor(()=>expect(dialog).toContainElement(document.activeElement as HTMLElement));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(()=>expect(trigger).toHaveFocus());
});
