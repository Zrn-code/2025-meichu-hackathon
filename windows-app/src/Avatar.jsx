import React, { useState, useRef } from 'react';
import './index.css';

const Avatar = ({ onClick, src }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const anchorRef = useRef(null);

  const handleClick = (e) => {
    e.stopPropagation();
    if (typeof onClick === 'function') {
      onClick(e);
    } else {
      setOpenDialog(true);
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-full overflow-visible">
      {/* 外層透明正方形：可拖曳 (Electron 用 avatar-drag) */}
      <div
        className="w-20 h-20 rounded-md bg-transparent flex items-center justify-center avatar-drag"
        style={{ cursor: 'move' }}
        aria-hidden="true"
      >
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