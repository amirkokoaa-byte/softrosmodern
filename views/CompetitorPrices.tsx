
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { COMPANIES, PRODUCT_GROUPS } from '../constants';
import { Save, Plus, Trash2, TrendingUp, PlusCircle } from 'lucide-react';
import { db, ref, push } from '../firebase';

interface Props {
  user: User;
  markets: string[];
}

const CompetitorPrices: React.FC<Props> = ({ user, markets }) => {
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [prices, setPrices] = useState<Record<string, { name: string, price: number }[]>>({
    facial: [],
    kitchen: [],
    hotel_toilet: [],
    dolphin: []
  });

  // When Soft Rose is picked, auto-load internal products
  useEffect(() => {
    if (selectedCompany === 'سوفت روز') {
      const internalPrices: any = {};
      Object.entries(PRODUCT_GROUPS).forEach(([cat, products]) => {
        internalPrices[cat] = products.map(p => ({ name: p, price: 0 }));
      });
      setPrices(internalPrices);
    } else {
      setPrices({ facial: [], kitchen: [], hotel_toilet: [], dolphin: [] });
    }
  }, [selectedCompany]);

  const addPriceRow = (category: string) => {
    setPrices(prev => ({
      ...prev,
      [category]: [...prev[category], { name: '', price: 0 }]
    }));
  };

  const removePriceRow = (category: string, index: number) => {
    setPrices(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const updatePriceRow = (category: string, index: number, field: string, value: any) => {
    setPrices(prev => {
      const updated = [...prev[category]];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [category]: updated };
    });
  };

  const handleSave = async () => {
    if (!selectedMarket || !selectedCompany) {
      alert("يرجى اختيار الماركت والشركة");
      return;
    }

    const filteredCategories: any = {};
    let hasData = false;
    // Fix: Cast 'items' to expected array type to prevent 'unknown' inference in Object.entries
    Object.entries(prices).forEach(([cat, items]) => {
      const productItems = items as { name: string, price: number }[];
      const valid = productItems.filter(i => i.name.trim() !== '' && i.price > 0);
      if (valid.length > 0) {
        filteredCategories[cat] = valid;
        hasData = true;
      }
    });

    if (!hasData) {
      alert("يرجى إدخال اسم منتج وسعر واحد على الأقل");
      return;
    }

    try {
      await push(ref(db, 'competitor_prices'), {
        userId: user.id,
        userName: user.employeeName,
        marketName: selectedMarket,
        companyName: selectedCompany,
        date: new Date().toISOString(),
        categories: filteredCategories
      });
      alert("تم حفظ الأسعار بنجاح");
      setPrices({ facial: [], kitchen: [], hotel_toilet: [], dolphin: [] });
      setSelectedCompany('');
      setSelectedMarket('');
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'facial': return 'مناديل سحب (Facial)';
      case 'kitchen': return 'مناديل مطبخ (Kitchen)';
      case 'hotel_toilet': return 'تواليت فنادق (Hotel Toilet)';
      case 'dolphin': return 'دولفن (Dolphin)';
      default: return cat;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 p-8 md:p-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-amber-100 text-amber-800 rounded-3xl">
            <TrendingUp size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">تسعير المنافسين</h2>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Competitor Market Pricing</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 bg-slate-50 p-8 rounded-3xl border border-slate-100">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 mr-2">الماركت المستهدف</label>
            <select 
              className="w-full bg-white border-2 border-transparent focus:border-gray-200 rounded-2xl p-4 outline-none font-bold text-gray-700 shadow-sm"
              value={selectedMarket}
              onChange={(e) => setSelectedMarket(e.target.value)}
            >
              <option value="">اختر الماركت</option>
              {markets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 mr-2">الشركة المنافسة</label>
            <select 
              className="w-full bg-white border-2 border-transparent focus:border-gray-200 rounded-2xl p-4 outline-none font-bold text-gray-700 shadow-sm"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">اختر الشركة</option>
              {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {selectedCompany && ['facial', 'kitchen', 'hotel_toilet', 'dolphin'].map(cat => (
          <div key={cat} className="mb-10 animate-in fade-in duration-300">
            <div className="bg-slate-100 px-6 py-4 font-black text-slate-600 rounded-2xl mb-4 text-sm flex items-center justify-between">
              <span>{getCategoryLabel(cat)}</span>
            </div>
            <div className="space-y-3 mb-4">
              {prices[cat]?.map((row, idx) => (
                <div key={idx} className="flex gap-2 md:gap-3 bg-white border border-slate-100 p-2 md:p-4 rounded-2xl md:rounded-3xl group transition-all hover:border-gray-200">
                  <input 
                    placeholder="اسم المنتج المنافس..." 
                    className="flex-1 bg-slate-50 border-2 border-transparent focus:border-gray-200 rounded-xl md:rounded-2xl p-2 md:p-4 text-[10px] md:text-base font-bold text-gray-700 outline-none"
                    value={row.name} onChange={(e) => updatePriceRow(cat, idx, 'name', e.target.value)}
                  />
                  <input 
                    type="number" placeholder="السعر" 
                    className="w-16 md:w-28 bg-slate-50 border-2 border-transparent focus:border-gray-200 rounded-xl md:rounded-2xl p-2 md:p-4 text-center text-[10px] md:text-base font-black text-gray-900 outline-none shrink-0"
                    value={row.price || ''} onChange={(e) => updatePriceRow(cat, idx, 'price', Number(e.target.value))}
                  />
                  <button onClick={() => removePriceRow(cat, idx)} className="p-2 md:p-4 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all shrink-0"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => addPriceRow(cat)}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 font-black text-xs flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-700 transition-all"
            >
              <PlusCircle size={18}/> إضافة صنف جديد لهذا القسم
            </button>
          </div>
        ))}

        {selectedCompany && (
          <div className="mt-12 pt-8 border-t border-slate-100">
            <button 
              onClick={handleSave}
              className="w-full bg-amber-600 text-white py-6 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-amber-700 hover:scale-[1.02] transition-all shadow-2xl shadow-amber-100"
            >
              <Save size={24}/> ترحيل وحفظ تقرير الأسعار
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorPrices;
