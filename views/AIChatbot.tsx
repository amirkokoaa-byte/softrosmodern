
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { User, DailySale, InventoryRecord, Vacation, Market, AppSettings } from '../types';
import { Send, Bot, User as UserIcon, Loader2, Sparkles, MessageSquare, Trash2, X } from 'lucide-react';

interface Props {
  user: User;
  onClose: () => void;
  appData: {
    sales: DailySale[];
    inventory: InventoryRecord[];
    vacations: Vacation[];
    users: User[];
    markets: Market[];
    settings: AppSettings | null;
  };
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const AIChatbot: React.FC<Props> = ({ user, appData, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateDataSummary = () => {
    const totalSales = appData.sales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const userPerformance: Record<string, number> = {};
    appData.sales.forEach(s => {
      const name = s.userName || 'غير معروف';
      userPerformance[name] = (userPerformance[name] || 0) + Number(s.total || 0);
    });
    const sortedPerformers = Object.entries(userPerformance).sort((a, b) => b[1] - a[1]);
    const topPerformer = sortedPerformers[0] ? `${sortedPerformers[0][0]} بمبيعات ${sortedPerformers[0][1].toLocaleString()}` : 'لا يوجد مبيعات';

    return `
      ملخص بيانات Soft Rose:
      - اسم البرنامج: ${appData.settings?.programName || 'Soft Rose'}
      - الموظفين: ${appData.users.length}
      - الماركتات: ${appData.markets.length}
      - إجمالي المبيعات: ${totalSales.toLocaleString()} ج.م
      - المتصدر: ${topPerformer}
    `;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `
        أنت المساعد الذكي الرسمي "روزي" لنظام Soft Rose. 
        تحدث بالعربية باختصار واحترافية.
        البيانات المتاحة: ${generateDataSummary()}
        المستخدم الحالي: ${user.employeeName}.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: { systemInstruction, temperature: 0.7 },
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || "لا يمكنني الرد الآن." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "خطأ في الاتصال بالذكاء الاصطناعي." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/40 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/40 overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-md p-5 text-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <Sparkles className="text-amber-300" size={20}/>
          </div>
          <div>
            <h3 className="text-sm font-black">المساعدة روزي</h3>
            <p className="text-[9px] font-bold text-gray-200 uppercase tracking-widest">Soft Rose AI Assistant</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMessages([])} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><Trash2 size={16}/></button>
          <button onClick={onClose} className="p-2.5 hover:bg-white/10 rounded-xl transition-all"><X size={16}/></button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-transparent custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="p-8 bg-gray-900/10 rounded-[2.5rem] mb-5">
              <MessageSquare size={54} className="text-gray-900" />
            </div>
            <p className="text-sm font-black text-gray-950 px-10 leading-relaxed">أهلاً بك في نظام روزي الذكي. أنا جاهزة لتحليل مبيعاتك وأرصدة الماركت.</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`flex gap-3 max-w-[88%] ${m.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-white/80 text-gray-900 backdrop-blur-md border border-white/50'}`}>
                {m.role === 'user' ? <UserIcon size={16}/> : <Bot size={16}/>}
              </div>
              <div className={`p-4 rounded-[1.5rem] font-bold text-xs leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white/90 text-gray-800 rounded-tl-none border border-white/50 shadow-gray-900/5'}`}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-end">
            <div className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm flex items-center gap-3">
              <Loader2 className="animate-spin text-gray-900" size={16}/>
              <span className="text-[10px] font-black text-gray-900/60 uppercase tracking-widest">تحليل البيانات...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-5 bg-white/20 backdrop-blur-xl border-t border-white/20">
        <div className="relative">
          <input 
            className="w-full bg-white/60 backdrop-blur-md rounded-2xl py-5 px-14 pr-6 outline-none font-black text-xs text-gray-950 border border-white/50 focus:bg-white/95 transition-all shadow-inner placeholder-gray-900/30"
            placeholder="اسألني عن أي شيء في النظام..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-gray-900 text-white rounded-[1rem] hover:bg-gray-950 disabled:opacity-30 transition-all shadow-lg shadow-gray-900/20 active:scale-90"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIChatbot;
