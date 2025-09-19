import { createRoot } from 'react-dom/client';
import Avatar from './Avatar.jsx';

const container = document.getElementById('root');
const root = createRoot(container);
// 從 window.avatarSrc 取得圖片路徑
const avatarSrc = window.avatarSrc
root.render(<Avatar src={avatarSrc} />);