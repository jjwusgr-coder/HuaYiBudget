import React, { useState } from 'react';
import { X, Plus, Layers, Edit3, Trash2 } from 'lucide-react';
import { THEMES } from '../constants';

export const StoreModal = ({ stores, onClose, onSelect, onAdd, onDelete, onUpdate, currentId }: any) => {
  const [mode, setMode] = useState('list');
  const [name, setName] = useState('');
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [editStore, setEditStore] = useState<any>(null);

  const handleEdit = (s: any) => { 
    setEditStore(s); 
    setName(s.name); 
    setThemeId(s.theme);
    if (s.customColor) setCustomColor(s.customColor);
    setMode('edit'); 
  };
  
  const saveEdit = () => { 
    onUpdate(editStore.id, name, themeId, customColor); 
    setMode('list'); 
    setEditStore(null); 
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">
            {mode === 'list' ? '切换店铺' : mode === 'edit' ? '编辑店铺' : '新建店铺'}
          </h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-5 overflow-y-auto">
          {mode === 'list' ? (
            <div className="space-y-3">
              <div 
                onClick={() => {onSelect('ALL'); onClose()}} 
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer ${currentId === 'ALL' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'}`}
              >
                <Layers size={20}/>
                <span className="font-bold">全部店铺</span>
              </div>
              <div className="h-px bg-gray-100 my-2"/>
              {stores.map((s: any) => (
                <div key={s.id} className={`flex items-center justify-between p-3 rounded-2xl border ${s.id === currentId ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}>
                   <div className="flex items-center gap-3 cursor-pointer" onClick={() => {onSelect(s.id); onClose()}}>
                     <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${THEMES.find(t=>t.id===s.theme)?.from}`} style={s.theme === 'custom' ? { background: s.customColor } : {}}/>
                     <span className="font-bold text-sm">{s.name}</span>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={()=>handleEdit(s)}><Edit3 size={16} className="text-gray-300 hover:text-blue-500"/></button>
                     {s.id !== currentId && <button onClick={()=>onDelete(s.id)}><Trash2 size={16} className="text-gray-300 hover:text-red-500"/></button>}
                   </div>
                </div>
              ))}
              <button 
                onClick={()=>{setMode('add'); setName(''); setThemeId(THEMES[0].id)}} 
                className="w-full py-3 mt-2 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Plus size={16}/> 新建
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <input 
                autoFocus 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                placeholder="店铺名称" 
                className="w-full border-b-2 border-gray-200 py-2 font-bold text-xl outline-none"
              />
              <div className="grid grid-cols-6 gap-3">
                {THEMES.map(t => (
                  <button 
                    key={t.id} 
                    onClick={()=>setThemeId(t.id)} 
                    className={`w-full aspect-square rounded-full bg-gradient-to-br ${t.from} ${t.to} ring-2 flex items-center justify-center overflow-hidden relative ${themeId === t.id ? 'ring-gray-400' : 'ring-transparent'}`}
                    style={t.id === 'custom' ? { background: customColor } : {}}
                  >
                    {t.id === 'custom' && (
                      <input 
                        type="color" 
                        value={customColor}
                        onChange={(e) => { setCustomColor(e.target.value); setThemeId('custom'); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={()=>setMode('list')} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500 text-xs">取消</button>
                <button 
                  onClick={()=>mode==='edit'?saveEdit():onAdd(name, themeId, customColor)} 
                  disabled={!name} 
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs disabled:opacity-50"
                >
                  {mode==='edit'?'保存':'创建'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
