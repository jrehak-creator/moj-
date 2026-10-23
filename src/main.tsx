import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Discover from './Discover';
import './styles.css';
import './access.css';
import './site-lock.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{window.location.pathname === '/discover' ? <Discover /> : <App />}</React.StrictMode>);
