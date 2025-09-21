import React from 'react';
import noteData from './data/note/FwOTs4UxQS4.json';
import './index.css';

const Inform = () => {
  // 取前六個有 Keyword 和 url 的項目
  const topSix = noteData
    .filter(item => item.Keyword && item.url)
    .slice(0, 6);

  const handleClick = (url) => {
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        background: 'rgba(51, 51, 51, 0.75)',
        color: '#ffffff',
        borderRadius: '16px',
        width: '240px',
        padding: '12px 8px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        alignItems: 'center',
        justifyItems: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        margin: '20px auto',
        gap: '8px',
      }}
    >
      {topSix.map((item) => (
        <button
          key={item.Keyword}
          type="button"
          onClick={() => handleClick(item.url)}
          style={{
            cursor: 'pointer',
            width: '70px',
            height: '38px',
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            background: '#ffffff',
            color: '#333',
            WebkitAppRegion: 'no-drag',
            fontSize: 'clamp(12px, 3vw, 15px)', // 自動縮放字體
            fontWeight: 'bold',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          <span
            style={{
              width: '100%',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'normal', // 允許換行
              wordBreak: 'break-all',
            }}
          >
            {item.Keyword}
          </span>
        </button>
      ))}
      <div aria-hidden />
    </div>
  );
};

export default Inform;
