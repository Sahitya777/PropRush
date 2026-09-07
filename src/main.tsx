import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DynamicIntegrationProvider } from './context/DynamicIntegration.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DynamicIntegrationProvider>
      <App />
    </DynamicIntegrationProvider>
  </StrictMode>,
);
