import React, { useState, useEffect, useMemo } from 'react';
import { X, Mic, Check, Image as ImageIcon, Sparkles, RefreshCw, ArrowUp, ArrowDown, Pencil, Trash2, Percent, Calendar } from 'lucide-react';
import { getGeminiApiKey, fetchWithBackoff, getGeminiClient } from '../lib/gemini';
import { Type } from '@google/genai';
import { compressImage, parseVoiceInput } from '../utils/helpers';

export const AddTransactionModal = ({ onClose, onSave, stores, isAllMode, defaultStoreId, categories, theme, editingItem, onUpdateCategories, currentStoreId, showToast }: any) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [storeId, setStoreId] = useState(defaultStoreId);
  const [note, setNote] = useState('');
  const [isUnpaid, setIsUnpaid] = useState(false);
  const [percentage, setPercentage] = useState(100);
  const [images, setImages] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isManageMode, setIsManageMode] = useState(false);
  
  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // State for adding new category
  const [newCatName, setNewCatName] = useState('');
  const [newCatRate, setNewCatRate] = useState(100);
  
  // State for editing existing category
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatRate, setEditCatRate] = useState(100);

  const getCats = (t: string) => { 
    const raw = t === 'income' ? (categories?.income || []) : (categories?.expense || []); 
    return raw.map((c: any) => (typeof c === 'string' ? { name: c, rate: 100 } : c)); 
  };
  
  const currentCats = useMemo(() => getCats(type), [type, categories]);

  useEffect(() => {
    if (editingItem) {
        setAmount(editingItem.rawAmount || editingItem.amount); 
        setType(editingItem.type); 
        setCategory(editingItem.category); 
        setNote(editingItem.note || '');
        if(editingItem.date) setDate(editingItem.date.split('T')[0]);
        setStoreId(editingItem.storeId); 
        if(editingItem.isUnpaid) setIsUnpaid(true); 
        if(editingItem.images && editingItem.images.length > 0) setImages(editingItem.images); 
        else if(editingItem.image) setImages([editingItem.image]);
        if(editingItem.percentage) setPercentage(editingItem.percentage);
    }
  }, [editingItem]);

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) return showToast('不支持语音', 'error');
    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.onresult = (e: any) => {
       const res = parseVoiceInput(e.results[0][0].transcript);
       if(res.amount) setAmount(res.amount);
       if(res.category) { 
         const match = currentCats.find((c: any) => c.name === res.category); 
         if(match) { 
           setCategory(match.name); 
           if(type === 'income') setPercentage(match.rate || 100); 
         } 
       }
       if(res.type) setType(res.type);
       setNote(res.note);
    };
    recognition.start();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => { 
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Limit to max 3 images to avoid payload too large
    const newImages = await Promise.all(files.slice(0, 3).map(f => compressImage(f)));
    setImages(prev => [...prev, ...newImages].slice(0, 3));
  };
  
  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleAIAnalyze = async (imgData: string) => {
      if (!imgData) return showToast('请先上传账单截图', 'error');
      setIsAnalyzing(true);
      try {
          const ai = getGeminiClient();
          if (!ai) {
            showToast('请先配置 Gemini API Key', 'error');
            return;
          }
          
          const base64Data = imgData.split(',')[1];
          const mimeType = imgData.split(';')[0].split(':')[1] || "image/jpeg";
          
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: [
                  { inlineData: { mimeType, data: base64Data } },
                  "提取这张小票或账单中的信息。"
              ],
              config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                          amount: { type: Type.NUMBER, description: "提取的金额数字" },
                          type: { type: Type.STRING, enum: ["expense", "income"], description: "如果是付款/支出选expense，收款/退款选income" },
                          category: { type: Type.STRING, description: "从以下分类中选最匹配的一个：餐饮, 交通, 购物, 房租, 水电, 进货, 营销, 杂项, 销售, 服务" },
                          note: { type: Type.STRING, description: "账单的具体项目描述，如'两杯咖啡'，不超过10个字" }
                      }
                  }
              }
          });
          
          const resultText = response.text;
          if (resultText) {
              const parsed = JSON.parse(resultText);
              if (parsed.amount) setAmount(parsed.amount.toString());
              if (parsed.type) setType(parsed.type);
              if (parsed.category) {
                   const match = currentCats.find((c: any) => c.name === parsed.category);
                   if (match) setCategory(match.name);
                   else setCategory('杂项');
              }
              if (parsed.note) setNote(parsed.note);
              showToast('✨ AI 提取成功！请核对信息', 'success');
          } else {
              throw new Error("No data");
          }
      } catch (e) {
          showToast('AI 识别失败，请检查网络或重试', 'error');
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleAddCategory = () => {
      if(!newCatName || isAllMode) return;
      const newEntry = { name: newCatName, rate: parseFloat(newCatRate.toString()) || 100 };
      onUpdateCategories(currentStoreId, { 
        income: type==='income'?[...getCats('income'), newEntry]:getCats('income'), 
        expense: type==='expense'?[...getCats('expense'), newEntry]:getCats('expense') 
      });
      setNewCatName(''); setNewCatRate(100); 
  };

  const handleDeleteCategory = (n: string) => {
      if(isAllMode) return;
      onUpdateCategories(currentStoreId, { 
        income: type==='income'?getCats('income').filter((c: any)=>c.name!==n):getCats('income'), 
        expense: type==='expense'?getCats('expense').filter((c: any)=>c.name!==n):getCats('expense') 
      });
  };
  
  const handleMoveCategory = (index: number, direction: number) => {
      if(isAllMode) return;
      const currentList = [...currentCats];
      if (direction === -1 && index === 0) return;
      if (direction === 1 && index === currentList.length - 1) return;
      const itemToMove = currentList[index];
      currentList.splice(index, 1);
      currentList.splice(index + direction, 0, itemToMove);
      onUpdateCategories(currentStoreId, { 
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
      if(isAllMode || !editCatName) return;
      const currentList = [...currentCats];
      currentList[index] = { name: editCatName, rate: parseFloat(editCatRate.toString()) || 100 };
      onUpdateCategories(currentStoreId, { 
          income: type==='income' ? currentList : getCats('income'), 
          expense: type==='expense' ? currentList : getCats('expense') 
      });
      setEditingCatIndex(null);
  };

  const handleSubmit = () => {
    if (!amount || !category) return showToast('请完善信息', 'error');
    const rawVal = parseFloat(amount);
    const finalAmt = type === 'income' ? (rawVal * (percentage / 100)) : rawVal;
    
    onSave({ 
        type, 
        rawAmount: rawVal, 
        amount: finalAmt, 
        percentage: type === 'income' ? percentage : null, 
        category, 
        storeId, 
        note, 
        isUnpaid: type === 'expense' ? isUnpaid : false, 
        images, 
        date: new Date(date).toISOString() 
    }, editingItem?.id);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-slide-up">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-5 shadow-2xl flex flex-col gap-3 max-h-[95vh] overflow-y-auto">
         <div className="flex justify-between items-center">
           <h2 className="text-xl font-bold text-gray-800">{editingItem ? '编辑' : '记一笔'}</h2>
           <div className="flex gap-2">
             <button onClick={handleVoice} className="bg-gray-100 p-2 rounded-full"><Mic size={16}/></button>
             <button onClick={onClose} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button>
           </div>
         </div>
         
         {isAllMode && (
           <select className="bg-orange-50 p-2 rounded-xl text-sm font-bold text-orange-600 w-full" value={storeId} onChange={e=>setStoreId(e.target.value)}>
             {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
           </select>
         )}
         
         <div className="flex bg-gray-100 p-1 rounded-2xl">
           <button onClick={() => setType('expense')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${type === 'expense' ? 'bg-white shadow-sm' : 'text-gray-400'}`}>支出</button>
           <button onClick={() => setType('income')} className={`flex-1 py-3 rounded-xl text-sm font-bold ${type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>收入</button>
         </div>
         
         <div className="relative py-2">
           <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-bold text-gray-300">€</span>
           <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="w-full pl-8 text-5xl font-bold font-num border-b-2 border-gray-100 outline-none bg-transparent"/>
         </div>
         
         <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] font-bold text-gray-400">分类</label>
              <button onClick={()=>setIsManageMode(!isManageMode)} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 rounded">{isManageMode ? '完成' : '管理'}</button>
            </div>
            
            {/* Manage Categories */}
            {isManageMode ? (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
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
            ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {currentCats.map((c: any) => (
                        <button 
                          key={c.name} 
                          onClick={()=>{setCategory(c.name); if(type==='income') setPercentage(c.rate||100)}} 
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${category === c.name ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}
                        >
                            {c.name} {type==='income'&&c.rate!==100&&<span className="opacity-60 ml-1">{c.rate}%</span>}
                        </button>
                    ))}
                </div>
            )}
            
            {isManageMode && (
                <div className="flex gap-2 mt-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                <input placeholder="新分类名称" value={newCatName} onChange={e=>setNewCatName(e.target.value)} className="flex-1 bg-white border rounded-lg px-2 py-1.5 text-xs outline-none font-bold"/>
                {type === 'income' && (
                    <div className="relative w-40">
                        <input placeholder="比例%" type="number" value={newCatRate} onChange={e=>setNewCatRate(Number(e.target.value))} className="w-full bg-white border rounded-lg pl-2 pr-6 py-1.5 text-xs outline-none font-bold"/>
                        <Percent size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                )}
                <button onClick={handleAddCategory} className="bg-black text-white px-3 rounded-lg text-xs font-bold">添加</button>
                </div>
            )}
         </div>
         
         {/* ✨ AI Receipt Scanner UI */}
         <div className="flex flex-col gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-xl border border-gray-200 overflow-hidden group">
                  <img src={img} alt="receipt" className="w-full h-full object-cover" />
                  <button onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                  <button onClick={() => handleAIAnalyze(img)} disabled={isAnalyzing} className="absolute bottom-0 left-0 right-0 bg-indigo-500/80 text-white text-[8px] py-0.5 text-center font-bold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                    AI提取
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <label className="w-16 h-16 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                    <ImageIcon size={16}/>
                    <span className="text-[8px] font-bold">添加图片</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleFile}/>
                </label>
              )}
            </div>
            {images.length > 0 && (
                <p className="text-[10px] text-gray-400 ml-1">点击图片上的 "AI提取" 识别账单内容 (最多3张)</p>
            )}
         </div>

         {/* Date and Unpaid UI */}
         <div className="flex gap-2 h-12">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 px-3 rounded-2xl border border-transparent focus-within:border-gray-200 transition-colors">
                <Calendar size={16} className="text-gray-400"/>
                <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="bg-transparent font-bold text-sm text-gray-700 outline-none w-full"/>
            </div>
            {type === 'expense' && (
                <button onClick={()=>setIsUnpaid(!isUnpaid)} className={`px-5 rounded-2xl border transition-colors flex items-center justify-center font-bold text-xs ${isUnpaid ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-gray-400 border-gray-200'}`}>
                    未付款项
                </button>
            )}
        </div>

         <input type="text" value={note} onChange={e=>setNote(e.target.value)} placeholder="备注..." className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none"/>
         <button onClick={handleSubmit} className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl bg-gradient-to-r ${theme.from} ${theme.to}`}>
           {editingItem ? '更新' : '保存'}
         </button>
      </div>
    </div>
  );
};
