import React from 'react';
import ReactDOM from 'react-dom/client';
import Layout from './components/Layout';
import Document from './pages/Document';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Layout activePage="document">
      <Document />
    </Layout>
  </React.StrictMode>
);
