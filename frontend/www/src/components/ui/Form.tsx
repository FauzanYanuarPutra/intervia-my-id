import * as React from 'react';
import { cn } from '@/lib/utils';

export const AppForm = React.forwardRef<
  HTMLFormElement,
  React.ComponentPropsWithoutRef<'form'>
>(({ className, ...props }, ref) => (
  <form ref={ref} className={cn('ui-form', className)} {...props} />
));
AppForm.displayName = 'AppForm';

export function AppFormField({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'label'>) {
  return <label className={cn('ui-form-field', className)} {...props} />;
}

export function AppFormLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return <span className={cn('ui-form-label', className)} {...props} />;
}

export const AppInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<'input'>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('ui-control ui-data-control ui-form-control', className)} {...props} />
));
AppInput.displayName = 'AppInput';

export const AppTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<'textarea'>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('ui-control ui-data-control ui-form-control ui-form-textarea', className)} {...props} />
));
AppTextarea.displayName = 'AppTextarea';

export const AppSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentPropsWithoutRef<'select'>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn('ui-control ui-data-control ui-form-control', className)} {...props} />
));
AppSelect.displayName = 'AppSelect';

export function AppFormHint({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('ui-form-hint', className)} {...props} />;
}

export const AppSubmitButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, type = 'submit', ...props }, ref) => (
  <button ref={ref} type={type} className={cn('ui-button-primary ui-form-submit', className)} {...props} />
));
AppSubmitButton.displayName = 'AppSubmitButton';
