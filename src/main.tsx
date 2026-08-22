import ErrorBoundary from './ErrorBoundary.tsx';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import MerchantPublicStore from './components/MerchantPublicStore';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/merchant/:merchantCode" element={<MerchantPublicStore />} />
        <Route path="/*" element={<ErrorBoundary><App /></ErrorBoundary>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
