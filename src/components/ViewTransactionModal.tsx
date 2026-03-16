import React, { useState, useMemo } from 'react';
import { Edit3, History, X, ArrowDownCircle, ArrowUpCircle, Store, ListFilter, Calendar, Paperclip, AlertCircle } from 'lucide-react';
import { formatMoney, formatDate, formatDateTime } from '../utils/helpers';

const DetailRow = ({ label, value, icon: Icon, color }: any) => (
  <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
    <div className="flex items-center gap-2">
      <Icon size={14} className={color}/>
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
    <span className="font-bold text-xs text-gray-700">{value}</span>
  </div>
);

const HistoryModal = ({ history, onClose }: any) => {
  const sorted = useMemo(() => Array.isArray(history) ? [...history].sort((a, b) => new Date(b.historyTimestamp).getTime() - new Date(a.historyTimestamp).getTime()) : [], [history]);
  return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2"><History size={20}/> 历史记录</h2>
                <button onClick={onClose}><X size={18}/></button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                {sorted.length === 0 ? <div className="text-center text-gray-400">无记录</div> : sorted.map((h, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative">
                    <span className="absolute top-2 right-4 text-[10px] text-gray-400">{formatDateTime(h.historyTimestamp)}</span>
                    <div className="text-xs font-bold mb-1">v{sorted.length - i}</div>
                    <div className={`text-base font-bold font-num ${h.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {h.type === 'income' ? '+' : '-'}{formatMoney(h.amount)}
                    </div>
                    <p className="text-sm mt-1">{h.category}</p>
                  </div>
              ))}</div>
          </div>
      </div>
  );
};

export const ViewTransactionModal = ({ transaction, onClose, onEdit, onDelete, onViewImage, storeName }: any) => {
  if (!transaction) return null;
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const theme = transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600';
  
  return (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl flex flex-col gap-3 max-h-[95vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">交易详情</h2>
                  <div className="flex gap-2">
                      <button onClick={onEdit} className="p-2 rounded-full transition-all bg-blue-50 text-blue-600 hover:bg-blue-100"><Edit3 size={16}/></button>
                      <button onClick={() => setShowHistoryModal(true)} className="p-2 rounded-full transition-all bg-yellow-50 text-yellow-600 hover:bg-yellow-100"><History size={16}/></button>
                      <button onClick={onClose} className="bg-gray-100 p-2 rounded-full"><X size={18} className="text-gray-500"/></button>
                  </div>
              </div>
              <div className="flex flex-col items-center py-2">
                  <div className={`text-3xl font-bold font-num ${theme}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatMoney(transaction.amount)}
                  </div>
                  {transaction.type === 'income' && transaction.percentage && transaction.percentage !== 100 && (
                      <div className="flex flex-col items-center mt-2 bg-blue-50 p-2 rounded-lg w-full">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">原始金额 (提成前)</span>
                          <div className="text-base font-bold font-num text-blue-600">{formatMoney(transaction.rawAmount)}</div>
                          <span className="text-[10px] text-blue-400 font-bold mt-1">提成比例: {transaction.percentage}%</span>
                      </div>
                  )}
              </div>
              <div className="space-y-2">
                  <DetailRow label="类型" value={transaction.type === 'income' ? '收入' : '支出'} icon={transaction.type === 'income' ? ArrowDownCircle : ArrowUpCircle} color={theme} />
                  <DetailRow label="店铺" value={storeName} icon={Store} color="text-gray-600" />
                  <DetailRow label="分类" value={transaction.category} icon={ListFilter} color="text-gray-600" />
                  <DetailRow label="日期" value={formatDate(transaction.date)} icon={Calendar} color="text-gray-600" />
                  {transaction.note && <DetailRow label="备注" value={transaction.note} icon={Paperclip} color="text-gray-600" />}
                  {transaction.isUnpaid && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                      <AlertCircle size={18} className="text-red-500"/>
                      <span className="text-xs font-bold text-red-600">未付款</span>
                    </div>
                  )}
              </div>
              {transaction.image && (
                <div className="pt-2" onClick={() => onViewImage(transaction.image)}>
                  <h3 className="text-[10px] font-bold text-gray-400 mb-1 uppercase ml-1">附件</h3>
                  <img src={transaction.image} className="w-full h-24 rounded-xl object-cover cursor-pointer" alt="receipt"/>
                </div>
              )}
              <button onClick={onDelete} className="mt-2 w-full py-3 rounded-2xl text-white font-bold text-xs bg-red-500 hover:bg-red-600">
                删除记录
              </button>
          </div>
          {showHistoryModal && <HistoryModal history={transaction.history} onClose={() => setShowHistoryModal(false)} />}
      </div>
  );
};
