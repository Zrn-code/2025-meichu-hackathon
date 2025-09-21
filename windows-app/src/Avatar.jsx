import React, { useState, useRef } from 'react';
import './index.css';

const Avatar = ({ onClick, src }) => {
  // 點擊帽子
  const handleHatClick = (e) => {
    e.stopPropagation();
    if (window.electronAPI && window.electronAPI.showInform) {
      window.electronAPI.showInform();
    }
  };
  const [openDialog, setOpenDialog] = useState(false);
  const anchorRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    if (typeof onClick === 'function') {
      onClick(e);
    } else {
      window.electronAPI.showMessageBox("對 Avatar 說些...");
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-full overflow-visible">
      {/* 外層透明正方形：可拖曳 (Electron 用 avatar-drag) */}
      <div
        className="w-24 h-24 rounded-md bg-transparent flex items-center justify-center avatar-drag"
        style={{ cursor: 'move', position: 'relative' }}
        aria-hidden="true"
      >
        {/* 帽子按鈕 */}
        <button
          type="button"
          onClick={handleHatClick}
          style={{
            position: 'absolute',
            top: '5px',
            left: '4px',
            width: '60px',
            height: '34px',
            background: 'transparent',
            border: 0,
            padding: 0,
            zIndex: 2,
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          }}
        >
          <img
            src="/hat/cap.png"
            alt="Hat"
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
            draggable={false}
          />
        </button>
        {/* 內層：可點擊的圓形圖片（必須是 no-drag 才能接收 click） */}
        <button
          ref={anchorRef}
          type="button"
          onClick={handleClick}
          className="w-14 h-14 rounded-full overflow-hidden avatar-no-drag focus:outline-none"
          style={{ cursor: 'pointer', border: 0, padding: 0, background: 'transparent' }}
        >
          <img
            src={src}
            alt="Avatar"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </button>
      </div>
      {/* Dialog（會顯示在 image 下方） */}
    </div>
  );
};

export default Avatar;