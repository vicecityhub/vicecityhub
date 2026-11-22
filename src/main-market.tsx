import Layout from './components/Layout';
import Market from './pages/Market';
import { mountPage } from './lib/mountPage';
import './index.css';

mountPage(import.meta.url, () => (
  <Layout activePage="market">
    <Market />
  </Layout>
));
