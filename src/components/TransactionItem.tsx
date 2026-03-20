import React, { useState, useRef } from 'react';
import { Trash2, Wallet, CreditCard, Paperclip, Check } from 'lucide-react';
import { formatDate, formatMoney } from '../utils/helpers';

export const TransactionItem = ({ data, onDelete, onStatusChange, onViewImage, onEdit, onViewDetail, storeName, isBatchMode, isSelected, onToggleSelect }: any) => {
  const [swiped, setSwiped] = useState(false);
  const ts = useRef(0);
  const lp = useRef<NodeJS.Timeout | null>(null);
  const isLP = useRef(false);
  
  const touchStart = (e: React.TouchEvent) => { 
    if (isBatchMode) return;
    ts.current = e.touches[0].clientX; 
    isLP.current = false; 
    lp.current = setTimeout(() => { 
      isLP.current = true; 
      setSwiped(false); 
      onEdit(); 
    }, 500); 
  };
  
  const touchEnd = (e: React.TouchEvent) => { 
    if (isBatchMode) return;
    if (lp.current) clearTimeout(lp.current); 
    if(!isLP.current){ 
      const diff = ts.current - e.changedTouches[0].clientX; 
      if(Math.abs(diff)>50) setSwiped(diff>0); 
      else if(!swiped) onViewDetail(); 
    }
  };

  const hasImage = data.image || (data.images && data.images.length > 0);

  return (
    <div className="relative h-16 rounded-2xl overflow-hidden shadow-sm bg-white group flex items-center">
       {!isBatchMode && (
         <button onClick={onDelete} className="absolute inset-0 flex justify-end items-center pr-5 bg-red-500 text-white">
           <Trash2 size={18}/>
         </button>
       )}
       
       {isBatchMode && (
         <div className="pl-4 h-full flex items-center justify-center bg-white z-10 cursor-pointer" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
           <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
             {isSelected && <Check size={12} className="text-white"/>}
           </div>
         </div>
       )}

       <div 
         className={`absolute inset-0 bg-white px-4 border border-gray-50 flex items-center justify-between transition-transform duration-200 ${isBatchMode ? 'left-10' : ''}`} 
         style={{ transform: swiped && !isBatchMode ? 'translateX(-70px)' : 'none' }} 
         onTouchStart={touchStart} 
         onTouchMove={()=> lp.current && clearTimeout(lp.current)} 
         onTouchEnd={touchEnd} 
         onClick={()=>{
           if (isBatchMode) onToggleSelect();
           else if (!swiped) onViewDetail();
         }}
       >
         <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${data.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
             {data.type === 'income' ? <Wallet size={18}/> : <CreditCard size={18}/>}
           </div>
           <div className="flex flex-col justify-center min-w-0">
             <div className="flex items-center gap-2">
               <span className="font-bold text-sm text-gray-800 truncate">{data.category}</span>
               {storeName && <span className="text-[9px] px-1.5 bg-gray-100 text-gray-500 rounded font-bold flex-shrink-0">{storeName}</span>}
             </div>
             <div className="flex items-center gap-2 mt-0.5">
               {data.isUnpaid && <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-bold flex-shrink-0">未付</span>}
               {hasImage && <Paperclip size={10} className="text-blue-500 flex-shrink-0"/>}
               <span className="text-[9px] text-gray-400 font-bold font-num flex-shrink-0">{formatDate(data.date)}</span>
             </div>
           </div>
         </div>
         <div className="flex flex-col items-end flex-shrink-0 pl-2">
            <div className={`text-base font-bold font-num ${data.type === 'income' ? 'text-emerald-600' : 'text-gray-800'}`}>
              {data.type === 'income' ? '+' : '-'}{formatMoney(data.amount)}
            </div>
            {data.type === 'income' && data.percentage && data.percentage !== 100 ? (
                <div className="text-[9px] text-gray-400 font-bold mt-[-1px]">
                   原: {formatMoney(data.rawAmount)} @ {data.percentage}%
                </div>
            ) : data.isUnpaid && !isBatchMode ? (
                <button 
                  onClick={(e)=>{e.stopPropagation(); onStatusChange()}} 
                  className="text-[9px] font-bold text-red-500 border border-red-100 bg-red-50 px-1.5 py-0.5 rounded mt-0.5"
                >
                  标记已付
                </button>
            ) : null}
         </div>
       </div>
    </div>
  );
};
