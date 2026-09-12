import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';
import { installDemoApi } from './demo-api';

import './index.css';

if (import.meta.env.VITE_DEMO_MODE === 'true') {
  installDemoApi();
  setBaseUrl(null);
} else {
  setBaseUrl(import.meta.env.VITE_API_URL || null);
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
