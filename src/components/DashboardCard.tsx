import React from 'react';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { formatMoney } from '../utils/helpers';

const StatBox = ({ label, val, color, icon: Icon }: any) => (
  <div className="flex-1 bg-black/10 rounded-2xl p-3 backdrop-blur-sm border border-white/5">
    <div className={`flex items-center gap-1 text-[10px] font-bold mb-0.5 uppercase ${color}`}>
      <Icon size={12}/> {label}
    </div>
    <div className="text-base font-bold font-num">{formatMoney(val)}</div>
  </div>
);

export const DashboardCard = ({ theme, stats, isAllMode, onSwipe, dots, filterType }: any) => {
  const [ts, setTs] = React.useState(0);
  
  const getFilterLabel = () => {
    const prefix = isAllMode ? '总' : '';
    switch(filterType) {
      case 'current_month': return `本月${prefix}结余`;
      case 'last_month': return `上月${prefix}结余`;
      case 'this_year': return `今年${prefix}结余`;
      case 'all': return isAllMode ? '总资产' : '总结余';
      case 'custom': return `自定义${prefix}结余`;
      default: return `本月${prefix}结余`;
    }
  };

  return (
    <div 
      className={`relative overflow-hidden rounded-[2rem] p-5 text-white shadow-xl bg-gradient-to-br ${theme.from} ${theme.to} mb-5`} 
      onTouchStart={e => setTs(e.touches[0].clientX)} 
      onTouchEnd={e => { 
        if (Math.abs(ts - e.changedTouches[0].clientX) > 50) {
          onSwipe(ts - e.changedTouches[0].clientX > 0 ? 'left' : 'right'); 
        }
      }}
    >
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
            {getFilterLabel()}
          </span>
          {dots && (
            <div className="flex gap-1">
              {Array.from({length: dots.total}).map((_, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${i === dots.current ? 'bg-white' : 'bg-white/30'}`}/>
              ))}
            </div>
          )}
        </div>
        <div className="text-3xl font-num font-medium mb-6 mt-2">
          {formatMoney(stats.balance).replace('€','')} <span className="text-lg font-sans">€</span>
        </div>
        <div className="flex gap-3">
          <StatBox label="收入" val={stats.income} color="text-emerald-300" icon={ArrowDownCircle} />
          <StatBox label="支出" val={stats.expense} color="text-red-300" icon={ArrowUpCircle} />
        </div>
      </div>
    </div>
  );
};
