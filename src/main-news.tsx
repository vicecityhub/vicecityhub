import React from 'react';
import ReactDOM from 'react-dom/client';
import Layout from './components/Layout';
import News from './pages/News';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Layout activePage="news">
      <News />
    </Layout>
  </React.StrictMode>
);
