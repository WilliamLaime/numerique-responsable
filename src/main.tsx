import { createRoot } from 'react-dom/client';
import { ModalProvider } from './contexts/ModalContext';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <ModalProvider>
    <App />
  </ModalProvider>
);
