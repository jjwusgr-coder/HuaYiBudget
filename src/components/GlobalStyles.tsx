import React from 'react';

export const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&display=swap');
    
    body { 
      font-family: 'Noto Sans SC', sans-serif; 
      -webkit-tap-highlight-color: transparent;
      overscroll-behavior: none; /* 防止页面整体回弹 */
      touch-action: pan-x pan-y; /* 禁止缩放 */
    }
    
    /* 优化后的数字字体 */
    .font-num { font-family: 'Oswald', sans-serif; letter-spacing: 0.5px; }
    
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    
    .safe-area-top { padding-top: max(env(safe-area-inset-top), 20px); } /* 确保最小顶部间距 */
    .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
    
    /* 动画 */
    @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
  `}</style>
);
