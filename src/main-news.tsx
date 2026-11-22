import Layout from './components/Layout';
import News from './pages/News';
import { mountPage } from './lib/mountPage';
import './index.css';

mountPage(import.meta.url, () => (
  <Layout activePage="news">
    <News />
  </Layout>
));
