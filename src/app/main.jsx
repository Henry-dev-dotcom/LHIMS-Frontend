import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../styles/index.css';
import { registerServiceWorker } from '../utils/registerServiceWorker';
import { applyTheme, getPreferredTheme } from '../utils/theme';

applyTheme(getPreferredTheme());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();
