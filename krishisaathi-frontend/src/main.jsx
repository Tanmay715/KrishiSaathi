import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './i18n';
import './styles/global.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
  onRegisteredSW(_sw_url, registration) {
    if (!registration) {
      return;
    }

    registration.update();
    window.setInterval(() => {
      registration.update();
    }, 60 * 1000);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
