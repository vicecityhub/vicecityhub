import Layout from './components/Layout';
import RealEstate from './pages/RealEstate';
import { mountPage } from './lib/mountPage';
import './index.css';

mountPage(import.meta.url, () => (
  <Layout activePage="realestate">
    <RealEstate />
  </Layout>
));
