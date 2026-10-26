import { useState } from 'react';
import { useLoginForm, usePasswordResetForm, useRegisterForm } from './useAuthForms';
import type { AuthTab } from './useAuthForms';
import type { ShowToast } from './useToasts';

export type { AuthTab } from './useAuthForms';

/**
 * Sign in / register / reset-password modal state. It lives in Layout (not inside the modal) so what the user
 * typed survives closing and reopening the modal.
 */
export function useAuthModal(showToast: ShowToast) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>('login');
  const [error, setError] = useState('');

  const close = () => setOpen(false);
  const ctx = { showToast, setError, close };

  const login = useLoginForm(ctx);
  const register = useRegisterForm(ctx);
  const reset = usePasswordResetForm({ ...ctx, setTab });

  /** Open the modal, optionally switching tab (no tab keeps the current one). */
  const openModal = (nextTab?: AuthTab) => {
    setOpen(true);
    if (nextTab) setTab(nextTab);
  };

  /** The e-mail recovery link was clicked: show an empty "set new password" form. */
  const openPasswordReset = () => {
    setTab('reset');
    setOpen(true);
    reset.clear();
  };

  return { open, tab, error, setTab, close, openModal, openPasswordReset, login, register, reset };
}

export type AuthModalController = ReturnType<typeof useAuthModal>;
