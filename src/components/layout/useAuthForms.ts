import { useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { usernameFromLogin, validateLogin, validateNewPassword, validateRegistration } from '../../lib/account';
import type { ShowToast } from './useToasts';

export type AuthTab = 'login' | 'register' | 'reset';

/** What the three form hooks need from the auth modal. */
export interface AuthFormContext {
  showToast: ShowToast;
  setError: (message: string) => void;
  close: () => void;
}

export function useLoginForm({ showToast, setError, close }: AuthFormContext) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');

  const submit = async () => {
    setError('');
    const invalid = validateLogin(email, pass);
    if (invalid) {
      setError(invalid);
      return;
    }
    const { data, error } = await supa.auth.signInWithPassword({ email, password: pass });
    if (error) {
      setError(error.message);
      return;
    }
    const name = usernameFromLogin(data.user, email);
    showToast(`Welcome back, ${name}!`);
    close();
    setEmail('');
    setPass('');
    // Ensure player_profiles exists (for users registered before this was added)
    if (data.user) {
      await supa.from('player_profiles').upsert({
        user_id: data.user.id,
        display_name: name,
      }, { onConflict: 'user_id', ignoreDuplicates: true });
    }
  };

  const forgotPassword = async () => {
    setError('');
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?".');
      return;
    }
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://vicecityhub.github.io/vicecityhub/',
    });
    if (error) {
      setError(error.message);
      return;
    }
    showToast('Password reset link sent. Check your inbox.', 'success');
  };

  return { email, setEmail, pass, setPass, submit, forgotPassword };
}

export function useRegisterForm({ showToast, setError, close }: AuthFormContext) {
  const [user, setUser] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [passConfirm, setPassConfirm] = useState('');

  const submit = async () => {
    setError('');
    const invalid = validateRegistration(user, email, pass, passConfirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    const { data, error } = await supa.auth.signUp({
      email,
      password: pass,
      options: { data: { username: user } },
    });
    if (error) {
      setError(error.message);
      return;
    }
    // Create player profile immediately so the display name appears in posts
    if (data.user) {
      await supa.from('player_profiles').upsert({
        user_id: data.user.id,
        display_name: user,
        avatar_url: null,
      }, { onConflict: 'user_id' });
    }
    showToast('Account created! Welcome!');
    close();
    setUser('');
    setEmail('');
    setPass('');
    setPassConfirm('');
  };

  return { user, setUser, email, setEmail, pass, setPass, passConfirm, setPassConfirm, submit };
}

export function usePasswordResetForm({ showToast, setError, close, setTab }: AuthFormContext & { setTab: (tab: AuthTab) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  /** Empty the form (used when the recovery link reopens it). */
  const clear = () => {
    setPassword('');
    setConfirm('');
    setDone(false);
  };

  const submit = async () => {
    setError('');
    const invalid = validateNewPassword(password, confirm);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    const { error } = await supa.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    showToast('Password updated successfully. You are now signed in.', 'success');
    setTimeout(() => {
      close();
      setTab('login');
      clear();
    }, 2000);
  };

  return { password, setPassword, confirm, setConfirm, saving, done, clear, submit };
}
