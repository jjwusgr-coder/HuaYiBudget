import { serverTimestamp } from 'firebase/firestore';

export const formatMoney = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (typeof num !== 'number' || isNaN(num)) return '€0.00';
  return new Intl.NumberFormat('zh-CN', { 
    style: 'currency', 
    currency: 'EUR', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  }).format(num);
};

export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const formatDateTime = (timestamp: any) => {
    if (!timestamp) return '未知时间';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('zh-CN', { 
        year: 'numeric', month: '2-digit', day: '2-digit', 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
};

export const deepSerializeData = (data: any): any => {
    if (data === null || typeof data !== 'object') return data;
    if (data instanceof Date || (typeof data.toDate === 'function')) {
        return (data instanceof Date ? data : data.toDate()).toISOString();
    }
    if (Array.isArray(data)) return data.map(item => deepSerializeData(item));
    const serialized: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            serialized[key] = deepSerializeData(data[key]);
        }
    }
    delete serialized.history; 
    return serialized;
};

export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_SIZE = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) { 
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } 
        } else { 
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } 
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const parseVoiceInput = (text: string) => {
  let type = 'expense';
  let amount = '';
  let category = '';
  const note = text; 
  if (text.match(/(收入|赚|入账|存入|加)/)) type = 'income';
  const amountMatch = text.match(/(\d+(\.\d+)?)/);
  if (amountMatch) amount = amountMatch[0];
  const keywords: Record<string, string[]> = {
    '餐饮': ['吃', '饭', '饿', '餐', '喝', '酒', '面', '粉', '茶'],
    '交通': ['车', '油', '票', '路', '铁', '飞', '打的'],
    '购物': ['买', '购', '衣', '鞋', '包', '超市', '菜'],
    '房租': ['房', '住', '租'],
    '水电': ['水', '电', '网', '气', '费'],
    '进货': ['货', '料', '材'],
    '销售': ['卖', '售', '客'],
  };
  for (const [cat, keys] of Object.entries(keywords)) {
    if (keys.some(k => text.includes(k))) { category = cat; break; }
  }
  return { type, amount, category, note };
};

export const dataToCsv = (transactions: any[], stores: any[]) => {
    if (!transactions || transactions.length === 0) return '';
    const storeMap = stores.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
    const headers = [
        'ID', '日期', '类型', '店铺', '分类', '实收金额 (EUR)', '原始金额', 
        '提成 (%)', '是否未付', '备注', '创建时间', '更新时间', '是否有附件'
    ].join(',');
    const rows = transactions.map(t => [
        `"${t.id}"`,
        `"${formatDate(t.date)}"`,
        `"${t.type === 'income' ? '收入' : '支出'}"`,
        `"${storeMap[t.storeId] || 'N/A'}"`,
        `"${t.category ? t.category.replace(/"/g, '""') : 'N/A'}"`, 
        t.amount,
        t.rawAmount || t.amount,
        t.percentage || 100,
        t.isUnpaid ? '是' : '否',
        `"${t.note ? t.note.replace(/"/g, '""') : ''}"`, 
        `"${formatDateTime(t.createdAt)}"`,
        `"${formatDateTime(t.updatedAt || t.createdAt)}"`,
        t.image ? '是' : '否'
    ].join(','));
    return [headers, ...rows].join('\n');
};

export const parseCsvToTransactions = (csvData: string, stores: any[], userId: string) => {
    const lines = csvData.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const transactions = [];
    const dateIndex = headers.indexOf('日期');
    const typeIndex = headers.indexOf('类型');
    const storeNameIndex = headers.indexOf('店铺');
    const categoryIndex = headers.indexOf('分类');
    const amountIndex = headers.indexOf('实收金额 (EUR)') > -1 ? headers.indexOf('实收金额 (EUR)') : headers.indexOf('金额 (EUR)');
    const rawAmountIndex = headers.indexOf('原始金额');
    const percentageIndex = headers.indexOf('提成 (%)');
    const unpaidIndex = headers.indexOf('是否未付');
    const noteIndex = headers.indexOf('备注');
    
    if (dateIndex === -1 || typeIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
        throw new Error("CSV 文件缺少必要的列: 日期, 类型, 分类, 金额。");
    }
    const storeMap = stores.reduce((acc, s) => { acc[s.name] = s.id; return acc; }, {});
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        const cleanValues = values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        const type = cleanValues[typeIndex] === '收入' ? 'income' : 'expense';
        const rawAmount = parseFloat(cleanValues[rawAmountIndex] || cleanValues[amountIndex]);
        const amount = parseFloat(cleanValues[amountIndex]);
        const percentage = parseFloat(cleanValues[percentageIndex]) || 100;
        const storeName = cleanValues[storeNameIndex];
        const storeId = storeMap[storeName] || stores[0]?.id || 'N/A';
        if (isNaN(amount) || !storeId) continue;
        transactions.push({
            type,
            rawAmount,
            amount,
            percentage: type === 'income' ? percentage : null,
            category: cleanValues[categoryIndex],
            storeId: storeId,
            note: cleanValues[noteIndex],
            isUnpaid: cleanValues[unpaidIndex] === '是',
            date: new Date(cleanValues[dateIndex]).toISOString(),
            createdAt: serverTimestamp(),
            history: [] 
        });
    }
    return transactions;
};
