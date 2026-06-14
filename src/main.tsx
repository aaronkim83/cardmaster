import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'pretendard/dist/web/variable/pretendardvariable.css'; // 로컬 번들 (오프라인 PWA)
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
