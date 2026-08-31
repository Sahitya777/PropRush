import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ClerkIntegrationProvider } from './context/ClerkIntegration.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkIntegrationProvider>
      <App />
    </ClerkIntegrationProvider>
  </StrictMode>,
);
