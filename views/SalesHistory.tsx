
import React, { useState, useEffect, useMemo } from 'react';
import { User, DailySale, TargetRecord } from '../types';
import { Trash2, Edit, Trophy, BarChart3, FileSpreadsheet, X, Clock, Calendar as CalendarIcon, User as UserIcon, Store, History, Search, Filter, Download, Crosshair, PackageSearch, Plus, Target, ChevronRight, ChevronLeft, TrendingUp } from 'lucide-react';
import { db, ref, onValue, remove, update, push, set } from '../firebase';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
  markets: string[];
  users: User[];
}

const SalesHistory: React.FC<Props> = ({ user, markets = [], users = [] }) => {
  const [sales, setSales] = useState<DailySale[]>([]);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [selectedSale, setSelectedSale] = useState<DailySale | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [filters, setFilters] = useState({
    dateStart: '',
    dateEnd: '',
    marketName: ''
  });

  const [isProductSalesOpen, setIsProductSalesOpen] = useState(false);
  const [productSalesFilters, setProductSalesFilters] = useState({
    productName: '',
    marketName: '',
    dateStart: '',
    dateEnd: ''
  });

  const [isTargetMgmtOpen, setIsTargetMgmtOpen] = useState(false);
  const [targetMgmt, setTargetMgmt] = useState({
    userId: '',
    marketName: ''
  });
  const [growthRate, setGrowthRate] = useState(0);
  const [finalTargetOverride, setFinalTargetOverride] = useState<number | ''>('');

  useEffect(() => {
    const salesRef = ref(db, 'sales');
    onValue(salesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let salesList = Object.entries(data).map(([id, val]: any) => ({ ...val, id }));
        
        // الصلاحيات: إذا لم يكن لديه صلاحية رؤية مبيعات الزملاء، نكتفي بمبيعاته فقط
        const up = user.permissions || { viewColleaguesSales: false };
        if (user.role !== 'admin' && !up.viewColleaguesSales) {
          salesList = salesList.filter(s => s.userId === user.id);
        }
        
        setSales(salesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        setSales([]);
      }
    });

    onValue(ref(db, 'targets'), snapshot => {
      const data = snapshot.val();
      if(data) {
        setTargets(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
      } else {
        setTargets([]);
      }
    });
  }, [user]);

  const [isCurrentTargetOpen, setIsCurrentTargetOpen] = useState(false);
  const [targetMonthOffset, setTargetMonthOffset] = useState(0);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const sDate = s.date ? s.date.split('T')[0] : '';
      const matchStart = filters.dateStart ? sDate >= filters.dateStart : true;
      const matchEnd = filters.dateEnd ? sDate <= filters.dateEnd : true;
      const matchMarket = filters.marketName ? s.marketName === filters.marketName : true;
      const matchName = searchName ? s.userName === searchName : true;
      return matchStart && matchEnd && matchMarket && matchName;
    });
  }, [sales, filters, searchName]);

  const currentTargetStats = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + targetMonthOffset);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const yearMonth = `${y}-${m.toString().padStart(2, '0')}`;
    const endDate = new Date(y, m, 0).getDate();
    const dateLabel = `1/${m}/${y} حتي ${endDate}/${m}/${y}`;

    let list = targets.filter(t => t.yearMonth === yearMonth).map(t => {
      const empName = users.find(u => u.id === t.userId)?.employeeName || 'غير معروف';
      const mSales = sales.filter(s => s.userId === t.userId && s.marketName === t.marketName && s.date.startsWith(yearMonth));
      const ach = mSales.reduce((acc, s) => acc + (s.total || 0), 0);
      const perc = t.targetValue ? (ach / t.targetValue) * 100 : 0;
      return { id: t.id, empName, market: t.marketName, target: t.targetValue, ach, perc };
    });

    if (user.role !== 'admin' && !(user.permissions?.viewColleaguesSales)) {
       list = list.filter(l => users.find(u => u.employeeName === l.empName)?.id === user.id);
    }
    
    return { label: dateLabel, list };
  }, [targets, sales, users, targetMonthOffset, user]);

  const stats = useMemo(() => {
    const dataToProcess = filteredSales;
    const userTotals: Record<string, {name: string, total: number}> = {};

    dataToProcess.forEach(s => {
      const uid = s.userId || 'unknown';
      if (!userTotals[uid]) userTotals[uid] = { name: s.userName || 'غير معروف', total: 0 };
      userTotals[uid].total += (Number(s.total) || 0);
    });

    const star = Object.values(userTotals).sort((a, b) => b.total - a.total)[0] || null;

    return { star };
  }, [filteredSales]);

  // Product sales report calculation
  const uniqueProducts = useMemo(() => Array.from(new Set(sales.flatMap(s => s.items.map(i => i.productName)))), [sales]);
  const productReportData = useMemo(() => {
    let rawItems = sales.flatMap(s => s.items.map(i => ({ ...i, date: s.date, marketName: s.marketName })));
    rawItems = rawItems.filter(i => {
      const iDate = i.date ? i.date.split('T')[0] : '';
      const mMatch = productSalesFilters.marketName ? i.marketName === productSalesFilters.marketName : true;
      const pMatch = productSalesFilters.productName ? i.productName === productSalesFilters.productName : true;
      const dStart = productSalesFilters.dateStart ? iDate >= productSalesFilters.dateStart : true;
      const dEnd = productSalesFilters.dateEnd ? iDate <= productSalesFilters.dateEnd : true;
      return mMatch && pMatch && dStart && dEnd;
    });

    // aggregate
    const aggregated: Record<string, { productName: string, price: number, quantity: number, total: number }> = {};
    rawItems.forEach(i => {
      const key = `${i.productName}-${i.price}`;
      if(!aggregated[key]) aggregated[key] = { productName: i.productName, price: i.price, quantity: 0, total: 0 };
      aggregated[key].quantity += Number(i.quantity) || 0;
      aggregated[key].total += (Number(i.quantity) || 0) * (Number(i.price) || 0);
    });

    const finalArray = Object.values(aggregated).sort((a, b) => b.total - a.total);
    const totalQNum = finalArray.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalValNum = finalArray.reduce((acc, curr) => acc + curr.total, 0);

    return { items: finalArray, totalQuantity: totalQNum, totalValue: totalValNum };
  }, [sales, productSalesFilters]);

  const handleExportProductReport = () => {
    const flatData = productReportData.items.map(i => ({
      "الصنف": i.productName,
      "السعر": i.price,
      "الكمية المباعة": i.quantity,
      "الإجمالي": i.total
    }));
    
    // Add totals row
    flatData.push({
      "الصنف": "الإجمـــالــي",
      "السعر": "" as any,
      "الكمية المباعة": productReportData.totalQuantity,
      "الإجمالي": productReportData.totalValue
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Sales Report");
    XLSX.writeFile(wb, "SoftRose_Product_Sales.xlsx");
  };

  const handleExport = (dataToExport: DailySale[], fileName: string) => {
    const flatData = dataToExport.flatMap(s => (s.items || []).map(i => ({ 
      "الماركت": s.marketName, 
      "الموظف": s.userName, 
      "التاريخ": s.date?.split('T')[0], 
      "الصنف": i.productName, 
      "السعر": i.price, 
      "الكمية": i.quantity, 
      "الإجمالي": (Number(i.price || 0) * Number(i.quantity || 0))
    })));
    
    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("⚠️ هل أنت متأكد من حذف هذه العملية؟")) {
      remove(ref(db, `sales/${id}`));
    }
  };

  // Target management variables
  const proposedTarget = useMemo(() => {
    if(!targetMgmt.userId || !targetMgmt.marketName) return 0;
    
    // Calculate total sales for selected user & market in the previous 30 days (or all time / previous month)
    // Based on user: "from day 1 to day 30 of each month... previous month + growth"
    // For simplicity, let's calculate total historical sales for that branch and user for the previous month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startStr = lastMonth.toISOString().split('T')[0];
    const endStr = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    
    const relevantSales = sales.filter(s => 
      s.userId === targetMgmt.userId && 
      s.marketName === targetMgmt.marketName &&
      s.date >= startStr && s.date <= endStr
    );
    return relevantSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  }, [targetMgmt, sales]);

  const finalTarget = finalTargetOverride !== '' ? finalTargetOverride : (proposedTarget + (proposedTarget * (growthRate / 100)));

  const handleApproveTarget = async () => {
    if(!targetMgmt.userId || !targetMgmt.marketName) return alert("اختر الموظف والفرع");
    const yearMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Find if target exists
    const existing = targets.find(t => t.userId === targetMgmt.userId && t.marketName === targetMgmt.marketName && t.yearMonth === yearMonth);
    
    if(existing) {
      await update(ref(db, `targets/${existing.id}`), { targetValue: finalTarget });
    } else {
      await push(ref(db, `targets`), { 
        userId: targetMgmt.userId, 
        marketName: targetMgmt.marketName, 
        yearMonth, 
        targetValue: finalTarget 
      });
    }
    alert("تم اعتماد وتحديث التارجت بنجاح");
  };

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gray-600 text-white rounded-[1.5rem] shadow-lg shadow-gray-900/20"><History size={28} /></div>
          <div>
            <h2 className="text-2xl font-black text-white">سجل المبيعات</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Sales Management</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
           <button 
             onClick={() => setIsProductSalesOpen(true)} 
             className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-blue-500 transition-all"
           >
            <PackageSearch size={18}/> مبيعات صنف
          </button>
          
          {(user.role === 'admin' || user.role === 'coordinator') && (
            <button 
              onClick={() => setIsTargetMgmtOpen(true)} 
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-500 transition-all"
            >
              <Crosshair size={18}/> إدارة التارجت
            </button>
          )}

          <button 
            onClick={() => setIsCurrentTargetOpen(true)} 
            className="flex items-center gap-2 bg-amber-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-amber-500 transition-all"
          >
            <Target size={18}/> تارجت الشهر الحالي
          </button>

           <button 
            onClick={() => handleExport(filteredSales, "SoftRose_Filtered_Report")} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-gray-500 transition-all"
           >
            <Download size={18}/> تصدير
          </button>
          <button 
            onClick={() => handleExport(sales, "SoftRose_Full_History")} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 text-white/60 border border-white/10 px-6 py-3 rounded-2xl font-black text-xs hover:bg-white/10 transition-all"
          >
            <FileSpreadsheet size={18}/> السجل بالكامل
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card-dark p-6 rounded-[2.5rem] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="text-[10px] font-black text-white/30 uppercase block mb-2 mr-2">الموظف</label>
            <div className="relative">
              <select 
                className="w-full glass-input-dark rounded-xl p-4 text-xs font-bold outline-none border-transparent focus:border-gray-500/50 transition-all appearance-none"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              >
                <option value="" className="bg-gray-500">جميع الموظفين</option>
                {users.map((u, idx) => (
                  <option key={`${u.id}-${idx}`} value={u.employeeName} className="bg-gray-500">{u.employeeName}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-white/30 uppercase block mb-2 mr-2">من تاريخ</label>
            <input 
              type="date" 
              className="w-full glass-input-dark rounded-xl p-4 text-xs font-bold outline-none"
              value={filters.dateStart}
              onChange={(e) => setFilters({...filters, dateStart: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-white/30 uppercase block mb-2 mr-2">إلى تاريخ</label>
            <input 
              type="date" 
              className="w-full glass-input-dark rounded-xl p-4 text-xs font-bold outline-none"
              value={filters.dateEnd}
              onChange={(e) => setFilters({...filters, dateEnd: e.target.value})}
            />
          </div>
        </div>
        <div className="w-full">
          <select 
            className="w-full glass-input-dark rounded-xl p-4 text-xs font-bold outline-none border-transparent focus:border-gray-500/50 transition-all appearance-none"
            value={filters.marketName}
            onChange={(e) => setFilters({...filters, marketName: e.target.value})}
          >
            <option value="" className="bg-gray-500">-- اختر الماركت --</option>
            {markets.map((m, idx) => (
              <option key={`${m}-${idx}`} value={m} className="bg-gray-500">{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gradient-to-br from-gray-600 to-gray-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
          <Trophy className="absolute -right-6 -bottom-6 w-48 h-48 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10">
            <h3 className="font-black text-[10px] uppercase mb-6 flex items-center gap-2 tracking-[0.2em] text-gray-200">
              <Trophy className="text-amber-400" size={18} /> المتصدر للنتائج الحالية
            </h3>
            {stats.star ? (
              <div className="space-y-2">
                <p className="text-3xl font-black tracking-tight">{stats.star.name}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-amber-400">{(stats.star.total || 0).toLocaleString()}</span>
                  <span className="text-xs font-bold opacity-60 uppercase">EGP</span>
                </div>
              </div>
            ) : <p className="text-sm font-bold opacity-50 italic">لا توجد مبيعات في هذه الفترة</p>}
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-4">
        {filteredSales.map(sale => (
          <div key={sale.id} className="glass-card-dark rounded-[2.5rem] overflow-hidden group transition-all hover:bg-white/[0.05] border border-white/5">
            <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 border-b border-white/5">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3 bg-gray-600/10 px-4 py-2 rounded-xl">
                  <Store size={18} className="text-gray-500"/>
                  <span className="font-black text-white text-sm">{sale.marketName}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <CalendarIcon size={16} />
                  <span className="font-bold text-xs">{new Date(sale.date).toLocaleDateString('ar-EG', {day: 'numeric', month: 'long', year: 'numeric'})}</span>
                </div>
                <div className="flex items-center gap-3 text-white/60">
                  <UserIcon size={16} />
                  <span className="font-bold text-xs">{sale.userName}</span>
                </div>
              </div>
              {user.role === 'admin' && (
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedSale(sale); setIsEditing(true); }} className="p-3 bg-white/5 text-white/60 rounded-xl hover:bg-gray-500 hover:text-white transition-all"><Edit size={16}/></button>
                  <button onClick={() => handleDelete(sale.id)} className="p-3 bg-white/5 text-red-500/60 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                </div>
              )}
            </div>
            
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(sale.items || []).map((item, idx) => (
                  <div key={idx} className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col gap-2">
                    <span className="text-[10px] font-black text-white/40 truncate">{item.productName}</span>
                    <div className="flex justify-between items-end">
                      <div className="text-gray-400 font-black text-sm">{item.quantity} <span className="text-[9px] opacity-40">قطعة</span></div>
                      <div className="text-white font-bold text-xs">{(item.price * item.quantity).toLocaleString()} <span className="text-[8px] opacity-40">ج.م</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 p-6 md:px-8 flex justify-between items-center border-t border-white/5">
              <div className="flex items-center gap-3 text-white/20">
                <Clock size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{new Date(sale.date).toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Total Value</span>
                <span className="text-2xl font-black text-white">{(Number(sale.total) || 0).toLocaleString()} <span className="text-xs text-gray-500">ج.م</span></span>
              </div>
            </div>
          </div>
        ))}

        {filteredSales.length === 0 && (
          <div className="glass-card-dark py-32 rounded-[3.5rem] text-center border-dashed border-2 border-white/5">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 text-white/10">
              <History size={48} />
            </div>
            <p className="text-white/30 font-black text-sm uppercase tracking-[0.2em]">لا توجد نتائج مطابقة للبحث</p>
          </div>
        )}
      </div>

      {/* Edit Modal (Keeping existing logic) */}
      {selectedSale && isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-2xl overflow-hidden border border-white/10 animate-in zoom-in-95">
            <div className="bg-gray-900/50 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-black">تعديل سجل مبيعات</h3>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
              {/* Added grid-cols-5 to accommodate product name edit */}
              {(selectedSale.items || []).map((item, idx) => (
                <div key={idx} className="grid grid-cols-5 gap-4 p-5 bg-white/5 rounded-2xl items-center">
                  <input 
                    type="text" 
                    className="col-span-2 glass-input-dark p-3 rounded-xl text-xs font-bold outline-none" 
                    value={item.productName} 
                    onChange={(e) => {
                      const newItems = [...(selectedSale.items || [])];
                      newItems[idx].productName = e.target.value;
                      setSelectedSale({...selectedSale, items: newItems});
                    }}
                  />
                  <input 
                    type="number" 
                    className="glass-input-dark p-3 rounded-xl text-center text-xs font-black outline-none" 
                    value={item.price} 
                    onChange={(e) => {
                      const newItems = [...(selectedSale.items || [])];
                      newItems[idx].price = Number(e.target.value);
                      setSelectedSale({...selectedSale, items: newItems});
                    }}
                  />
                  <input 
                    type="number" 
                    className="glass-input-dark p-3 rounded-xl text-center text-xs font-black outline-none" 
                    value={item.quantity} 
                    onChange={(e) => {
                      const newItems = [...(selectedSale.items || [])];
                      newItems[idx].quantity = Number(e.target.value);
                      setSelectedSale({...selectedSale, items: newItems});
                    }}
                  />
                  <span className="text-left text-gray-400 font-black text-sm">{( (Number(item.price || 0)) * (Number(item.quantity || 0)) ).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="p-8 bg-white/5 flex justify-between items-center">
               <span className="text-2xl font-black text-white">{(selectedSale.items || []).reduce((acc, i) => acc + ( (Number(i.price || 0)) * (Number(i.quantity || 0)) ), 0).toLocaleString()} <span className="text-xs text-gray-500 uppercase">EGP</span></span>
               <button onClick={async () => {
                 const newTotal = (selectedSale.items || []).reduce((acc, i) => acc + ( (Number(i.price || 0)) * (Number(i.quantity || 0)) ), 0);
                 await update(ref(db, `sales/${selectedSale.id}`), { items: selectedSale.items, total: newTotal });
                 setIsEditing(false);
                 alert("تم تحديث السجل بنجاح");
               }} className="bg-gray-600 text-white px-12 py-4 rounded-2xl font-black shadow-lg shadow-gray-900/20 hover:bg-gray-500">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}

      {/* Product Sales Modal */}
      {isProductSalesOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden border border-white/10 flex flex-col animate-in zoom-in-95">
            <div className="bg-blue-900/50 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <PackageSearch className="text-blue-400" />
                <h3 className="text-lg font-black">تقرير مبيعات الأصناف</h3>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleExportProductReport} 
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-blue-500 transition-all"
                >
                  <Download size={14}/> تصدير إلى إكسيل
                </button>
                <button onClick={() => setIsProductSalesOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
              </div>
            </div>
            
            <div className="p-6 bg-white/5 grid grid-cols-1 md:grid-cols-4 gap-4">
               <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">اسم الصنف</label>
                  <select 
                    className="w-full glass-input-dark rounded-xl p-3 text-xs font-bold outline-none appearance-none"
                    value={productSalesFilters.productName}
                    onChange={e => setProductSalesFilters({...productSalesFilters, productName: e.target.value})}
                  >
                    <option value="" className="bg-gray-500">جميع الأصناف</option>
                    {uniqueProducts.map((p, idx) => <option key={`${p}-${idx}`} value={p} className="bg-gray-500">{p}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">اسم الماركت</label>
                  <select 
                    className="w-full glass-input-dark rounded-xl p-3 text-xs font-bold outline-none appearance-none"
                    value={productSalesFilters.marketName}
                    onChange={e => setProductSalesFilters({...productSalesFilters, marketName: e.target.value})}
                  >
                    <option value="" className="bg-gray-500">جميع الماركتات</option>
                    {markets.map((m, idx) => <option key={`${m}-${idx}`} value={m} className="bg-gray-500">{m}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">من تاريخ</label>
                  <input 
                    type="date" 
                    className="w-full glass-input-dark rounded-xl p-3 text-xs font-bold outline-none"
                    value={productSalesFilters.dateStart}
                    onChange={e => setProductSalesFilters({...productSalesFilters, dateStart: e.target.value})}
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">إلى تاريخ</label>
                  <input 
                    type="date" 
                    className="w-full glass-input-dark rounded-xl p-3 text-xs font-bold outline-none"
                    value={productSalesFilters.dateEnd}
                    onChange={e => setProductSalesFilters({...productSalesFilters, dateEnd: e.target.value})}
                  />
               </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col justify-center items-center text-center">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">الكمية المباعة</span>
                <span className="text-4xl font-black text-blue-400">{productReportData.totalQuantity.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex flex-col justify-center items-center text-center">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">القيمة الإجمالية</span>
                <span className="text-4xl font-black text-emerald-400">{productReportData.totalValue.toLocaleString()} <span className="text-sm">ج.م</span></span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0 custom-scrollbar">
               <table className="w-full text-sm text-right">
                 <thead>
                   <tr className="border-b border-white/10 text-white/40 font-bold">
                     <th className="py-4">الصنف</th>
                     <th className="py-4 text-center">السعر</th>
                     <th className="py-4 text-center">الكمية</th>
                     <th className="py-4 text-left">الإجمالي</th>
                   </tr>
                 </thead>
                 <tbody>
                   {productReportData.items.map((i, idx) => (
                     <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] font-bold">
                       <td className="py-4">{i.productName}</td>
                       <td className="py-4 text-center text-white/60">{i.price}</td>
                       <td className="py-4 text-center text-blue-300">{i.quantity}</td>
                       <td className="py-4 text-left text-emerald-400">{i.total.toLocaleString()}</td>
                     </tr>
                   ))}
                   {productReportData.items.length === 0 && (
                     <tr><td colSpan={4} className="py-8 text-center text-white/20">لا توجد مبيعات مطابقة للبحث</td></tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {/* Target Management Modal */}
      {isTargetMgmtOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-lg overflow-hidden border border-white/10 animate-in zoom-in-95">
            <div className="bg-emerald-900/50 p-6 text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                 <Crosshair className="text-emerald-400" />
                 <h3 className="text-lg font-black">إدارة التارجت</h3>
               </div>
               <button onClick={() => {setIsTargetMgmtOpen(false); setGrowthRate(0); setFinalTargetOverride('');}} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">اختر الفرع</label>
                  <select 
                    className="w-full glass-input-dark rounded-xl p-4 text-sm font-bold outline-none appearance-none"
                    value={targetMgmt.marketName}
                    onChange={e => {setTargetMgmt({...targetMgmt, marketName: e.target.value}); setGrowthRate(0); setFinalTargetOverride('');}}
                  >
                    <option value="" className="bg-gray-500">-- الفروع المسجلة --</option>
                    {markets.map((m, idx) => <option key={`${m}-${idx}`} value={m} className="bg-gray-500">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-white/30 uppercase block mb-2">اختر الموظف</label>
                  <select 
                    className="w-full glass-input-dark rounded-xl p-4 text-sm font-bold outline-none appearance-none"
                    value={targetMgmt.userId}
                    onChange={e => {setTargetMgmt({...targetMgmt, userId: e.target.value}); setGrowthRate(0); setFinalTargetOverride('');}}
                  >
                    <option value="" className="bg-gray-500">-- الموظفين --</option>
                    {users.map((u, idx) => <option key={`${u.id}-${idx}`} value={u.id} className="bg-gray-500">{u.employeeName}</option>)}
                  </select>
                </div>
              </div>

              {targetMgmt.userId && targetMgmt.marketName && (
                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl flex justify-between items-center">
                     <span className="text-xs font-bold text-white/60">التارجت المقترح الشهري</span>
                     <span className="font-black text-white text-lg">{proposedTarget.toLocaleString()} <span className="text-[10px] text-white/30">ج.م</span></span>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-white/30 uppercase block mb-2">نسبة النمو (%)</label>
                    <input 
                      type="number" 
                      className="w-full glass-input-dark rounded-xl p-4 text-sm font-bold outline-none"
                      value={growthRate}
                      onChange={e => {setGrowthRate(Number(e.target.value)); setFinalTargetOverride('');}}
                      min={0}
                    />
                  </div>

                  <div className="bg-emerald-600/20 border border-emerald-500/30 p-5 rounded-2xl">
                     <label className="text-[10px] font-black text-emerald-300 uppercase block mb-2">التارجت النهائي المعتمد</label>
                     <div className="flex items-center gap-3">
                       <input 
                         type="number" 
                         className="flex-1 bg-transparent border-b-2 border-emerald-500/50 text-2xl font-black text-emerald-400 outline-none p-2"
                         value={finalTarget}
                         onChange={e => setFinalTargetOverride(e.target.value === '' ? '' : Number(e.target.value))}
                       />
                       <span className="text-emerald-500 font-bold">ج.م</span>
                     </div>
                  </div>
                  
                  <button 
                    onClick={handleApproveTarget} 
                    className="w-full py-4 mt-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                  >
                     <Plus size={20} />
                     اعتماد وإضافة التارجت
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCurrentTargetOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-4xl overflow-hidden border border-white/10 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="bg-amber-900/50 p-6 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3">
                 <Target className="text-amber-400" />
                 <h3 className="text-lg font-black">تارجت الشهر الحالي</h3>
               </div>
               <button onClick={() => setIsCurrentTargetOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl mb-6">
                <button 
                  onClick={() => setTargetMonthOffset(prev => prev + 1)} 
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                >
                  <ChevronRight size={20} className="text-white" />
                </button>
                <div className="text-center">
                  <span className="block text-[10px] text-white/50 uppercase tracking-widest mb-1">فترة التارجت</span>
                  <span className="font-black text-amber-400">{currentTargetStats.label}</span>
                </div>
                <button 
                  onClick={() => setTargetMonthOffset(prev => prev - 1)} 
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                >
                  <ChevronLeft size={20} className="text-white" />
                </button>
              </div>

              <div className="space-y-4">
                {currentTargetStats.list.length > 0 ? currentTargetStats.list.map((t, idx) => (
                  <div key={idx} className="bg-white/5 p-4 md:p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/5 hover:border-amber-500/20 transition-all">
                    <div className="flex items-center gap-4 text-left md:text-right w-full md:w-auto">
                      <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center font-black shrink-0">
                        {t.empName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{t.empName}</h4>
                        <span className="text-[10px] text-white/40 block mt-1"><Store size={10} className="inline mr-1"/> {t.market}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-1 items-center justify-around gap-4 w-full bg-black/20 p-4 rounded-2xl">
                      <div className="text-center">
                         <span className="block text-[10px] text-white/30 uppercase mb-1">التارجت</span>
                         <span className="font-black text-white">{t.target.toLocaleString()}</span>
                      </div>
                      <div className="text-center">
                         <span className="block text-[10px] text-white/30 uppercase mb-1">المحقق</span>
                         <span className="font-black text-emerald-400">{t.ach.toLocaleString()}</span>
                      </div>
                      <div className="text-center">
                         <span className="block text-[10px] text-white/30 uppercase mb-1">النسبة</span>
                         <span className={`font-black ${t.perc >= 100 ? 'text-emerald-400' : 'text-amber-400'} flex items-center justify-center gap-1`}>
                           {t.perc.toFixed(1)}% {t.perc >= 100 && <TrendingUp size={14} />}
                         </span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center p-12 bg-white/5 border border-white/10 rounded-3xl">
                    <Target className="w-16 h-16 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40 font-bold">لم يتم تسجيل أي تارجت لهذه الفترة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
