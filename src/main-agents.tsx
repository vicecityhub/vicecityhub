import React from 'react';
import ReactDOM from 'react-dom/client';
import Layout from './components/Layout';
import Agents from './pages/Agents';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Layout activePage="agents">
      <Agents />
    </Layout>
  </React.StrictMode>
);
