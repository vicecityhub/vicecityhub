import React from 'react';
import ReactDOM from 'react-dom/client';
import Layout from './components/Layout';
import Market from './pages/Market';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Layout activePage="market">
      <Market />
    </Layout>
  </React.StrictMode>
);
