import React from 'react';
import './index.css';

const Avatar = ({ onClick }) => {
  const handleClick = (e) => {
    // 防止事件冒泡到外層 drag 區（雖然 avatar-no-drag 已處理）
    e.stopPropagation();
    if (typeof onClick === 'function') onClick(e);
    else alert('Avatar clicked');
  };

  return (
    <div className="flex items-center justify-center w-full h-full overflow-hidden">
      {/* 外層：透明正方形，可拖曳 (Electron: -webkit-app-region: drag) */}
      <div
        className="w-18 h-18 rounded-md bg-transparent flex items-center justify-center avatar-drag"
        style={{ cursor: 'move' }}
        aria-hidden="true"
      >
        {/* 內層：可點擊的圓形圖片，必須設成 no-drag 才能接收點擊 */}
        <button
          type="button"
          onClick={handleClick}
          className="w-14 h-14 rounded-full overflow-hidden avatar-no-drag focus:outline-none"
          style={{ cursor: 'pointer', border: '0', padding: 0, background: 'transparent' }}
        >
          <img
            src="/avatar.jpg"
            alt="Avatar"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </button>
      </div>
    </div>
  );
};

export default Avatar;