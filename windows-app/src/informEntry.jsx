import React from 'react';
import { createRoot } from 'react-dom/client';
import Inform from './Inform.jsx';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Inform />);