import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { paths } from './router';
import './styles.css';

// Land on the listing page when the app is opened without a hash.
if (!window.location.hash) {
  window.location.replace(`${window.location.pathname}${paths.list}`);
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
