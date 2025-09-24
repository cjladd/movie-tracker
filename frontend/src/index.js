import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Create the root and render the App component.  Using React 18's
// createRoot API ensures the application is future‑proof.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);