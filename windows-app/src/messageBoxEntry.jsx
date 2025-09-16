import React from 'react';
import { createRoot } from 'react-dom/client';
import MessageBox from './MessageBox.jsx';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<MessageBox />);