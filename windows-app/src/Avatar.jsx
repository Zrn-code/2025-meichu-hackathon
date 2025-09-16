import './index.css';

const Avatar = () => {

  return (
    <div className="flex items-center justify-center w-full h-full overflow-hidden">
      {/* Avatar 圖片 */}
      <div className="w-16 h-16 rounded-full border-2 border-white/80 shadow-lg overflow-hidden bg-gray-100 avatar-drag cursor-move">
        <img 
          src="/avatar.jpg" 
          alt="Avatar" 
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    </div>
  );
};

export default Avatar;