
import React from 'react';
import './index.css';

const Inform = () => {
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
      <div>劇情</div>
      <div>恐怖</div>
      <div>懸疑</div>
      <div>首映</div>
      <div>鬼魂</div>
      <div></div>
    </div>
  );
};

export default Inform;
