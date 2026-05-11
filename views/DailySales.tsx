
import React, { useState, useEffect, useMemo } from 'react';
import { User, SaleItem, TargetRecord, DailySale } from '../types';
import { PRODUCT_GROUPS } from '../constants';
import { ShoppingBag, Save, PlusCircle, Trash2, Edit2, Plus, Target } from 'lucide-react';
import { db, ref, push, onValue, update, remove, set } from '../firebase';

interface Props {
  user: User;
  markets: string[];
}

const DailySales: React.FC<Props> = ({ user, markets }) => {
  const [selectedMarket, setSelectedMarket] = useState('');
  const [items, setItems] = useState<SaleItem[]>([]);
  const [dbProducts, setDbProducts] = useState<Record<string, {category: string, name: string}>>({});
  
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [allSales, setAllSales] = useState<DailySale[]>([]);

  useEffect(() => {
    const unsubProducts = onValue(ref(db, 'products'), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setDbProducts(data);
        
        setItems(prevItems => {
          const newItems: SaleItem[] = [];
          Object.entries(data).forEach(([id, prod]: any) => {
            const existing = prevItems.find(i => i.id === id);
            newItems.push({
              id,
              category: prod.category,
              productName: prod.name,
              price: existing ? existing.price : 0,
              quantity: existing ? existing.quantity : 0
            });
          });
          return newItems;
        });
      } else {
        const initialProducts: Record<string, any> = {};
        Object.entries(PRODUCT_GROUPS).forEach(([cat, productsList]) => {
          productsList.forEach((p, index) => {
            initialProducts[`${cat}-${index}-${Date.now()}`] = { category: cat, name: p };
          });
        });
        update(ref(db, 'products'), initialProducts);
      }
    });

    const unsubTargets = onValue(ref(db, 'targets'), snapshot => {
      const data = snapshot.val();
      if(data) {
        setTargets(Object.entries(data).map(([id, val]: any) => ({ ...val, id })));
      } else {
        setTargets([]);
      }
    });

    const unsubSales = onValue(ref(db, 'sales'), snapshot => {
      const data = snapshot.val();
      if(data) {
        const salesList = Object.entries(data).map(([id, val]: any) => ({ ...val, id }));
        // Only need current user's sales this month to calculate achievement
        const currentMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const userSales = salesList.filter(s => s.userId === user.id && s.date.startsWith(currentMonth));
        setAllSales(userSales);
      } else {
        setAllSales([]);
      }
    });

    return () => {
      unsubProducts();
      unsubTargets();
      unsubSales();
    };
  }, [user.id]);

  const currentTarget = useMemo(() => {
    if(!selectedMarket) return null;
    const yearMonth = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    const target = targets.find(t => t.userId === user.id && t.marketName === selectedMarket && t.yearMonth === yearMonth);
    
    if(!target) return null;
    
    const achieved = allSales.filter(s => s.marketName === selectedMarket).reduce((sum, s) => sum + Number(s.total || 0), 0);
    const remaining = Math.max(0, target.targetValue - achieved);
    
    return {
      targetValue: target.targetValue,
      achieved,
      remaining,
      progress: Math.min(100, (achieved / target.targetValue) * 100)
    };
  }, [selectedMarket, targets, allSales, user.id]);

  const updateItem = (id: string, field: keyof SaleItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async () => {
    if (!selectedMarket) return alert("يرجى اختيار الماركت");
    const validItems = items.filter(i => i.quantity > 0 && i.price > 0);
    if (validItems.length === 0) return alert("يرجى إدخال بيانات صنف واحد على الأقل");

    const total = validItems.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    await push(ref(db, 'sales'), { userId: user.id, userName: user.employeeName, marketName: selectedMarket, date: new Date().toISOString(), items: validItems, total });
    alert("تم الحفظ والترحيل");
    setSelectedMarket('');
    
    setItems(prev => prev.map(i => ({ ...i, price: 0, quantity: 0 })));
  };

  // Admin handers
  const handleAddMarket = async () => {
    const marketName = prompt("أدخل اسم الماركت الجديد:");
    if (marketName && marketName.trim()) {
      await push(ref(db, 'markets'), { name: marketName.trim(), creatorId: user.id });
    }
  };

  const handleAddProduct = async (cat: string) => {
    const name = prompt("أدخل اسم المنتج الجديد:");
    if (name && name.trim()) {
      const id = Date.now().toString();
      await set(ref(db, `products/${id}`), { category: cat, name: name.trim() });
    }
  };

  const handleEditProduct = async (id: string, currentName: string) => {
    const newName = prompt("تعديل اسم المنتج:", currentName);
    if (newName && newName.trim() && newName !== currentName) {
      await update(ref(db, `products/${id}`), { name: newName.trim() });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا المنتج نهائياً؟")) {
      await remove(ref(db, `products/${id}`));
    }
  };

  const categoriesMap: Record<string, string> = {
    facial: 'مناديل سحب (Facial)',
    kitchen: 'مناديل مطبخ (Kitchen)',
    hotel_toilet: 'تواليت فنادق (Toilet)',
    dolphin: 'دولفن (Dolphin)'
  };

  return (
    <div className="max-w-7xl mx-auto pb-4 text-right relative" dir="rtl">
      <div className="space-y-8 pb-32">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-gradient-to-br from-gray-900/60 to-gray-700/20 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden relative">
          <div className="flex items-center gap-5 relative z-10">
            <div className="p-4 bg-white/5 rounded-3xl border border-white/10"><ShoppingBag className="text-gray-400" size={32} /></div>
            <div>
              <h2 className="text-xl md:text-3xl font-black text-white">المبيعات اليومية</h2>
              <p className="text-[10px] font-bold text-gray-300 uppercase mt-1 opacity-60">Daily Sales Entry</p>
            </div>
          </div>
          <div className="text-4xl md:text-7xl font-black text-white">
            {items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toLocaleString()} <span className="text-sm opacity-40">ج.م</span>
          </div>
        </div>
        
        <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-xl flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 mr-2">اختيار الماركت الحالي</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 outline-none font-bold text-white shadow-inner" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
              <option value="" className="bg-gray-500">-- اضغط لاختيار الماركت --</option>
              {markets.map(m => <option key={m} value={m} className="bg-gray-500">{m}</option>)}
            </select>
          </div>
          {user.role === 'admin' && (
            <button
              onClick={handleAddMarket}
              className="py-4 px-6 bg-gray-600/30 text-gray-100 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-600/50 transition-all border border-gray-500/30"
            >
              <PlusCircle size={20} />
              اضف ماركت
            </button>
          )}
        </div>

        {currentTarget && (
          <div className="p-6 bg-gradient-to-l from-emerald-900/40 to-emerald-700/10 rounded-[2rem] border border-emerald-500/20 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4 text-emerald-300">
              <Target size={20}/>
              <h3 className="font-black text-sm uppercase tracking-widest">تارجت الشهر الحالي ({selectedMarket})</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-white/50 mb-1">التارجت</span>
                <span className="font-black text-white text-lg">{currentTarget.targetValue.toLocaleString()} <span className="text-[10px] text-emerald-400 opacity-60">ج.م</span></span>
              </div>
              <div className="bg-emerald-500/20 border border-emerald-500/30 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-emerald-200 mb-1">المحقق</span>
                <span className="font-black text-emerald-400 text-lg">{currentTarget.achieved.toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></span>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-white/50 mb-1">المتبقي</span>
                <span className="font-black text-white/80 text-lg">{currentTarget.remaining.toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 bg-white/10 h-2 rounded-full overflow-hidden">
               <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{width: `${currentTarget.progress}%`}}></div>
            </div>
          </div>
        )}

        <div className="space-y-12">
          {Object.entries(categoriesMap).map(([cat, title]) => (
            <div key={cat} className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-gray-100 flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gray-600 rounded-full"/> 
                  {title}
                </h3>
                {user.role === 'admin' && (
                  <button
                    onClick={() => handleAddProduct(cat)}
                    className="flex items-center gap-1 text-xs font-bold text-gray-300 bg-gray-500/10 px-3 py-1.5 rounded-lg hover:bg-gray-500/30 transition-all border border-gray-500/20"
                  >
                    <Plus size={14} /> اضف منتج
                  </button>
                )}
              </div>
              
              <div className="w-full pb-2">
                <div className="space-y-2 w-full">
                  {items.filter(i => i.category === cat).map(item => (
                    <div key={item.id} className="p-2 md:p-3 bg-white/[0.02] border border-white/5 rounded-xl md:rounded-2xl flex items-center justify-between gap-1 md:gap-3 hover:border-gray-500/30 transition-all w-full">
                      
                      <span className="flex-1 font-bold text-[9px] md:text-sm text-white/90 leading-tight">
                        {item.productName}
                      </span>
                      
                      <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        <input type="number" placeholder="السعر" className="w-12 md:w-20 glass-input-dark rounded-lg md:rounded-xl p-1.5 md:p-2 text-center font-bold text-[10px] md:text-sm outline-none shrink-0" value={item.price || ''} onChange={e => updateItem(item.id, 'price', Number(e.target.value))}/>
                        <input type="number" placeholder="العدد" className={`w-12 md:w-20 rounded-lg md:rounded-xl p-1.5 md:p-2 text-center font-black text-[10px] md:text-sm border outline-none shrink-0 ${item.quantity > 0 ? 'bg-gray-600 border-gray-400 text-white' : 'bg-white/5 border-white/10'}`} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}/>
                        
                        <div className="w-14 md:w-24 text-center border-r border-white/5 pr-1 md:pr-2 shrink-0">
                          <span className="block text-[7px] md:text-[8px] text-white/40 uppercase mb-0.5 whitespace-nowrap">الاجمالي</span>
                          <span className="font-black text-gray-300 text-[10px] md:text-sm truncate block">
                            {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {user.role === 'admin' && (
                        <div className="flex items-center gap-0.5 md:gap-1 shrink-0 border-r border-white/10 pr-1 md:pr-3">
                          <button onClick={() => handleEditProduct(item.id, item.productName)} className="p-1 md:p-2 bg-blue-500/10 text-blue-400 rounded-md md:rounded-lg hover:bg-blue-500/30 transition-all" title="تعديل">
                            <Edit2 className="w-3 h-3 md:w-4 md:h-4" />
                          </button>
                          <button onClick={() => handleDeleteProduct(item.id)} className="p-1 md:p-2 bg-red-500/10 text-red-500 rounded-md md:rounded-lg hover:bg-red-500/30 transition-all" title="حذف">
                            <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.filter(i => i.category === cat).length === 0 && (
                     <div className="p-4 text-center text-white/30 text-xs font-bold bg-white/[0.01] rounded-2xl border border-white/5 w-full">
                        لا يوجد منتجات في هذا القسم
                     </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Sticky Save Button */}
      <div className="sticky bottom-6 z-50 flex justify-center mt-[-60px] pointer-events-none">
         <button 
            onClick={handleSave} 
            className="w-full sm:w-2/3 md:w-1/2 max-w-sm py-4 bg-gray-600 text-white rounded-[1.5rem] font-black text-lg shadow-[0_0_40px_rgba(225,29,72,0.4)] hover:bg-gray-500 active:scale-95 transition-all flex items-center justify-center gap-3 border border-gray-400/30 backdrop-blur-md pointer-events-auto"
          >
            <Save size={24} />
            حفظ وترحيل البيانات
         </button>
      </div>
    </div>
  );
};

export default DailySales;
