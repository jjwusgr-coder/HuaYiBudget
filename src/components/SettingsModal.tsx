import React from 'react';
import { formatMoney } from '../utils/helpers';

export const BarChart = ({ label, data, total, color }: any) => {
  const sorted = Object.entries(data).sort((a: any, b: any) => b[1]-a[1]).slice(0, 5);
  if (sorted.length === 0) return null;
  
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">{label}</div>
      <div className="space-y-2">
        {sorted.map(([k, v]: any) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-12 truncate text-right font-bold text-gray-600">{k}</span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${color}`} style={{ width: `${(v/total)*100}%` }}/>
            </div>
            <span className="w-16 text-right font-bold font-num text-gray-800">{formatMoney(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SettingsModal = ({ onClose, hasStore, onExport, onImport, onLogout }: any) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
    <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 space-y-4 animate-slide-up">
      <h2 className="font-bold text-sm text-gray-800">设置</h2>
      
      <div className="space-y-2 pb-4 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 mb-2">账号管理</h3>
        <button onClick={onLogout} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-red-50 text-red-500 hover:bg-red-100 transition-colors">退出 / 更换账号</button>
      </div>

      <div className="space-y-2 pb-4 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 mb-2">数据备份</h3>
        <button onClick={() => onExport('json')} disabled={!hasStore} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 disabled:opacity-50">导出 JSON</button>
        <button onClick={() => onExport('csv')} disabled={!hasStore} className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 disabled:opacity-50">导出 CSV</button>
      </div>
      <div className="space-y-2 pb-4 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-400 mb-2">数据恢复</h3>
        <label className="w-full flex justify-between px-4 py-3 rounded-xl font-bold text-xs bg-gray-50 cursor-pointer">
          导入备份 
          <input type="file" accept=".json,.csv" className="hidden" onChange={onImport} />
        </label>
      </div>
      <button onClick={onClose} className="w-full py-3 text-gray-400 font-bold text-xs">关闭</button>
    </div>
  </div>
);
