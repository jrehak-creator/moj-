import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import IpadPilot from './IpadPilot';
import Discover from './Discover';
import AccessGate from './AccessGate';
import './styles.css';
import './ipad.css';
import './access.css';
import './site-lock.css';
import './shortcut.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AccessGate>{window.location.pathname === '/discover' ? <Discover /> : window.location.pathname === '/library' ? <App /> : <IpadPilot />}</AccessGate></React.StrictMode>);
