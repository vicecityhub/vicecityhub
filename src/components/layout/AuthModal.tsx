import React from 'react';
import { X } from 'lucide-react';
import type { AuthModalController } from './useAuthModal';

const FIELD_INPUT = 'w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all';
const RESET_INPUT = 'bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white';
const LABEL = 'text-[10px] text-gray-500 uppercase tracking-widest font-bold';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function ResetPasswordForm({ reset }: { reset: AuthModalController['reset'] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[10px] text-neonCyan uppercase tracking-widest font-bold mb-2">
        🔐 Set Your New Password
      </div>
      {reset.done ? (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">✓</div>
          <p className="text-neonCyan font-bold font-orbitron text-sm">Password updated!</p>
          <p className="text-xs text-gray-500 mt-1">Redirecting...</p>
        </div>
      ) : (
        <>
          <Field label="New Password">
            <input
              type="password"
              value={reset.password}
              onChange={(e) => reset.setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className={RESET_INPUT}
            />
          </Field>
          <Field label="Confirm Password">
            <input
              type="password"
              value={reset.confirm}
              onChange={(e) => reset.setConfirm(e.target.value)}
              placeholder="Repeat password"
              className={RESET_INPUT}
              onKeyDown={(e) => e.key === 'Enter' && reset.submit()}
            />
          </Field>
          <button
            onClick={reset.submit}
            disabled={reset.saving}
            className="btn-neon font-orbitron text-xs mt-2 disabled:opacity-50"
          >
            {reset.saving ? 'Saving...' : 'Set New Password'}
          </button>
        </>
      )}
    </div>
  );
}

function LoginForm({ login }: { login: AuthModalController['login'] }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Email Address">
        <input
          type="email"
          value={login.email}
          onChange={e => login.setEmail(e.target.value)}
          className={FIELD_INPUT}
          placeholder="you@email.com"
        />
      </Field>
      <Field label="Secret Password">
        <input
          type="password"
          value={login.pass}
          onChange={e => login.setPass(e.target.value)}
          className={FIELD_INPUT}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={login.forgotPassword}
          className="self-end text-[10px] text-gray-500 hover:text-neonCyan underline transition-colors"
        >
          Forgot password?
        </button>
      </Field>
      <button onClick={login.submit} className="btn-neon font-orbitron text-xs mt-4">Sign In</button>
    </div>
  );
}

function RegisterForm({ register }: { register: AuthModalController['register'] }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Alias Username">
        <input
          type="text"
          value={register.user}
          onChange={e => register.setUser(e.target.value)}
          className={FIELD_INPUT}
          placeholder="Lucia69"
        />
      </Field>
      <Field label="Email Address">
        <input
          type="email"
          value={register.email}
          onChange={e => register.setEmail(e.target.value)}
          className={FIELD_INPUT}
          placeholder="lucia@gta6.com"
        />
      </Field>
      <Field label="Secure Password">
        <input
          type="password"
          value={register.pass}
          onChange={e => register.setPass(e.target.value)}
          className={FIELD_INPUT}
          placeholder="••••••••"
        />
      </Field>
      <Field label="Confirm Password">
        <input
          type="password"
          value={register.passConfirm}
          onChange={e => register.setPassConfirm(e.target.value)}
          className={FIELD_INPUT}
          placeholder="••••••••"
        />
      </Field>
      <button onClick={register.submit} className="btn-neon font-orbitron text-xs mt-4">Create Account</button>
    </div>
  );
}

const tabClass = (active: boolean) => `pb-3 pr-6 ${active ? 'text-neonCyan border-b-2 border-neonCyan' : 'text-gray-500'}`;

/** Sign in / register / reset-password modal. */
export function AuthModal({ auth }: { auth: AuthModalController }) {
  const isReset = auth.tab === 'reset';
  return (
    <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`glass-card w-full relative border border-neonPink shadow-[0_0_40px_rgba(255,0,255,0.2)] ${isReset ? 'max-w-sm p-6' : 'max-w-md p-8'}`}>
        <button onClick={auth.close} className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors">
          <X size={20} />
        </button>
        <div className={`font-orbitron font-extrabold text-3xl text-neonPink neon-text-pink mb-1 tracking-widest uppercase ${isReset ? 'hidden' : ''}`}>MEMBER</div>
        <div className={`text-[10px] text-gray-500 tracking-widest uppercase font-bold ${isReset ? 'hidden' : 'mb-6'}`}>Access • Post • Share Intel</div>

        {/* Modal Tabs — hide tabs during password reset flow */}
        {!isReset && (
          <div className="flex border-b border-white/5 mb-6 text-xs uppercase tracking-widest font-bold">
            <button onClick={() => auth.setTab('login')} className={tabClass(auth.tab === 'login')}>Sign In</button>
            <button onClick={() => auth.setTab('register')} className={tabClass(auth.tab === 'register')}>Register</button>
          </div>
        )}

        {auth.error && (
          <div className="mb-4 text-xs font-bold text-neonPink border border-neonPink/20 bg-neonPink/5 p-3 rounded tracking-wide uppercase">
            {auth.error}
          </div>
        )}

        {/* Reset Password Form — shown when user arrives via email link */}
        {isReset && <ResetPasswordForm reset={auth.reset} />}

        <div className={isReset ? 'hidden' : ''}>
          {auth.tab === 'login' ? <LoginForm login={auth.login} /> : <RegisterForm register={auth.register} />}
        </div>
      </div>
    </div>
  );
}
