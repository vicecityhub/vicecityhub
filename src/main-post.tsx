import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import PostDetail from './pages/PostDetail';
import { supa } from './lib/SupabaseClient';
import { mountPage } from './lib/mountPage';
import './index.css';

function Main() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supa.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supa.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleOpenModal = (id: string, tab?: 'login' | 'register') => {
    window.dispatchEvent(new CustomEvent('vch-open-modal', { detail: { id, tab } }));
  };

  return (
    <Layout activePage="community">
      <PostDetail onOpenModal={handleOpenModal} session={session} />
    </Layout>
  );
}

mountPage(import.meta.url, () => (
  <Main />
));
