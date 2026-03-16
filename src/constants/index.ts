export const THEMES = [
  { id: 'blue', name: '商务蓝', from: 'from-blue-600', to: 'to-blue-500', shadow: 'shadow-blue-200', text: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'purple', name: '梦幻紫', from: 'from-purple-600', to: 'to-purple-500', shadow: 'shadow-purple-200', text: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'green', name: '清新绿', from: 'from-emerald-600', to: 'to-emerald-500', shadow: 'shadow-emerald-200', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'orange', name: '活力橙', from: 'from-orange-500', to: 'to-amber-500', shadow: 'shadow-orange-200', text: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'dark', name: '深邃黑', from: 'from-slate-800', to: 'to-slate-700', shadow: 'shadow-slate-400', text: 'text-slate-800', bg: 'bg-slate-100' },
];

export const ALL_STORES_THEME = { 
  id: 'all', 
  name: '全部店铺', 
  from: 'from-indigo-600', 
  to: 'from-pink-500', 
  shadow: 'shadow-indigo-200', 
  text: 'text-indigo-600', 
  bg: 'bg-indigo-50' 
};

export const DEFAULT_CATEGORIES = {
  income: [
    { name: '销售', rate: 100 }, 
    { name: '服务', rate: 100 }, 
    { name: '外卖平台', rate: 80 }, 
    { name: '投资', rate: 100 }, 
    { name: '其他', rate: 100 }
  ],
  expense: [
    { name: '进货', rate: 100 }, 
    { name: '房租', rate: 100 }, 
    { name: '人工', rate: 100 }, 
    { name: '水电', rate: 100 }, 
    { name: '营销', rate: 100 }, 
    { name: '杂项', rate: 100 }, 
    { name: '交通', rate: 100 }, 
    { name: '餐饮', rate: 100 }, 
    { name: '购物', rate: 100 }
  ]
};
