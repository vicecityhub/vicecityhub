import { useEffect, useRef, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';
import { usernameFromUser } from '../../lib/account';

interface SessionCallbacks {
  /** Called when the session has no user (signed out / expired). */
  onSignedOut: () => void;
  /** Called when the user opens the password-reset link from the e-mail. */
  onPasswordRecovery: () => void;
}

/** Supabase auth session + the display name derived from it. */
export function useAuthSession(callbacks: SessionCallbacks) {
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState<string>('');

  // The subscription is created once; the ref keeps it calling the latest callbacks.
  const latest = useRef(callbacks);
  latest.current = callbacks;

  useEffect(() => {
    supa.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) setUsername(usernameFromUser(session.user));
    });

    const { data: { subscription } } = supa.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setUsername(usernameFromUser(session.user));
      } else {
        setUsername('');
        latest.current.onSignedOut();
      }
      // When the user clicks the password reset link in the e-mail, Supabase fires this event and gives us a
      // session: open the reset form immediately.
      if (event === 'PASSWORD_RECOVERY') latest.current.onPasswordRecovery();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, username };
}
