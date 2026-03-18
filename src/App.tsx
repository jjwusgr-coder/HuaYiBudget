import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Settings, ChevronDown, Search, AlertCircle, RefreshCw, Store, 
  ListFilter, LayoutList, BarChart3, Layers, Sparkles, X, PieChart, Bot, AlertTriangle
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider,
  FacebookAuthProvider,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
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
import { getGeminiApiKey, fetchWithBackoff } from './lib/gemini';
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

const NavBtn = ({ icon: Icon, label, active, onClick, color }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-0.5 p-2 transition-all ${active ? color : 'text-gray-300'}`}>
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[9px] font-bold">{label}</span>
  </button>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
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
  const [storeToDelete, setStoreToDelete] = useState<any>(null);

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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
        showToast('邮箱或密码错误', 'error');
      } else if (error.code === 'auth/weak-password') {
        showToast('密码太弱，请至少输入6位字符', 'error');
      } else {
        showToast(isLoginMode ? '登录失败，请重试' : '注册失败，请重试', 'error');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (!acceptedPrivacy) {
      showToast('请先阅读并同意隐私政策', 'error');
      return;
    }
    try {
      const provider = new FacebookAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Facebook login error:", error);
      showToast('Facebook 登录失败，请重试', 'error');
    }
  };

  // Clear AI advice when store changes
  useEffect(() => {
      setAdvisorMessage('');
  }, [currentStoreId]);

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
    return () => { unsubStores(); unsubTrans(); };
  }, [user, currentStoreId]);

  const isAllStoresMode = currentStoreId === 'ALL';
  const currentStore = useMemo(() => isAllStoresMode ? { name: '全部店铺', id: 'ALL', categories: DEFAULT_CATEGORIES } : (stores.find(s => s.id === currentStoreId) || null), [stores, currentStoreId, isAllStoresMode]);
  const currentTheme = useMemo(() => {
    if (isAllStoresMode) return ALL_STORES_THEME;
    if (!currentStore) return THEMES[0];
    return THEMES.find(t => t.id === currentStore.theme) || THEMES[0];
  }, [currentStore, isAllStoresMode]);

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
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
          showToast('请先配置 Gemini API Key', 'error');
          return;
        }
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const prompt = `我当前的账单数据如下：总收入 ${stats.income} 欧元，总支出 ${stats.expense} 欧元，结余 ${stats.balance} 欧元。主要支出分类及金额：${Object.entries(stats.expCats).map(([k,v]) => `${k} ${v}欧`).join(', ')}。请给我一段简短的财务分析和建议（中文，不超过60个字，语气友好、鼓励）。`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: "You are a friendly and professional financial advisor." }] }
        };
        const data = await fetchWithBackoff(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if(text) setAdvisorMessage(text);
        else throw new Error('No text returned');
    } catch (e) {
        showToast('获取 AI 建议失败，请稍后再试', 'error');
    } finally {
        setIsAdvising(false);
    }
  };

  const handleAddStore = async (name: string, theme: string) => {
    if (!name) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'stores'), {
        name, theme, categories: DEFAULT_CATEGORIES, createdAt: serverTimestamp()
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
  
  const handleUpdateStore = async (id: string, name: string, theme: string) => {
      if (!name) return showToast('名称不能为空', 'error');
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stores', id), { name, theme });
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
          setToast({ message: '已撤销', type: 'success' });
        }
      });
      setTimeout(() => { if(toast?.undoAction) setToast(null); }, 4000);
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center font-sans">
        <div className="bg-white p-6 rounded-3xl shadow-xl max-w-sm w-full border border-gray-100">
          <img src="/logo.png" alt="HuaYiBudget" className="w-20 h-20 mx-auto mb-3 rounded-2xl shadow-sm object-cover" />
          <h1 className="text-2xl font-black text-gray-800 mb-1 tracking-tight">HuaYiBudget</h1>
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
            
            <div className="flex items-start gap-2 mt-2 text-left">
              <input 
                type="checkbox" 
                id="privacy" 
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-0.5"
              />
              <label htmlFor="privacy" className="text-[10px] text-gray-500 leading-tight">
                我已阅读并同意 <button onClick={() => setShowPrivacyModal(true)} className="text-blue-600 underline">隐私政策</button>，同意按照 GDPR 规定处理我的个人数据。
              </label>
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
            
            <button 
              onClick={handleFacebookLogin}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#1877F2] text-white rounded-xl font-bold text-sm hover:bg-[#166FE5] transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook 登录
            </button>
          </div>
        </div>
        {showPrivacyModal && <PrivacyPolicyModal onClose={() => setShowPrivacyModal(false)} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col font-sans text-slate-800 relative overflow-hidden select-none">
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
        <button onClick={() => setShowSettingsModal(true)} className="p-2.5 bg-white text-gray-400 hover:text-gray-600 rounded-full border border-gray-100 shadow-sm"><Settings size={20}/></button>
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
             </div>
             <div className="space-y-3">
               {filteredTransactions.length === 0 ? <div className="py-10 text-center text-gray-400 text-xs font-bold">暂无记录</div> : filteredTransactions.map(t => (
                   <TransactionItem key={t.id} data={t} onDelete={() => handleDeleteTransaction(t.id, t)} onStatusChange={() => handleUpdateStatus(t.id, t.isUnpaid)} onViewImage={setPreviewImage} onEdit={() => handleEditClick(t)} onViewDetail={() => handleViewClick(t)} storeName={isAllStoresMode ? stores.find(s=>s.id===t.storeId)?.name : null} />
               ))}
             </div>
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
         <button onClick={() => { if(stores.length>0) { setEditingTransaction(null); setShowAddModal(true); } else { showToast('请先创建店铺', 'error'); setShowStoreModal(true); }}} className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/40 transition-transform active:scale-95 border-4 border-white bg-gradient-to-tr ${currentTheme.from} ${currentTheme.to}`}><Plus size={28} strokeWidth={3} /></button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-lg border-t border-gray-100 flex justify-between items-center px-12 pb-4 safe-area-bottom z-30">
         <NavBtn icon={LayoutList} label="明细" active={activeTab === 'list'} onClick={() => setActiveTab('list')} color={currentTheme.text} />
         <NavBtn icon={BarChart3} label="统计" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} color={currentTheme.text} />
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

      {showStoreModal && <StoreModal stores={stores} onClose={() => setShowStoreModal(false)} onSelect={setCurrentStoreId} onAdd={handleAddStore} onDelete={handleDeleteStore} onUpdate={handleUpdateStore} currentId={currentStoreId} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} hasStore={stores.length>0} onExport={handleExport} onImport={handleImport} onLogout={handleLogout} />}
      {showAddModal && <AddTransactionModal onClose={() => setShowAddModal(false)} onSave={handleSaveTransaction} stores={stores} isAllMode={isAllStoresMode} defaultStoreId={isAllStoresMode && stores.length > 0 ? stores[0]?.id : currentStoreId} categories={currentStore?.categories || DEFAULT_CATEGORIES} theme={currentTheme} editingItem={editingTransaction} onUpdateCategories={handleUpdateCategories} currentStoreId={currentStoreId} showToast={showToast} />}
      {viewingTransaction && <ViewTransactionModal transaction={viewingTransaction} onClose={() => setViewingTransaction(null)} onEdit={() => handleEditClick(viewingTransaction)} onDelete={() => handleDeleteTransaction(viewingTransaction.id, viewingTransaction)} onViewImage={setPreviewImage} storeName={stores.find(s=>s.id === viewingTransaction.storeId)?.name || 'N/A'} />}
    </div>
  );
}
