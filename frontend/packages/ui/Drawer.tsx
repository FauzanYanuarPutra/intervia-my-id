'use client';
import { Modal, type ModalProps } from './Modal';
import { cn } from '../utils/cn';
export type DrawerProps=Omit<ModalProps,'className'>&{side?:'left'|'right'|'bottom';className?:string};
export function Drawer({side='right',className,...props}:DrawerProps){const position=side==='left'?'sm:mr-auto sm:ml-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none':side==='right'?'sm:ml-auto sm:mr-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none':'sm:mb-0 sm:mt-auto sm:max-w-2xl sm:rounded-t-[28px] sm:rounded-b-none';return <Modal {...props} className={cn(position,className)}/>}
