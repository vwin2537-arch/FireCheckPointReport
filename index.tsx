import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

import ErrorBoundary from './components/ErrorBoundary';

const container = document.getElementById('root');

if (!container) {
  console.error("Failed to find the root element");
} else {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}