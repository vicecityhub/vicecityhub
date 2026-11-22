import Layout from './components/Layout';
import Agents from './pages/Agents';
import { mountPage } from './lib/mountPage';
import './index.css';

mountPage(import.meta.url, () => (
  <Layout activePage="agents">
    <Agents />
  </Layout>
));
