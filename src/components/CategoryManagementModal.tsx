import React, { useState, useMemo } from 'react';
import { X, Check, ArrowUp, ArrowDown, Pencil, Trash2, Percent } from 'lucide-react';

export const CategoryManagementModal = ({ onClose, categories, onUpdateCategories, storeId, showToast }: any) => {
  const [type, setType] = useState('expense');
  const [newCatName, setNewCatName] = useState('');
  const [newCatRate, setNewCatRate] = useState(100);
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatRate, setEditCatRate] = useState(100);

  const getCats = (t: string) => { 
    const raw = t === 'income' ? (categories?.income || []) : (categories?.expense || []); 
    return raw.map((c: any) => (typeof c === 'string' ? { name: c, rate: 100 } : c)); 
  };
  
  const currentCats = useMemo(() => getCats(type), [type, categories]);

  const handleAddCategory = () => {
      if(!newCatName) return;
      const newEntry = { name: newCatName, rate: parseFloat(newCatRate.toString()) || 100 };
      onUpdateCategories(storeId, { 
        income: type==='income'?[...getCats('income'), newEntry]:getCats('income'), 
        expense: type==='expense'?[...getCats('expense'), newEntry]:getCats('expense') 
      });
      setNewCatName(''); setNewCatRate(100); 
  };

  const handleDeleteCategory = (catName: string) => {
      const currentList = currentCats.filter((c: any) => c.name !== catName);
      onUpdateCategories(storeId, { 
          income: type==='income' ? currentList : getCats('income'), 
          expense: type==='expense' ? currentList : getCats('expense') 
      });
  };

  const handleMoveCategory = (index: number, direction: number) => {
      const currentList = [...currentCats];
      if (direction === -1 && index === 0) return;
      if (direction === 1 && index === currentList.length - 1) return;
      const itemToMove = currentList[index];
      currentList.splice(index, 1);
      currentList.splice(index + direction, 0, itemToMove);
      onUpdateCategories(storeId, { 
          income: type==='income' ? currentList : getCats('income'), 
          expense: type==='expense' ? currentList : getCats('expense') 
      });
  };

  const startEditCategory = (index: number, cat: any) => {
      setEditingCatIndex(index);
      setEditCatName(cat.name);
      setEditCatRate(cat.rate || 100);
  };

  const saveEditedCategory = (index: number) => {
      if(!editCatName) return;
      const currentList = [...currentCats];
      currentList[index] = { name: editCatName, rate: parseFloat(editCatRate.toString()) || 100 };
      onUpdateCategories(storeId, { 
          income: type==='income' ? currentList : getCats('income'), 
          expense: type==='expense' ? currentList : getCats('expense') 
      });
      setEditingCatIndex(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh]">
        <div className="flex justify-between items-center border-b pb-3 border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">分类管理</h2>
          <button onClick={onClose} className="bg-gray-100 p-2 rounded-full"><X size={18} className="text-gray-500"/></button>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button onClick={() => setType('expense')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${type === 'expense' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>支出</button>
          <button onClick={() => setType('income')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${type === 'income' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>收入</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px]">
          {currentCats.map((c: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-xl border border-gray-100">
              {editingCatIndex === idx ? (
                <div className="flex items-center gap-2 flex-1">
                  <input value={editCatName} onChange={e=>setEditCatName(e.target.value)} className="flex-1 text-xs font-bold bg-white border rounded px-1 py-1 outline-none"/>
                  {type === 'income' && <input type="number" value={editCatRate} onChange={e=>setEditCatRate(Number(e.target.value))} className="w-12 text-xs font-bold bg-white border rounded px-1 py-1 outline-none"/>}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-700">{c.name}</span>
                  {type === 'income' && c.rate !== 100 && <span className="text-xs font-bold text-blue-500 bg-blue-50 px-1 rounded">{c.rate}%</span>}
                </div>
              )}
              
              <div className="flex items-center gap-1 ml-2">
                {editingCatIndex === idx ? (
                  <>
                    <button onClick={() => saveEditedCategory(idx)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check size={14}/></button>
                    <button onClick={() => setEditingCatIndex(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={14}/></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleMoveCategory(idx, -1)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={() => handleMoveCategory(idx, 1)} disabled={idx === currentCats.length - 1} className="p-1 text-gray-400 hover:text-blue-500 disabled:opacity-30"><ArrowDown size={14}/></button>
                    <button onClick={() => startEditCategory(idx, c)} className="p-1 text-blue-400 hover:text-blue-600"><Pencil size={12}/></button>
                    <div className="w-px h-3 bg-gray-200 mx-1"></div>
                    <button onClick={() => handleDeleteCategory(c.name)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <input placeholder="新分类名称" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="flex-1 bg-white border rounded-lg px-2 py-1.5 text-xs outline-none font-bold"/>
          {type === 'income' && (
            <div className="relative w-24">
              <input placeholder="比例%" type="number" value={newCatRate} onChange={e=>setNewCatRate(Number(e.target.value))} className="w-full bg-white border rounded-lg pl-2 pr-6 py-1.5 text-xs outline-none font-bold"/>
              <Percent size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"/>
            </div>
          )}
          <button onClick={handleAddCategory} className="bg-black text-white px-3 rounded-lg text-xs font-bold">添加</button>
        </div>
      </div>
    </div>
  );
};
