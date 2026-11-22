import RPHubApp from './pages/RPHub'
import { mountPage } from './lib/mountPage'
import './index.css'

mountPage(import.meta.url, () => (
  <RPHubApp />
));
