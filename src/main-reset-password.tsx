import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { supa } from './lib/SupabaseClient';
import './index.css';

/*
  Supabase sends the user here after they click the reset link in their
  email. Supabase's client library automatically reads the recovery
  token out of the URL hash and turns it into a temporary authenticated
  session — at that point, supa.auth.updateUser({ password }) is enough
  to set the new password. No manual token parsing needed.
*/

function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Give Supabase's client a moment to parse the recovery token from the URL
    supa.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'ready' : 'invalid');
    });
  }, []);

  const submit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supa.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus('done');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] p-4">
      <div className="glass-card max-w-sm w-full p-8 border border-neonCyan/30">
        <div className="font-orbitron font-extrabold text-2xl text-neonCyan mb-1 tracking-widest uppercase">
          Reset Password
        </div>

        {status === 'checking' && (
          <p className="text-xs text-gray-500 mt-4">Verifying your reset link...</p>
        )}

        {status === 'invalid' && (
          <p className="text-xs text-gray-400 mt-4">
            This reset link is invalid or has expired. Go back to the hub and request a new one
            from the Sign In screen.
          </p>
        )}

        {status === 'ready' && (
          <div className="flex flex-col gap-4 mt-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                placeholder="••••••••"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-neonPink">{error}</p>}
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-neon font-orbitron text-xs uppercase disabled:opacity-40"
            >
              {submitting ? 'Saving...' : 'Set New Password'}
            </button>
          </div>
        )}

        {status === 'done' && (
          <div className="mt-4">
            <p className="text-xs text-gray-300 mb-4">Password updated. You can sign in now.</p>
            <a href="./index.html" className="btn-neon font-orbitron text-xs uppercase inline-block">
              Back to the Hub
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResetPasswordPage />
  </React.StrictMode>
);
