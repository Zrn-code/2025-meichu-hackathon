
import React from 'react';
import './index.css';

const Inform = () => {
  const handleClick = (type) => {
    // 這裡可以自訂觸發事件，例如彈窗、console.log 或其他行為
    alert(`你點擊了「${type}」按鈕！`);
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
      {['劇情', '恐怖', '懸疑', '首映', '鬼魂'].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => handleClick(t)}
          style={{
            cursor: 'pointer',        // ✅ 游標變手指
            padding: '6px 10px',
            borderRadius: '8px',
            border: 'none',
            background: '#ffffff',
            color: '#333',
            WebkitAppRegion: 'no-drag',
          }}
        >
          {t}
        </button>
      ))}
      <div aria-hidden />
    </div>
  );
};

export default Inform;
