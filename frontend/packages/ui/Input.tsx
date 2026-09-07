'use client';
import * as React from 'react';
import { cn } from '../utils/cn';
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; description?: string; error?: string }
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({className,type='text',label,description,error,id,...props},ref)=>{
  const generated=React.useId();
  const inputId=id ?? `input-${generated}`;
  const descriptionId=description?`${inputId}-description`:undefined;
  const errorId=error?`${inputId}-error`:undefined;
  const describedBy=[descriptionId,errorId,props['aria-describedby']].filter(Boolean).join(' ')||undefined;
  const field=<input ref={ref} id={inputId} type={type} aria-invalid={error?true:props['aria-invalid']} aria-describedby={describedBy} className={cn('min-h-[48px] w-full touch-manipulation rounded-[14px] border bg-[color:var(--color-surface)] px-3.5 py-3 text-sm text-[color:var(--color-text)] shadow-sm outline-none transition duration-[var(--motion-fast)] placeholder:text-[color:var(--color-text-soft)] focus:border-[color:var(--color-primary-border)] focus:ring-2 focus:ring-[color:var(--color-focus)]',error?'border-[color:var(--color-danger)]':'border-[color:var(--color-border)]',className)} {...props}/>;
  if(!label&&!description&&!error)return field;
  return <span className="block w-full">{label?<label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-[color:var(--color-text)]">{label}</label>:null}{field}{description?<span id={descriptionId} className="mt-1.5 block text-xs leading-5 text-[color:var(--color-text-soft)]">{description}</span>:null}{error?<span id={errorId} className="mt-1.5 block text-xs font-medium leading-5 text-[color:var(--color-danger)]">{error}</span>:null}</span>;
});
Input.displayName='Input';
