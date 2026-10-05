import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './styles.css';
import './mobile-polish.css';

const root=document.getElementById('root');
createRoot(root).render(
  <ErrorBoundary>
    <App/>
  </ErrorBoundary>
);


if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
