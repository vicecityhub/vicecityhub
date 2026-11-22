import Layout from './components/Layout';
import Document from './pages/Document';
import { mountPage } from './lib/mountPage';
import './index.css';

mountPage(import.meta.url, () => (
  <Layout activePage="document">
    <Document />
  </Layout>
));
