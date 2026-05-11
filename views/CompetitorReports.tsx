
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db, ref, onValue } from '../firebase';
import { COMPANIES } from '../constants';
import { Download, ArrowLeftRight, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
  markets: string[];
}

const CompetitorReports: React.FC<Props> = ({ user, markets }) => {
  const [prices, setPrices] = useState<any[]>([]);
  const [filterMarket, setFilterMarket] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  // Compare Modal States
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareFilters, setCompareFilters] = useState({ market: '', company: '', product: '' });

  useEffect(() => {
    const pRef = ref(db, 'competitor_prices');
    onValue(pRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrices(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
      } else {
        setPrices([]);
      }
    });
  }, []);

  const filtered = prices.filter(p => {
    const matchM = filterMarket ? p.marketName === filterMarket : true;
    const matchC = filterCompany ? p.companyName === filterCompany : true;
    return matchM && matchC;
  });

  const exportExcel = () => {
    const data = filtered.flatMap(p => {
      const rows: any[] = [];
      Object.entries(p.categories).forEach(([cat, items]: any) => {
        items.forEach((item: any) => {
          rows.push({
            'الماركت': p.marketName,
            'الشركة': p.companyName,
            'الفئة': cat,
            'المنتج': item.name,
            'السعر': item.price
          });
        });
      });
      return rows;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقارير المنافسين");
    XLSX.writeFile(wb, "تقارير_المنافسين.xlsx");
  };

  const allPricePoints = prices.flatMap(p => 
    Object.values(p.categories || {}).flatMap((items: any) => 
      items.map((item: any) => ({
        marketName: p.marketName,
        companyName: p.companyName,
        productName: item.name,
        price: item.price,
        date: p.date
      }))
    )
  );

  const uniqueMarkets = Array.from(new Set(allPricePoints.map(p => p.marketName)));
  const uniqueCompanies = Array.from(new Set(allPricePoints.map(p => p.companyName)));
  const uniqueProducts = Array.from(new Set(allPricePoints.map(p => p.productName)));

  const filteredCompare = allPricePoints.filter(p => {
    const matchM = compareFilters.market ? p.marketName === compareFilters.market : true;
    const matchC = compareFilters.company ? p.companyName === compareFilters.company : true;
    const matchP = compareFilters.product ? p.productName === compareFilters.product : true;
    return matchM && matchC && matchP;
  });

  const exportCompareExcel = () => {
    const data = filteredCompare.map(p => ({
      'الماركت': p.marketName,
      'الشركة': p.companyName,
      'الصنف': p.productName,
      'السعر': p.price,
      'تاريخ التسجيل': new Date(p.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مقارنة الأسعار");
    XLSX.writeFile(wb, "مقارنة_الأسعار.xlsx");
  };

  return (
    <div className="space-y-6 pb-20 text-right" dir="rtl">
      <div className="glass-card-dark p-6 md:p-8 rounded-[2rem]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <h2 className="text-2xl font-black text-white">تقارير المنافسين</h2>
          <button 
            onClick={() => setIsCompareModalOpen(true)}
            className="w-full md:w-auto bg-gray-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all active:scale-95"
          >
            <ArrowLeftRight size={20}/> مقارنة الأسعار
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <select 
            className="glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10"
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
          >
            <option value="" className="bg-gray-500">كل الماركت</option>
            {markets.map(m => <option key={m} value={m} className="bg-gray-500">{m}</option>)}
          </select>
          <select 
            className="glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
          >
            <option value="" className="bg-gray-500">كل الشركات</option>
            {COMPANIES.map(c => <option key={c} value={c} className="bg-gray-500">{c}</option>)}
          </select>
          <button 
            onClick={exportExcel}
            className="bg-green-600 text-white rounded-xl font-black flex items-center justify-center gap-2 py-4 hover:bg-green-700 transition"
          >
            <Download size={20}/> تصدير اكسيل
          </button>
        </div>

        <div className="space-y-4">
          {filtered.map(report => (
            <div key={report.id} className="bg-white/5 rounded-[2.5rem] p-6 border border-white/10">
              <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-4">
                <span className="font-bold text-white tracking-wide">{report.marketName} <span className="text-white/40 mx-2">-</span> <span className="text-gray-300">{report.companyName}</span></span>
                <span className="text-xs text-white/50 font-black px-4 py-2 bg-white/5 rounded-lg">{new Date(report.date).toLocaleDateString('ar-EG')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(report.categories).map(([cat, items]: any) => (
                  <div key={cat} className="bg-black/20 p-4 rounded-2xl border border-white/5">
                    <div className="font-black mb-3 border-b border-white/10 pb-2 text-white/70 tracking-widest uppercase text-xs">
                      {cat === 'facial' ? 'Facial' : cat === 'kitchen' ? 'Kitchen' : 'Toilet'}
                    </div>
                    <div className="space-y-2">
                      {items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between py-1 bg-white/5 px-3 rounded-lg items-center">
                          <span className="text-sm font-bold text-gray-200">{item.name}</span>
                          <span className="font-black text-white text-sm bg-gray-600/50 px-2 py-1 rounded">{item.price} <span className="text-[10px] text-white/40 font-normal">ج.م</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-10 text-white/40 font-black">لا توجد بيانات متاحة</div>}
        </div>
      </div>

      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-4xl p-8 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h3 className="text-2xl font-black text-white flex items-center gap-3"><ArrowLeftRight size={24} className="text-gray-400"/> مقارنة الأسعار</h3>
              <button 
                onClick={() => {
                  setIsCompareModalOpen(false); 
                  setCompareFilters({ market: '', company: '', product: '' });
                }} 
                className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
              >
                <X size={24}/>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الماركت</label>
                <select 
                  className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10"
                  value={compareFilters.market}
                  onChange={(e) => setCompareFilters({...compareFilters, market: e.target.value})}
                >
                  <option value="" className="bg-gray-500">جميع الماركتات</option>
                  {uniqueMarkets.map(m => <option key={m} value={m} className="bg-gray-500">{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الشركة</label>
                <select 
                  className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10"
                  value={compareFilters.company}
                  onChange={(e) => setCompareFilters({...compareFilters, company: e.target.value})}
                >
                  <option value="" className="bg-gray-500">جميع الشركات</option>
                  {uniqueCompanies.map(c => <option key={c} value={c} className="bg-gray-500">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الصنف</label>
                <select 
                  className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10"
                  value={compareFilters.product}
                  onChange={(e) => setCompareFilters({...compareFilters, product: e.target.value})}
                >
                  <option value="" className="bg-gray-500">جميع الأصناف</option>
                  {uniqueProducts.map(p => <option key={p} value={p} className="bg-gray-500">{p}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded-2xl border border-white/5 p-4 mb-6">
              <table className="w-full text-right border-collapse">
                <thead className="sticky top-0 bg-[#162032] z-10">
                  <tr className="text-xs font-black text-white/40 uppercase tracking-widest border-b border-white/10">
                    <th className="p-4">الصنف</th>
                    <th className="p-4">الماركت</th>
                    <th className="p-4">الشركة</th>
                    <th className="p-4">السعر</th>
                    <th className="p-4">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm font-bold text-gray-200">
                  {filteredCompare.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-all">
                      <td className="p-4 text-white font-black">{item.productName}</td>
                      <td className="p-4 text-gray-400">{item.marketName}</td>
                      <td className="p-4 text-gray-400">{item.companyName}</td>
                      <td className="p-4">
                        <span className="bg-gray-600/50 text-white px-3 py-1 rounded-lg">
                          {item.price} <span className="text-[10px] font-normal text-white/50">ج.م</span>
                        </span>
                      </td>
                      <td className="p-4 text-white/50 text-xs">
                        {new Date(item.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                  {filteredCompare.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-white/30 font-black">
                        لا توجد نتائج مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 flex gap-4">
              <button 
                onClick={exportCompareExcel} 
                disabled={filteredCompare.length === 0}
                className="flex-1 bg-emerald-600 disabled:opacity-50 text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"
              >
                <Download size={20}/> تصدير نتيجة المقارنة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitorReports;

