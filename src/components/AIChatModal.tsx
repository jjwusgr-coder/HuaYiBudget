import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { getGeminiClient } from '../lib/gemini';
import Markdown from 'react-markdown';

export const AIChatModal = ({ onClose, transactions, stats, theme }: any) => {
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([
    { role: 'model', text: '你好！我是你的 AI 财务助手。你可以问我关于你账单的任何问题，例如：“我这个月在餐饮上花了多少钱？”或“帮我分析一下我的消费习惯”。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const ai = getGeminiClient();
      if (!ai) {
        setMessages(prev => [...prev, { role: 'model', text: '请先配置 Gemini API Key。' }]);
        setIsLoading(false);
        return;
      }

      // Prepare context
      const context = `
你是一个专业的个人财务助手。以下是用户的财务数据上下文：
总收入: ${stats.income} 欧元
总支出: ${stats.expense} 欧元
结余: ${stats.balance} 欧元
主要支出分类: ${Object.entries(stats.expCats).map(([k,v]) => `${k}: ${v}欧`).join(', ')}
主要收入分类: ${Object.entries(stats.incCats).map(([k,v]) => `${k}: ${v}欧`).join(', ')}

最近的交易记录 (最多50条):
${transactions.slice(0, 50).map((t: any) => `- ${t.date}: [${t.type === 'expense' ? '支出' : '收入'}] ${t.category} ${t.amount}欧 (${t.note || '无备注'})`).join('\n')}

请根据以上数据，简明扼要、专业且友好地回答用户的问题。如果用户问的问题与财务无关，请礼貌地引导回财务话题。
`;

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: context,
          temperature: 0.7,
        }
      });

      // Replay history
      for (const msg of messages.slice(1)) { // Skip initial greeting
         await chat.sendMessage({ message: msg.text });
      }

      const response = await chat.sendMessage({ message: userMsg });
      
      setMessages(prev => [...prev, { role: 'model', text: response.text || '抱歉，我无法回答这个问题。' }]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: '抱歉，网络或服务出现问题，请稍后再试。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[80vh] sm:h-[600px] rounded-[2rem] flex flex-col overflow-hidden animate-slide-up shadow-2xl">
        {/* Header */}
        <div className={`p-4 flex items-center justify-between text-white bg-gradient-to-r ${theme.from} ${theme.to}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Bot size={18} />
            </div>
            <h2 className="font-bold text-sm">AI 财务助手</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center mt-1 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'}`}>
                  {msg.role === 'user' ? (
                    msg.text
                  ) : (
                    <div className="markdown-body text-sm leading-relaxed">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[85%] flex-row">
                <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mt-1">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-2xl bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                  <span className="text-xs text-gray-500">AI 正在思考...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="问问关于你的账单..."
              className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-gray-300 hover:bg-indigo-600 transition-colors"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
