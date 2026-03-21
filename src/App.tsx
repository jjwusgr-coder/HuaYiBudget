import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Settings, ChevronDown, Search, AlertCircle, RefreshCw, Store, 
  ListFilter, LayoutList, BarChart3, Layers, Sparkles, X, PieChart, Bot, AlertTriangle, Wallet, Leaf, Bell
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  getDoc,
  where 
} from 'firebase/firestore';

import { auth, db, appId, isFirebaseConfigured } from './lib/firebase';
import { getGeminiApiKey, fetchWithBackoff, getGeminiClient } from './lib/gemini';
import { THEMES, ALL_STORES_THEME, DEFAULT_CATEGORIES } from './constants';
import { dataToCsv, parseCsvToTransactions, deepSerializeData } from './utils/helpers';

// Components
import { GlobalStyles } from './components/GlobalStyles';
import { DashboardCard } from './components/DashboardCard';
import { TransactionItem } from './components/TransactionItem';
import { ViewTransactionModal } from './components/ViewTransactionModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { StoreModal } from './components/StoreModal';
import { SettingsModal, BarChart } from './components/SettingsModal';

import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { AIChatModal } from './components/AIChatModal';

const NavBtn = ({ icon: Icon, label, active, onClick, color, badge }: any) => (
  <button onClick={onClick} className={`relative flex flex-col items-center gap-0.5 p-2 transition-all ${active ? color : 'text-gray-300'}`}>
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    {badge > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>}
    <span className="text-[9px] font-bold">{label}</span>
  </button>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // AI Advisor State
  const [advisorMessage, setAdvisorMessage] = useState('');
  const [isAdvising, setIsAdvising] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [viewingTransaction, setViewingTransaction] = useState<any>(null); 
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAIChatModal, setShowAIChatModal] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<any>(null);

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Batch Mode
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!acceptedPrivacy) {
      showToast('请先阅读并同意隐私政策', 'error');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      showToast('登录失败，请重试', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowSettingsModal(false);
      setEmail('');
      setPassword('');
      setAcceptedPrivacy(false);
    } catch (error) {
      console.error("Logout error:", error);
      showToast('退出失败', 'error');
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      showToast('请输入邮箱和密码', 'error');
      return;
    }
    if (!acceptedPrivacy) {
      showToast('请先阅读并同意隐私政策', 'error');
      return;
    }
    
    setIsAuthenticating(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('登录成功', 'success');
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast('注册成功', 'success');
      }
    } catch (error: any) {
      console.error("Email auth error:", error);
      if (error.code === 'auth/email-already-in-use') {
        showToast('该邮箱已被注册', 'error');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        showToast('账号或密码错误，请检查后重试', 'error');
      } else if (error.code === 'auth/weak-password') {
        showToast('密码太弱，请至少输入6位字符', 'error');
      } else if (error.code === 'auth/invalid-email') {
        showToast('邮箱格式不正确', 'error');
      } else {
        showToast(isLoginMode ? '登录失败，请重试' : '注册失败，请重试', 'error');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      showToast('请先输入您的邮箱地址', 'error');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('密码重置邮件已发送，请查收', 'success');
    } catch (error: any) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        showToast('该邮箱尚未注册', 'error');
      } else if (error.code === 'auth/invalid-email') {
        showToast('邮箱格式不正确', 'error');
      } else {
        showToast('发送失败，请稍后重试', 'error');
      }
    }
  };

  // Clear AI advice and batch mode when store or tab changes
  useEffect(() => {
      setAdvisorMessage('');
      setIsBatchMode(false);
      setSelectedIds(new Set());
  }, [currentStoreId, activeTab]);

  // Data Fetching
  useEffect(() => {
    if (!user || !isFirebaseConfigured || !db) return;
    const unsubStores = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'stores')), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStores(list);
      setLoading(false);
      if (!currentStoreId && list.length > 0) setCurrentStoreId(list[0].id);
      else if (!currentStoreId && list.length === 0) setCurrentStoreId('ALL');
    });
    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions')), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
      setTransactions(list);
    });
    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
    });
    return () => { unsubStores(); unsubTrans(); unsubProfile(); };
  }, [user, currentStoreId]);

  const isAllStoresMode = currentStoreId === 'ALL';
  const currentStore = useMemo(() => isAllStoresMode ? { name: '全部店铺', id: 'ALL', categories: DEFAULT_CATEGORIES } : (stores.find(s => s.id === currentStoreId) || null), [stores, currentStoreId, isAllStoresMode]);
  const currentTheme = useMemo(() => {
    if (isAllStoresMode) return ALL_STORES_THEME;
    if (!currentStore) return THEMES[0];
    const theme = THEMES.find(t => t.id === currentStore.theme) || THEMES[0];
    return theme;
  }, [currentStore, isAllStoresMode]);

  const customThemeStyle = useMemo(() => {
    if (!isAllStoresMode && currentStore?.theme === 'custom' && currentStore.customColor) {
      return {
        '--theme-from': currentStore.customColor,
        '--theme-to': currentStore.customColor + 'dd',
        '--theme-shadow': currentStore.customColor + '33',
        '--theme-text': currentStore.customColor,
        '--theme-bg': currentStore.customColor + '1a',
      } as React.CSSProperties;
    }
    return {};
  }, [currentStore, isAllStoresMode]);

  const upcomingTransactions = useMemo(() => {
    if (!currentStoreId && !isAllStoresMode) return [];
    const today = new Date().toISOString().split('T')[0];
    return transactions.filter(t => {
      if (!isAllStoresMode && t.storeId !== currentStoreId) return false;
      const isFuture = t.date.split('T')[0] > today;
      const isRecurring = t.recurring && t.recurring !== 'none';
      return t.isUnpaid || isFuture || isRecurring;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions, currentStoreId, isAllStoresMode]);

  const filteredTransactions = useMemo(() => {
    if (!currentStoreId && !isAllStoresMode) return [];
    return transactions.filter(t => {
      if (!isAllStoresMode && t.storeId !== currentStoreId) return false;
      if (showUnpaidOnly && !t.isUnpaid) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        if (!t.category?.toLowerCase().includes(lower) && !t.note?.toLowerCase().includes(lower)) return false;
      }
      return true;
    });
  }, [transactions, currentStoreId, searchTerm, showUnpaidOnly, isAllStoresMode]);

  const stats = useMemo(() => {
    const target = isAllStoresMode ? transactions : transactions.filter(t => t.storeId === currentStoreId);
    let inc = 0, exp = 0;
    const incCats: any = {}, expCats: any = {};
    target.forEach(t => {
      const v = parseFloat(t.amount) || 0;
      if (t.type === 'income') { inc += v; incCats[t.category] = (incCats[t.category] || 0) + v; } 
      else { exp += v; expCats[t.category] = (expCats[t.category] || 0) + v; }
    });
    return { income: inc, expense: exp, balance: inc - exp, incCats, expCats };
  }, [transactions, currentStoreId, isAllStoresMode]);

  const showToast = (msg: string, type = 'neutral') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getAIAdvice = async () => {
    setIsAdvising(true);
    setAdvisorMessage('');
    try {
        const ai = getGeminiClient();
        if (!ai) {
          showToast('请先配置 Gemini API Key', 'error');
          return;
        }
        
        const prompt = `我当前的账单数据如下：总收入 ${stats.income} 欧元，总支出 ${stats.expense} 欧元，结余 ${stats.balance} 欧元。主要支出分类及金额：${Object.entries(stats.expCats).map(([k,v]) => `${k} ${v}欧`).join(', ')}。请给我一段简短的财务分析和建议（中文，不超过60个字，语气友好、鼓励）。`;
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: "You are a friendly and professional financial advisor."
          }
        });
        
        if(response.text) setAdvisorMessage(response.text);
        else throw new Error('No text returned');
    } catch (e) {
        showToast('获取 AI 建议失败，请稍后再试', 'error');
    } finally {
        setIsAdvising(false);
    }
  };

  const handleAddStore = async (name: string, theme: string, customColor?: string) => {
    if (!name) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'stores'), {
        name, theme, customColor: customColor || null, categories: DEFAULT_CATEGORIES, createdAt: serverTimestamp()
      });
      setShowStoreModal(false);
      showToast('店铺已创建', 'success');
    } catch (e) { showToast('创建失败', 'error'); }
  };

  const handleDeleteStore = (id: string) => {
    const store = stores.find(s => s.id === id);
    if (store) setStoreToDelete(store);
  };
  
  const executeDeleteStore = async () => {
    if(!storeToDelete) return;
    try {
      const batch = writeBatch(db);
      const transactionsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      const q = query(transactionsRef, where('storeId', '==', storeToDelete.id));
      const snap = await getDocs(q); 
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'stores', storeToDelete.id));
      await batch.commit();
      
      if(currentStoreId === storeToDelete.id || currentStoreId === 'ALL') setCurrentStoreId('ALL');
      setStoreToDelete(null);
      showToast('店铺及其记录已删除', 'success');
    } catch (e: any) { 
      console.error("Delete Store Error:", e);
      showToast(`删除失败: ${e.message}`, 'error'); 
    }
  };
  
  const handleUpdateStore = async (id: string, name: string, theme: string, customColor?: string) => {
      if (!name) return showToast('名称不能为空', 'error');
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stores', id), { name, theme, customColor: customColor || null });
          showToast('店铺更新成功', 'success');
      } catch (e) { showToast('更新失败', 'error'); }
  };

  const handleSaveTransaction = async (data: any, id: string) => {
    if (!data.category) return showToast('请选择交易类别', 'error');
    try {
      if (id) {
         const transactionRef = doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id);
         const currentDoc = await getDoc(transactionRef);
         const currentData = currentDoc.data();
         const historySnapshot = deepSerializeData(currentData);
         historySnapshot.historyTimestamp = new Date().toISOString(); 
         const history = Array.isArray(currentData?.history) ? [...currentData.history, historySnapshot] : [historySnapshot];
         await updateDoc(transactionRef, { ...data, history, updatedAt: serverTimestamp() });
         showToast('记录已更新', 'success');
         setViewingTransaction(null);
      } else {
         await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
            ...data, history: [], createdAt: serverTimestamp()
         });
         showToast('记账成功', 'success');
      }
      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (e: any) { showToast(`操作失败: ${e.message}`, 'error'); }
  };
  
  const handleEditClick = (t: any) => {
    setEditingTransaction(t);
    setShowAddModal(true);
    setViewingTransaction(null);
  }
  
  const handleViewClick = (t: any) => { setViewingTransaction(t); }

  const handleDeleteTransaction = async (id: string, data: any) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
      setViewingTransaction(null);
      setToast({
        message: '记录已删除',
        type: 'neutral',
        undoAction: async () => {
          await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id), data);
          showToast('已撤销', 'success');
        }
      });
      setTimeout(() => { 
        setToast((prev: any) => prev?.message === '记录已删除' ? null : prev); 
      }, 4000);
    } catch (e) { showToast('删除失败', 'error'); }
  };

  const handleStoreSwipe = (dir: string) => {
    if (isAllStoresMode || stores.length <= 1) return;
    const idx = stores.findIndex(s => s.id === currentStoreId);
    if (idx === -1) return;
    let nextIdx = dir === 'left' ? idx + 1 : idx - 1;
    if (nextIdx >= stores.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = stores.length - 1;
    setCurrentStoreId(stores[nextIdx].id);
  };

  const handleUpdateStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id), { isUnpaid: !currentStatus });
    } catch(e) {}
  };

  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const executeBatchDelete = async () => {
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id));
      });
      await batch.commit();
      showToast(`已删除 ${selectedIds.size} 条记录`, 'success');
      setIsBatchMode(false);
      setSelectedIds(new Set());
      setShowBatchDeleteConfirm(false);
    } catch (e) {
      showToast('批量删除失败', 'error');
    }
  };

  const handleBatchStatus = async (isUnpaid: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', id), { isUnpaid });
      });
      await batch.commit();
      showToast(`已标记 ${selectedIds.size} 条记录`, 'success');
      setIsBatchMode(false);
      setSelectedIds(new Set());
    } catch (e) {
      showToast('批量更新失败', 'error');
    }
  };

  const handleExport = (format: string) => {
    let data, filename, mimeType;
    if (format === 'json') {
      data = JSON.stringify({ stores, transactions }, null, 2);
      filename = `Backup_${new Date().toISOString().slice(0,10)}.json`;
      mimeType = 'application/json';
    } else if (format === 'csv') {
      data = dataToCsv(transactions, stores);
      filename = `Export_${new Date().toISOString().slice(0,10)}.csv`;
      mimeType = 'text/csv';
    }
    const blob = new Blob([data as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename as string;
    a.click();
    showToast('导出成功', 'success');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isJson = file.name.endsWith('.json');
    const isCsv = file.name.endsWith('.csv');
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const fileContent = event.target?.result as string;
            let importedTransactions: any[] = [];
            if (isJson) {
                const json = JSON.parse(fileContent);
                if (json.transactions) importedTransactions = json.transactions;
            } else if (isCsv) {
                if(stores.length === 0) return showToast('请先创建店铺', 'error');
                importedTransactions = parseCsvToTransactions(fileContent, stores, user.uid);
            }
            if (importedTransactions.length > 0) {
                const batch = writeBatch(db);
                importedTransactions.forEach(t => {
                    const newRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'));
                    batch.set(newRef, { ...t, history: [], createdAt: serverTimestamp() });
                });
                await batch.commit();
                showToast(`导入 ${importedTransactions.length} 条记录`, 'success');
            }
        } catch(err) { showToast('导入失败', 'error'); }
    };
    reader.readAsText(file);
  };
  
  const handleUpdateCategories = async (storeId: string, newCategories: any) => {
     try {
       await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stores', storeId), { categories: newCategories });
     } catch(e) { showToast('更新失败', 'error'); }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-gray-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">缺少 Firebase 配置</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            请在项目根目录创建 <code className="bg-gray-100 px-2 py-1 rounded text-red-500 font-mono">.env.local</code> 文件，并填入您的 Firebase 配置信息。
          </p>
          <div className="text-left bg-gray-800 text-gray-300 p-4 rounded-xl text-xs font-mono overflow-x-auto mb-6">
            VITE_FIREBASE_API_KEY=your_api_key<br/>
            VITE_FIREBASE_AUTH_DOMAIN=your_domain<br/>
            VITE_FIREBASE_PROJECT_ID=your_project_id<br/>
            VITE_FIREBASE_STORAGE_BUCKET=your_bucket<br/>
            VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id<br/>
            VITE_FIREBASE_APP_ID=your_app_id
          </div>
          <a href="https://firebase.google.com/docs/web/setup" target="_blank" rel="noreferrer" className="inline-block w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors">
            查看 Firebase 配置指南
          </a>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 font-num">LOADING...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#e6f4f1] flex flex-col items-center justify-center p-4 text-center font-sans relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-200/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-teal-200/30 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-xl max-w-sm w-full border border-white/50 z-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-teal-400 shadow-lg shadow-blue-500/30 flex items-center justify-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/20 rounded-full blur-md transform translate-x-4 -translate-y-4"></div>
            <Wallet size={36} strokeWidth={1.5} className="z-10" />
            <Leaf size={16} strokeWidth={2} className="absolute bottom-4 right-4 text-teal-100 z-10" />
          </div>
          <h1 className="text-3xl font-black text-gray-800 mb-1 tracking-tighter font-display">HuaYi</h1>
          <p className="text-gray-500 text-xs mb-5 leading-relaxed">
            请登录以继续使用，您的数据将安全地保存在云端。
          </p>

          <div className="space-y-3 mb-5">
            <div className="text-left">
              <label className="text-[10px] font-bold text-gray-500 ml-1 mb-1 block">邮箱</label>
              <input 
                type="email" 
                placeholder="your@email.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 focus:outline-none focus:border-blue-400"
              />
            </div>
            
            <div className="text-left">
              <label className="text-[10px] font-bold text-gray-500 ml-1 mb-1 block">密码</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 focus:outline-none focus:border-blue-400"
              />
            </div>
            
            <div className="flex justify-between items-center mt-2 mb-4">
              <div className="flex items-center gap-2 text-left">
                <input 
                  type="checkbox" 
                  id="privacy" 
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="privacy" className="text-[10px] text-gray-500 leading-tight">
                  我已阅读并同意 <button type="button" onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }} className="text-blue-600 underline relative z-20">隐私政策</button>。
                </label>
              </div>
              {isLoginMode && (
                <button type="button" onClick={handleForgotPassword} className="text-[11px] font-bold text-blue-500 hover:text-blue-600 relative z-20 whitespace-nowrap">
                  忘记密码？
                </button>
              )}
            </div>

            <button 
              onClick={handleEmailAuth}
              disabled={isAuthenticating || !email || !password || !acceptedPrivacy}
              className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md shadow-blue-200 mt-1"
            >
              {isAuthenticating ? '处理中...' : (isLoginMode ? '登录' : '注册')}
            </button>
            
            <button 
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="w-full py-1.5 text-gray-400 font-bold text-xs hover:text-gray-600 transition-colors"
            >
              {isLoginMode ? '没有账号？点击注册' : '已有账号？点击登录'}
            </button>
          </div>

          <div className="relative flex items-center py-1 mb-4">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-3 text-gray-400 text-[10px]">或使用其他方式</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button 
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google 登录
            </button>
          </div>
        </div>
        {showPrivacyModal && <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />}
        {toast && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[80] bg-gray-900/90 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-3 animate-slide-up">
            <span className="text-xs font-bold">{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col font-sans text-slate-800 relative overflow-hidden select-none" style={customThemeStyle}>
      <GlobalStyles />
      <div className="flex items-center justify-between px-5 py-3 pt-6 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm safe-area-top">
        <div onClick={() => setShowStoreModal(true)} className="flex items-center gap-3 cursor-pointer active:opacity-60 transition-opacity">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${currentTheme.from} ${currentTheme.to} flex items-center justify-center text-white shadow-md`}>
            {isAllStoresMode ? <Layers size={22}/> : <Store size={22}/>}
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold leading-none tracking-tight text-gray-800 max-w-[180px] truncate">{currentStore ? currentStore.name : '创建店铺'}</h1>
            <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wide">切换店铺 <ChevronDown size={10} strokeWidth={3}/></div>
          </div>
        </div>
        <button onClick={() => setShowSettingsModal(true)} className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors active:scale-95">
          {profile?.avatar || user?.photoURL ? (
            <img src={profile?.avatar || user?.photoURL} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-blue-100 text-blue-500 flex items-center justify-center font-bold text-lg">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 scrollbar-hide">
        {stores.length > 0 || isAllStoresMode ? (
          <DashboardCard theme={currentTheme} stats={stats} isAllMode={isAllStoresMode} onSwipe={handleStoreSwipe} dots={!isAllStoresMode ? { current: stores.findIndex(s=>s.id===currentStoreId), total: stores.length } : null} />
        ) : (
          <div onClick={() => setShowStoreModal(true)} className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-3xl h-48 text-gray-400 mb-6 cursor-pointer hover:bg-white transition-colors">
            <Plus size={32} className="mb-2 opacity-50"/><span className="font-bold">点击创建第一个店铺</span>
          </div>
        )}

        {activeTab === 'list' && (stores.length > 0 || isAllStoresMode) && (
          <div className="animate-fade-in">
             <div className="flex gap-3 mb-4">
               <div className="relative flex-1">
                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                 <input type="text" placeholder="搜索..." className="w-full bg-white pl-9 pr-4 py-3 rounded-2xl shadow-sm border-none outline-none text-sm font-medium placeholder-gray-300" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
               </div>
               <button onClick={() => setShowUnpaidOnly(!showUnpaidOnly)} className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-sm border transition-colors flex items-center gap-1 ${showUnpaidOnly ? 'bg-red-50 text-red-500 border-red-100' : 'bg-white text-gray-500 border-transparent'}`}><AlertCircle size={14}/> 未付</button>
               <button onClick={toggleBatchMode} className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-sm border transition-colors flex items-center gap-1 ${isBatchMode ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-gray-500 border-transparent'}`}>
                 {isBatchMode ? '取消' : '多选'}
               </button>
               {isBatchMode && (
                 <button onClick={() => {
                   if (selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0) {
                     setSelectedIds(new Set());
                   } else {
                     setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
                   }
                 }} className="px-4 py-2.5 rounded-2xl font-bold text-xs shadow-sm border border-transparent bg-white text-gray-500 transition-colors flex items-center gap-1">
                   {selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? '全不选' : '全选'}
                 </button>
               )}
             </div>
             
             {isBatchMode && (
               <div className="flex items-center justify-between bg-blue-50 p-3 rounded-2xl mb-4 border border-blue-100 animate-slide-up">
                 <span className="text-xs font-bold text-blue-600 ml-2">已选 {selectedIds.size} 项</span>
                 <div className="flex gap-2">
                   <button onClick={() => handleBatchStatus(false)} disabled={selectedIds.size === 0} className="px-3 py-1.5 bg-white text-emerald-600 rounded-xl text-[10px] font-bold shadow-sm disabled:opacity-50">标记已付</button>
                   <button onClick={() => handleBatchStatus(true)} disabled={selectedIds.size === 0} className="px-3 py-1.5 bg-white text-red-500 rounded-xl text-[10px] font-bold shadow-sm disabled:opacity-50">标记未付</button>
                   <button onClick={() => setShowBatchDeleteConfirm(true)} disabled={selectedIds.size === 0} className="px-3 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-bold shadow-sm disabled:opacity-50">删除</button>
                 </div>
               </div>
             )}

             <div className="space-y-3">
               {filteredTransactions.length === 0 ? <div className="py-10 text-center text-gray-400 text-xs font-bold">暂无记录</div> : filteredTransactions.map(t => (
                   <TransactionItem 
                     key={t.id} 
                     data={t} 
                     onDelete={() => handleDeleteTransaction(t.id, t)} 
                     onStatusChange={() => handleUpdateStatus(t.id, t.isUnpaid)} 
                     onViewImage={setPreviewImage} 
                     onEdit={() => handleEditClick(t)} 
                     onViewDetail={() => handleViewClick(t)} 
                     storeName={isAllStoresMode ? stores.find(s=>s.id===t.storeId)?.name : null} 
                     isBatchMode={isBatchMode}
                     isSelected={selectedIds.has(t.id)}
                     onToggleSelect={() => toggleSelection(t.id)}
                   />
               ))}
             </div>
          </div>
        )}

        {activeTab === 'upcoming' && stores.length > 0 && (
          <div className="animate-fade-in">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-800">待办与提醒</h2>
             </div>
             
             {upcomingTransactions.length === 0 ? (
               <div className="text-center py-12 text-gray-400">
                 <Bell size={48} className="mx-auto mb-4 opacity-20" />
                 <p>没有待办事项</p>
               </div>
             ) : (
               <div className="space-y-3 pb-24">
                 {upcomingTransactions.map(t => (
                   <TransactionItem 
                     key={t.id} 
                     data={t} 
                     onDelete={() => handleDeleteTransaction(t.id, t)} 
                     onStatusChange={() => handleUpdateStatus(t.id, t.isUnpaid)} 
                     onViewImage={setPreviewImage} 
                     onEdit={() => { setEditingTransaction(t); setShowAddModal(true); }} 
                     onViewDetail={() => setViewingTransaction(t)} 
                     storeName={isAllStoresMode ? stores.find(s=>s.id===t.storeId)?.name : ''} 
                     isBatchMode={isBatchMode} 
                     isSelected={selectedIds.has(t.id)} 
                     onToggleSelect={() => toggleSelection(t.id)} 
                   />
                 ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'stats' && stores.length > 0 && (
          <div className="space-y-4 animate-fade-in">
             {/* ✨ AI 财务管家卡片 */}
             <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-3xl shadow-lg text-white relative overflow-hidden">
                 <Bot className="absolute top-[-10px] right-[-10px] text-white/10 w-32 h-32" />
                 <h3 className="font-bold text-sm mb-2 flex items-center gap-2 relative z-10"><Sparkles size={16}/> ✨ AI 财务分析</h3>
                 
                 {advisorMessage ? (
                     <p className="text-sm leading-relaxed relative z-10 font-medium bg-black/10 p-3 rounded-xl backdrop-blur-sm shadow-inner">{advisorMessage}</p>
                 ) : (
                     <div className="relative z-10">
                         <p className="text-xs text-white/80 mb-3">让 Gemini AI 为您分析本月收支状况，获取智能省钱和理财建议。</p>
                         <button onClick={getAIAdvice} disabled={isAdvising} className="bg-white text-indigo-600 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm hover:bg-indigo-50 transition-colors active:scale-95 disabled:opacity-50">
                             {isAdvising ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                             {isAdvising ? 'AI 正在分析您的账单...' : '一键生成分析报告'}
                         </button>
                     </div>
                 )}
             </div>

             <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2"><PieChart size={16} className="text-blue-500"/> 收支排行</h3>
                 <BarChart label="支出 Top 5" data={stats.expCats} total={stats.expense} color="bg-red-500"/>
                 <div className="h-4"/>
                 <BarChart label="收入 Top 5" data={stats.incCats} total={stats.income} color="bg-emerald-500"/>
             </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40">
         <button onClick={() => setShowAIChatModal(true)} className="w-12 h-12 rounded-full flex items-center justify-center text-indigo-500 bg-white shadow-lg shadow-indigo-500/20 transition-transform active:scale-95 border-2 border-indigo-50"><Bot size={24} /></button>
         <button onClick={() => { if(stores.length>0) { setEditingTransaction(null); setShowAddModal(true); } else { showToast('请先创建店铺', 'error'); setShowStoreModal(true); }}} className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/40 transition-transform active:scale-95 border-4 border-white bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to}`}><Plus size={28} strokeWidth={3} /></button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-lg border-t border-gray-100 flex justify-around items-center px-4 pb-4 safe-area-bottom z-30">
         <NavBtn icon={LayoutList} label="明细" active={activeTab === 'list'} onClick={() => setActiveTab('list')} color={currentTheme.text} />
         <NavBtn icon={Bell} label="待办" active={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} color={currentTheme.text} badge={upcomingTransactions.length} />
         <div className="w-12"></div>
         <NavBtn icon={BarChart3} label="统计" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} color={currentTheme.text} />
         <NavBtn icon={Settings} label="设置" active={activeTab === 'settings'} onClick={() => setShowSettingsModal(true)} color={currentTheme.text} />
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" alt="preview"/>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white"><X size={32}/></button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[80] bg-gray-900/90 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-3 animate-slide-up">
          <span className="text-xs font-bold">{toast.message}</span>
          {toast.undoAction && <button onClick={toast.undoAction} className="text-blue-300 text-xs font-bold border-l border-gray-700 pl-3 ml-1">撤销</button>}
        </div>
      )}

      {storeToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center text-center animate-slide-up">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">确认删除店铺？</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    您正在删除 <strong>{storeToDelete.name}</strong>。<br/>
                    此操作将<span className="text-red-500 font-bold">永久删除</span>该店铺下的所有账单记录，且无法恢复。
                </p>
                <div className="flex gap-3 w-full">
                    <button onClick={() => setStoreToDelete(null)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500 text-xs transition-colors hover:bg-gray-200">
                        取消
                    </button>
                    <button onClick={executeDeleteStore} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-500/30 transition-transform active:scale-95">
                        确认删除
                    </button>
                </div>
            </div>
        </div>
      )}

      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center text-center animate-slide-up">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">确认批量删除？</h3>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                    您正在删除选中的 <strong className="text-red-500">{selectedIds.size}</strong> 条记录。<br/>
                    此操作将<span className="text-red-500 font-bold">永久删除</span>这些记录，且无法恢复。
                </p>
                <div className="flex gap-3 w-full">
                    <button onClick={() => setShowBatchDeleteConfirm(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500 text-xs transition-colors hover:bg-gray-200">
                        取消
                    </button>
                    <button onClick={executeBatchDelete} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-500/30 transition-transform active:scale-95">
                        确认删除
                    </button>
                </div>
            </div>
        </div>
      )}

      {showStoreModal && <StoreModal stores={stores} onClose={() => setShowStoreModal(false)} onSelect={setCurrentStoreId} onAdd={handleAddStore} onDelete={handleDeleteStore} onUpdate={handleUpdateStore} currentId={currentStoreId} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} hasStore={stores.length>0} onExport={handleExport} onImport={handleImport} onLogout={handleLogout} user={user} profile={profile} db={db} appId={appId} showToast={showToast} />}
      {showAIChatModal && <AIChatModal onClose={() => setShowAIChatModal(false)} transactions={transactions} stats={stats} theme={currentTheme} />}
      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleSaveTransaction} stores={stores} isAllMode={isAllStoresMode} defaultStoreId={isAllStoresMode && stores.length > 0 ? stores[0]?.id : currentStoreId} categories={currentStore?.categories || DEFAULT_CATEGORIES} theme={currentTheme} editingItem={editingTransaction} onUpdateCategories={handleUpdateCategories} currentStoreId={currentStoreId} showToast={showToast} />}
      {viewingTransaction && <ViewTransactionModal transaction={viewingTransaction} onClose={() => setViewingTransaction(null)} onEdit={() => handleEditClick(viewingTransaction)} onDelete={() => handleDeleteTransaction(viewingTransaction.id, viewingTransaction)} onViewImage={setPreviewImage} storeName={stores.find(s=>s.id === viewingTransaction.storeId)?.name || 'N/A'} />}
    </div>
  );
}
