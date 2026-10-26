import { useState } from 'react';
import { supa } from '../../../lib/SupabaseClient';
import { EMPTY_FORMS, buildDashRow } from '../../../lib/dashboardRows';
import type { SubmitForms, SubmitType } from '../../../lib/dashboardRows';
import type { ShowToast } from '../useToasts';

interface Args {
  session: any;
  username: string;
  showToast: ShowToast;
  /** Reload the user's posts after a successful publish. */
  refresh: () => void;
  /** Ask a signed-out visitor to log in. */
  openLogin: () => void;
  onPublished: () => void;
}

/** Submit-news / forum / streamer / podcast / domain forms. State lives here so typed text survives closing the dashboard. */
export function useSubmitForms({ session, username, showToast, refresh, openLogin, onPublished }: Args) {
  const [forms, setForms] = useState<SubmitForms>(EMPTY_FORMS);

  const updateForm = <K extends SubmitType>(key: K, patch: Partial<SubmitForms[K]>) =>
    setForms(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }) as SubmitForms);

  const submit = async (type: SubmitType) => {
    if (!session?.user) {
      openLogin();
      return;
    }

    const result = buildDashRow(type, forms, { id: session.user.id, name: username });
    if ('error' in result) {
      showToast(result.error, 'error');
      return;
    }
    // Like the original, the form is cleared as soon as the row is built, before the insert resolves.
    setForms(result.next);

    const { error } = await supa.from(result.table).insert(result.row);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Successfully published!');
      refresh();
      onPublished();
    }
  };

  return { forms, updateForm, submit };
}
