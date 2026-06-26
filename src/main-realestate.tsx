import React from 'react';
import ReactDOM from 'react-dom/client';
import Layout from './components/Layout';
import RealEstate from './pages/RealEstate';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Layout activePage="realestate">
      <RealEstate />
    </Layout>
  </React.StrictMode>
);
