
import React, { useState, useEffect, useMemo } from 'react';
import { User, Vacation } from '../types';
import { db, ref, onValue, push, set, remove, update } from '../firebase';
import { Calendar, Plus, Trash2, History, X, Edit, Save, ChevronRight, ChevronLeft, Download, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
  users: User[];
  vacations: Vacation[];
}

const VacationManagement: React.FC<Props> = ({ user, users, vacations }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState<{ userId: string, type: string, userName: string } | null>(null);
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);
  const [currentPeriodDate, setCurrentPeriodDate] = useState(new Date());

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState({ userId: '', dateStart: '', dateEnd: '' });

  const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
  const [editingBalanceUser, setEditingBalanceUser] = useState<User | null>(null);
  const [newBalances, setNewBalances] = useState<any>({ annual: 0, casual: 0, absent_with_permission: 0, absent_without_permission: 0, exams: 0 });
  
  const [newVacation, setNewVacation] = useState({
    date: new Date().toISOString().split('T')[0],
    days: 1,
    type: 'annual' as const,
    targetUserId: user.id
  });

  const handleExportExcel = () => {
    let filtered = vacations;
    if (exportFilters.userId && exportFilters.userId !== 'all') {
      filtered = filtered.filter(v => v.userId === exportFilters.userId);
    }
    if (exportFilters.dateStart) {
      filtered = filtered.filter(v => v.date >= exportFilters.dateStart);
    }
    if (exportFilters.dateEnd) {
      filtered = filtered.filter(v => v.date <= exportFilters.dateEnd);
    }
    
    // Group by user, sorting chronologically
    filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const typeMap: Record<string, string> = {
      'annual': 'اجازه سنوي',
      'casual': 'اجازه عارضه',
      'absent_with_permission': 'غياب باذن تخصم من الراتب',
      'absent_without_permission': 'بدون إذن',
      'exam': 'اجازه امتحانات'
    };

    const data = filtered.map(v => ({
      "إسم الموظف": v.userName,
      "التاريخ": new Date(v.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }),
      "نوع الإجازة": typeMap[v.type] || v.type,
      "المدة (أيام)": v.days
    }));

    if (data.length === 0) {
      alert("لا يوجد بيانات للتصدير");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vacations");
    XLSX.writeFile(wb, `Vacations_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setIsExportModalOpen(false);
  };

  const handleSaveBalance = async () => {
    if (!editingBalanceUser) return;
    await update(ref(db, `users/${editingBalanceUser.id}`), { vacationBalance: newBalances });
    setIsEditBalanceModalOpen(false);
    setEditingBalanceUser(null);
    alert("✅ تم تعديل الأرصدة بنجاح");
  };

  // Sorting: Chronological (Start to End of Month)
  const sortedVacations = useMemo(() => {
    return [...vacations].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [vacations]);

  const handleAddVacation = async () => {
    const targetUserId = user.role === 'admin' ? newVacation.targetUserId : user.id;
    
    // Duplicate check for date
    const isDuplicate = vacations.some(v => v.userId === targetUserId && v.date === newVacation.date && v.id !== (editingVacation?.id || ''));
    if (isDuplicate) {
      alert("⚠️ تم تسجيل اليوم من قبل للموظف");
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId) || user;
    const currentBalance = targetUser.vacationBalance || { annual: 14, casual: 7, sick: 0, absent_with_permission: 0, absent_without_permission: 0 };
    let updatedBalance = { ...currentBalance };
    
    // Logic: If editing, FIRST return old days to balance
    if (editingVacation) {
        if (editingVacation.type === 'annual') updatedBalance.annual += Number(editingVacation.days);
        else if (editingVacation.type === 'casual') updatedBalance.casual += Number(editingVacation.days);
        else if (editingVacation.type === 'absent_with_permission') updatedBalance.absent_with_permission = (updatedBalance.absent_with_permission || 0) + Number(editingVacation.days);
        else if (editingVacation.type === 'absent_without_permission') updatedBalance.absent_without_permission = (updatedBalance.absent_without_permission || 0) - Number(editingVacation.days);
        else if (editingVacation.type === 'exam') updatedBalance.exams = (updatedBalance.exams || 0) + Number(editingVacation.days);
    }

    // Logic: Apply NEW deduction
    if (newVacation.type === 'annual') updatedBalance.annual -= newVacation.days;
    else if (newVacation.type === 'casual') updatedBalance.casual -= newVacation.days;
    else if (newVacation.type === 'absent_with_permission') updatedBalance.absent_with_permission = (updatedBalance.absent_with_permission || 0) - newVacation.days;
    else if (newVacation.type === 'absent_without_permission') updatedBalance.absent_without_permission = (updatedBalance.absent_without_permission || 0) + newVacation.days;
    else if (newVacation.type === 'exam') updatedBalance.exams = (updatedBalance.exams || 0) - newVacation.days;

    await update(ref(db, `users/${targetUser.id}`), { vacationBalance: updatedBalance });

    if (editingVacation) {
        await update(ref(db, `vacations/${editingVacation.id}`), { ...newVacation, userId: targetUser.id, userName: targetUser.employeeName });
    } else {
        await push(ref(db, 'vacations'), { ...newVacation, userId: targetUser.id, userName: targetUser.employeeName, createdAt: new Date().toISOString() });
    }
    
    setIsModalOpen(false);
    setEditingVacation(null);
    alert("✅ تم الحفظ بنجاح");
  };

  const handleDeleteVacation = async (id: string) => {
    if (window.confirm("⚠️ هل أنت متأكد؟ سيتم استرداد الأيام للرصيد فوراً.")) {
      const vToDelete = vacations.find(v => v.id === id);
      if (vToDelete) {
        const targetUser = users.find(u => u.id === vToDelete.userId);
        if (targetUser) {
          let updatedBalance = { ...targetUser.vacationBalance };
          if (vToDelete.type === 'annual') updatedBalance.annual += Number(vToDelete.days);
          else if (vToDelete.type === 'casual') updatedBalance.casual += Number(vToDelete.days);
          else if (vToDelete.type === 'absent_with_permission') updatedBalance.absent_with_permission = (updatedBalance.absent_with_permission || 0) + Number(vToDelete.days);
          else if (vToDelete.type === 'absent_without_permission') updatedBalance.absent_without_permission = (updatedBalance.absent_without_permission || 0) - Number(vToDelete.days);
          await update(ref(db, `users/${targetUser.id}`), { vacationBalance: updatedBalance });
        }
      }
      await remove(ref(db, `vacations/${id}`));
    }
  };

  const currentRange = useMemo(() => {
    const d = new Date(currentPeriodDate);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }, [currentPeriodDate]);

  const filteredDetails = useMemo(() => {
    if (!selectedDetails) return [];
    return sortedVacations.filter(v => {
      const vDate = new Date(v.date);
      return v.type === selectedDetails.type && v.userId === selectedDetails.userId && vDate >= currentRange.start && vDate <= currentRange.end;
    });
  }, [selectedDetails, sortedVacations, currentRange]);

  return (
    <div className="space-y-6 pb-20 text-right" dir="rtl">
      <div className="glass-card-dark p-6 md:p-8 rounded-[2rem]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-600 text-white rounded-2xl shadow-lg"><Calendar size={24}/></div>
            <div>
              <h2 className="text-2xl font-black text-white">إدارة أرصدة الإجازات</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Vacation Balance Hub</p>
            </div>
          </div>
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
            <button 
              onClick={() => setIsExportModalOpen(true)}
              className="w-full md:w-auto bg-white/10 text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all hover:bg-white/20 active:scale-95"
            >
              <Download size={20}/> تصدير
            </button>
            <button 
              onClick={() => { setIsModalOpen(true); setEditingVacation(null); }}
              className="w-full md:w-auto bg-gray-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all active:scale-95"
            >
              <Plus size={20}/> تسجيل إجازة
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(user.role === 'admin' ? users : users.filter(u => u.id === user.id)).map(u => (
            <div key={u.id} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 group relative">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-900/40 rounded-2xl flex items-center justify-center text-gray-400 font-black">{u.employeeName?.charAt(0)}</div>
                  <p className="font-black text-white">{u.employeeName}</p>
                </div>
                {user.role === 'admin' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingBalanceUser(u);
                        setNewBalances({ ...u.vacationBalance } || { annual: 14, casual: 7, absent_with_permission: 0, absent_without_permission: 0, exams: 0 });
                        setIsEditBalanceModalOpen(true);
                      }} 
                      className="p-2 text-blue-400 hover:bg-white/10 rounded-xl transition-all"
                    >
                      <Edit2 size={16}/>
                    </button>
                    <button onClick={() => { if(window.confirm(`حذف الموظف ${u.employeeName}؟`)) remove(ref(db, `users/${u.id}`)); }} className="p-2 text-red-500 hover:bg-white/10 rounded-xl transition-all"><Trash2 size={16}/></button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'سنوي', type: 'annual', balance: u.vacationBalance?.annual ?? 0, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'عارضة', type: 'casual', balance: u.vacationBalance?.casual ?? 0, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'بإذن', type: 'absent_with_permission', balance: u.vacationBalance?.absent_with_permission ?? 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'بدون إذن', type: 'absent_without_permission', balance: u.vacationBalance?.absent_without_permission ?? 0, color: 'text-purple-400', bg: 'bg-purple-500/10' }
                ].map(box => (
                  <button 
                    key={box.type}
                    onClick={() => { setSelectedDetails({ userId: u.id, type: box.type, userName: u.employeeName }); }}
                    className={`${box.bg} p-3 rounded-2xl flex flex-col items-center justify-center border border-transparent hover:border-white/20`}
                  >
                    <span className={`text-[8px] font-black uppercase ${box.color} mb-1`}>{box.label}</span>
                    <span className={`text-xl font-black ${box.color}`}>{box.balance}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-lg overflow-hidden border border-white/10 animate-in zoom-in-95">
            <div className="bg-gray-900/80 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <History size={20}/>
                <h3 className="text-lg font-black">سجل إجازات {selectedDetails.userName}</h3>
              </div>
              <button onClick={() => setSelectedDetails(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
            </div>
            
            <div className="p-4 bg-white/5 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button onClick={() => { const d = new Date(currentPeriodDate); d.setMonth(d.getMonth()-1); setCurrentPeriodDate(d); }} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={18}/></button>
                <span className="text-xs font-black">{currentPeriodDate.toLocaleDateString('ar-EG', {month: 'long', year: 'numeric'})}</span>
                <button onClick={() => { const d = new Date(currentPeriodDate); d.setMonth(d.getMonth()+1); setCurrentPeriodDate(d); }} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={18}/></button>
              </div>
              <span className="text-[10px] font-black opacity-40 uppercase">History List</span>
            </div>

            <div className="max-h-[40vh] overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {filteredDetails.length === 0 ? (
                <p className="text-center opacity-40 py-10 font-bold italic">لا توجد سجلات حالية</p>
              ) : (
                filteredDetails.map(v => (
                  <div key={v.id} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center group border border-white/5 hover:border-gray-500/20 transition-all">
                    <div>
                      <span className="block text-xs font-black text-white">{new Date(v.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                      <span className="block text-[10px] font-bold text-gray-400 mt-1">المدة: {v.days} يوم</span>
                    </div>
                    {(user.role === 'admin' || user.id === v.userId) && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { 
                            setEditingVacation(v); 
                            setNewVacation({ date: v.date, days: v.days, type: v.type as any, targetUserId: v.userId }); 
                            setSelectedDetails(null); 
                            setIsModalOpen(true); 
                          }} 
                          className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                          title="تعديل"
                        >
                          <Edit size={16}/>
                        </button>
                        <button 
                          onClick={() => handleDeleteVacation(v.id)} 
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                          title="حذف"
                        >
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="p-6 bg-white/5 flex gap-3">
               <button onClick={() => setSelectedDetails(null)} className="w-full bg-gray-600 text-white py-4 rounded-2xl font-black text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-md p-8 animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-white mb-8">{editingVacation ? 'تعديل إجازة' : 'تسجيل إجازة جديدة'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الموظف</label>
                <select className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10" value={newVacation.targetUserId} onChange={(e) => setNewVacation({...newVacation, targetUserId: e.target.value})} disabled={user.role !== 'admin'}>
                  {users.map(u => <option key={u.id} value={u.id} className="bg-gray-500">{u.employeeName}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-white/30 mb-2">التاريخ</label>
                  <input type="date" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none text-sm" value={newVacation.date} onChange={(e) => setNewVacation({...newVacation, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-white/30 mb-2">المدة (أيام)</label>
                  <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newVacation.days} onChange={(e) => setNewVacation({...newVacation, days: Number(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">نوع الطلب</label>
                <select className="w-full glass-input-dark rounded-xl p-4 font-bold border border-white/10" value={newVacation.type} onChange={(e) => setNewVacation({...newVacation, type: e.target.value as any})}>
                  <option value="annual" className="bg-gray-500">اجازه سنوي</option>
                  <option value="casual" className="bg-gray-500">اجازه عارضه</option>
                  <option value="absent_with_permission" className="bg-gray-500">غياب باذن تخصم من الراتب</option>
                  <option value="exam" className="bg-gray-500">اجازه امتحانات</option>
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={handleAddVacation} className="flex-1 bg-gray-600 text-white py-4 rounded-xl font-black shadow-lg flex items-center justify-center gap-2"><Save size={18}/> {editingVacation ? 'تحديث' : 'تأكيد'}</button>
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-white/5 text-white/40 py-4 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-md p-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-2"><Download size={24}/> تصدير إكسيل</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"><X size={24}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الفترة من</label>
                <input type="date" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={exportFilters.dateStart} onChange={(e) => setExportFilters({...exportFilters, dateStart: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الفترة إلى</label>
                <input type="date" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={exportFilters.dateEnd} onChange={(e) => setExportFilters({...exportFilters, dateEnd: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">الموظف</label>
                <select className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none border border-white/10" value={exportFilters.userId} onChange={(e) => setExportFilters({...exportFilters, userId: e.target.value})}>
                  <option value="all" className="bg-gray-500">جميع الموظفين</option>
                  {(user.role === 'admin' ? users : users.filter(u => u.id === user.id)).map(u => <option key={u.id} value={u.id} className="bg-gray-500">{u.employeeName}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={handleExportExcel} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black shadow-lg">تصدير</button>
            </div>
          </div>
        </div>
      )}

      {isEditBalanceModalOpen && editingBalanceUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] w-full max-w-md p-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-white flex items-center gap-2"><Edit2 size={24}/> تعديل أرصدة {editingBalanceUser.employeeName}</h3>
              <button onClick={() => { setIsEditBalanceModalOpen(false); setEditingBalanceUser(null); }} className="p-2 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"><X size={24}/></button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">سنوي</label>
                <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newBalances.annual || 0} onChange={(e) => setNewBalances({...newBalances, annual: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">عارضة</label>
                <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newBalances.casual || 0} onChange={(e) => setNewBalances({...newBalances, casual: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">بإذن (تخصم من الراتب)</label>
                <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newBalances.absent_with_permission || 0} onChange={(e) => setNewBalances({...newBalances, absent_with_permission: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">بدون إذن</label>
                <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newBalances.absent_without_permission || 0} onChange={(e) => setNewBalances({...newBalances, absent_without_permission: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 mb-2">امتحانات</label>
                <input type="number" className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none" value={newBalances.exams || 0} onChange={(e) => setNewBalances({...newBalances, exams: Number(e.target.value)})} />
              </div>
            </div>
            <div className="mt-8">
              <button onClick={handleSaveBalance} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VacationManagement;
