
import React, { useState } from 'react';
import { User, AppSettings, Market, Company, UserRole, UserPermissions } from '../types';
import { db, ref, update, set, push, remove } from '../firebase';
import { 
  Save, UserPlus, Shield, Store, Building2, UserCog, Trash2, Edit, Key, Mail, Trophy, Zap, Plus, Settings as SettingsIcon, X, CheckCircle2, Upload, Edit2
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
  settings: AppSettings | null;
  users: User[];
  markets: Market[];
  companies: Company[];
}

const Settings: React.FC<Props> = ({ user, settings, users = [], markets = [], companies = [] }) => {
  if (user.role !== 'admin') return <div className="text-center py-20 font-black">عذراً، للمديرين فقط</div>;

  const [activeSubTab, setActiveSubTab] = useState('general');
  const [newTickerText, setNewTickerText] = useState(settings?.tickerText || '');
  const [whatsapp, setWhatsapp] = useState(settings?.whatsappNumber || '');
  const [isTickerAnimated, setIsTickerAnimated] = useState(settings?.isTickerAnimated || false);
  
  const [editingPermissions, setEditingPermissions] = useState<User | null>(null);
  const [editingCredentials, setEditingCredentials] = useState<User | null>(null);
  const [messageTarget, setMessageTarget] = useState<User | null>(null);
  const [msgText, setMsgText] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [selectedCompForExcel, setSelectedCompForExcel] = useState('');

  const handleUpdateItem = async (type: 'markets' | 'companies', id: string, oldName: string) => {
    const newName = window.prompt("أدخل الاسم الجديد:", oldName);
    if (newName && newName.trim() !== '' && newName !== oldName) {
      await update(ref(db, `${type}/${id}`), { name: newName.trim() });
    }
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCompForExcel) {
      alert("اختر الشركة المنافسة أولاً");
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const products = data.flat().filter(item => typeof item === 'string' && item.trim().length > 0);
        if(products.length > 0) {
          await update(ref(db, `companies/${selectedCompForExcel}`), { products });
          alert(`تم رفع ${products.length} منتج بنجاح`);
        } else {
          alert('لم يتم العثور على مسميات في الملف');
        }
      } catch (err) {
        alert("حدث خطأ في قراءة الملف");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleSaveGeneral = async () => {
    await update(ref(db, 'settings'), {
      tickerText: newTickerText,
      whatsappNumber: whatsapp,
      isTickerAnimated: isTickerAnimated
    });
    alert("✅ تم الحفظ بنجاح");
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف ${name} نهائياً؟`)) {
      await remove(ref(db, `users/${id}`));
    }
  };

  const handleAddItem = async (type: 'markets' | 'companies') => {
    if (!newItemName.trim()) return;
    const newRef = push(ref(db, type));
    await set(newRef, { name: newItemName.trim(), creatorId: user.id });
    setNewItemName('');
    alert("✅ تمت الإضافة بنجاح");
  };

  const handleUpdatePassword = async () => {
    if (!editingCredentials) return;
    await update(ref(db, `users/${editingCredentials.id}`), {
      username: editingCredentials.username,
      password: editingCredentials.password
    });
    alert("✅ تم تحديث بيانات الدخول");
    setEditingCredentials(null);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions) return;
    await update(ref(db, `users/${editingPermissions.id}`), {
      permissions: editingPermissions.permissions
    });
    alert("✅ تم تحديث الصلاحيات بنجاح");
    setEditingPermissions(null);
  };

  const togglePermission = (key: keyof UserPermissions) => {
    if (!editingPermissions) return;
    setEditingPermissions({
      ...editingPermissions,
      permissions: {
        ...editingPermissions.permissions,
        [key]: !editingPermissions.permissions[key]
      }
    });
  };

  return (
    <div className="space-y-8 pb-20 text-right" dir="rtl">
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {[{ id: 'general', label: 'عام', icon: <SettingsIcon size={18}/> },
          { id: 'users', label: 'الموظفين', icon: <UserCog size={18}/> },
          { id: 'markets', label: 'الماركتات', icon: <Store size={18}/> },
          { id: 'companies', label: 'المنافسين', icon: <Building2 size={18}/> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-black text-xs ${activeSubTab === tab.id ? 'bg-gray-600 text-white' : 'bg-white/5 text-white/40'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'general' && (
        <div className="glass-card-dark p-6 md:p-10 rounded-[2rem]">
          <h3 className="text-xl font-black text-white mb-8 border-b border-white/10 pb-4">الإعدادات العامة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block mb-2 mr-2">رقم الواتساب</label>
              <input className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none text-sm" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}/>
            </div>
            <div className="flex items-center justify-between p-5 bg-blue-600/10 rounded-[1.5rem] border border-blue-500/20">
              <span className="text-sm font-black text-white flex items-center gap-2"><Zap size={20}/> تحريك شريط الأخبار</span>
              <input type="checkbox" checked={isTickerAnimated} onChange={e => setIsTickerAnimated(e.target.checked)} className="w-5 h-5 accent-blue-600" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-white/30 uppercase block mb-2 mr-2">نص شريط الأخبار</label>
              <textarea className="w-full glass-input-dark rounded-xl p-4 font-bold outline-none h-24 resize-none text-sm" value={newTickerText} onChange={e => setNewTickerText(e.target.value)} />
            </div>
          </div>
          
          <div className="border border-white/10 p-6 rounded-[1.5rem] mb-8 bg-black/20">
            <h4 className="font-black text-white mb-4 text-sm">إضافة منتجات للشركات المنافسة</h4>
            <div className="flex flex-col md:flex-row gap-4">
              <select 
                className="flex-1 glass-input-dark rounded-xl p-4 font-bold outline-none border-transparent focus:border-gray-500/50 appearance-none"
                value={selectedCompForExcel}
                onChange={e => setSelectedCompForExcel(e.target.value)}
              >
                <option value="" className="bg-gray-500">-- اختر الشركة --</option>
                {companies.map(c => <option key={c.id} value={c.id} className="bg-gray-500">{c.name}</option>)}
              </select>
              <label className="cursor-pointer bg-emerald-600 text-white px-8 py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-emerald-500 transition-all">
                <Upload size={18} /> رفع منتجات (Excel)
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadExcel} />
              </label>
            </div>
          </div>

          <button onClick={handleSaveGeneral} className="bg-gray-600 text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 shadow-lg"><Save size={18}/> حفظ الإعدادات</button>
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="glass-card-dark rounded-[2.5rem] overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-white/5 text-[10px] font-black text-white/40">
              <tr><th className="p-6">الموظف</th><th className="p-6 text-center">الإجراءات</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/5">
                  <td className="p-6 font-bold text-sm text-white">{u.employeeName}</td>
                  <td className="p-6">
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => setMessageTarget(u)} className="p-2 text-amber-400 hover:bg-white/10 rounded-lg" title="إرسال رسالة"><Mail size={16}/></button>
                      <button onClick={() => setEditingPermissions(u)} className="p-2 text-gray-400 hover:bg-white/10 rounded-lg" title="تعديل الصلاحيات"><Shield size={16}/></button>
                      <button onClick={() => setEditingCredentials(u)} className="p-2 text-blue-400 hover:bg-white/10 rounded-lg" title="تغيير الباسورد"><Key size={16}/></button>
                      <button onClick={() => handleDeleteUser(u.id, u.employeeName)} className="p-2 text-red-400 hover:bg-white/10 rounded-lg" title="حذف المستخدم"><Trash2 size={16}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(activeSubTab === 'markets' || activeSubTab === 'companies') && (
        <div className="space-y-6">
          <div className="glass-card-dark p-6 md:p-10 rounded-[2.5rem]">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3"><Plus className="text-gray-500" /> إضافة {activeSubTab === 'markets' ? 'ماركت' : 'شركة منافسة'}</h3>
            <div className="flex gap-4">
              <input className="flex-1 glass-input-dark p-4 rounded-xl font-bold" placeholder="الاسم الجديد..." value={newItemName} onChange={e => setNewItemName(e.target.value)} />
              <button onClick={() => handleAddItem(activeSubTab as any)} className="bg-gray-600 text-white px-8 py-4 rounded-xl font-black">إضافة</button>
            </div>
          </div>
          <div className="glass-card-dark rounded-[2.5rem] overflow-hidden">
            <div className="divide-y divide-white/5">
              {(activeSubTab === 'markets' ? markets : companies).map(item => (
                <div key={item.id} className="p-6 flex justify-between items-center hover:bg-white/5">
                  <span className="font-bold text-white">{item.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateItem(activeSubTab as any, item.id, item.name)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg" title="تعديل"><Edit2 size={18}/></button>
                    <button onClick={async () => { if(window.confirm('حذف؟')) await remove(ref(db, `${activeSubTab}/${item.id}`)); }} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg" title="حذف"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {editingPermissions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] p-8 max-w-xl w-full border border-white/10 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-xl font-black text-white">صلاحيات {editingPermissions.employeeName}</h4>
              <button onClick={() => setEditingPermissions(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
              {[
                { key: 'registerSales', label: 'تسجيل المبيعات' },
                { key: 'viewSalesHistory', label: 'رؤية سجل المبيعات' },
                { key: 'viewColleaguesSales', label: 'رؤية مبيعات الزملاء' },
                { key: 'registerInventory', label: 'تسجيل المخزون' },
                { key: 'viewInventoryHistory', label: 'رؤية سجل المخزون' },
                { key: 'registerCompetitorPrices', label: 'تسجيل أسعار المنافسين' },
                { key: 'viewCompetitorReports', label: 'رؤية تقارير المنافسين' },
                { key: 'viewVacationMgmt', label: 'إدارة الإجازات' },
                { key: 'viewSettings', label: 'دخول الإعدادات' }
              ].map(item => (
                <button 
                  key={item.key}
                  onClick={() => togglePermission(item.key as keyof UserPermissions)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${editingPermissions.permissions[item.key as keyof UserPermissions] ? 'bg-gray-600/20 border-gray-500 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                >
                  <span className="text-xs font-bold">{item.label}</span>
                  {editingPermissions.permissions[item.key as keyof UserPermissions] ? <CheckCircle2 size={18} className="text-gray-400" /> : <div className="w-[18px] h-[18px] rounded-full border border-white/20" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={handleSavePermissions} className="flex-1 bg-gray-600 text-white py-4 rounded-xl font-black">حفظ الصلاحيات</button>
              <button onClick={() => setEditingPermissions(null)} className="flex-1 bg-white/5 text-white/40 py-4 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {editingCredentials && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] p-8 max-w-md w-full animate-in zoom-in-95">
            <h4 className="text-xl font-black text-white mb-6">تحديث بيانات {editingCredentials.employeeName}</h4>
            <div className="space-y-4 text-right">
              <input className="w-full glass-input-dark p-4 rounded-xl font-bold" placeholder="اسم المستخدم" value={editingCredentials.username} onChange={e => setEditingCredentials({...editingCredentials, username: e.target.value})}/>
              <input type="password" className="w-full glass-input-dark p-4 rounded-xl font-bold" placeholder="الباسورد الجديد" value={editingCredentials.password} onChange={e => setEditingCredentials({...editingCredentials, password: e.target.value})}/>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={handleUpdatePassword} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black">تحديث</button>
              <button onClick={() => setEditingCredentials(null)} className="flex-1 bg-white/5 text-white/40 py-4 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {messageTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="glass-card-dark rounded-[3rem] p-8 max-w-md w-full animate-in zoom-in-95">
            <h4 className="text-xl font-black text-white mb-6">إرسال رسالة إلى {messageTarget.employeeName}</h4>
            <textarea className="w-full glass-input-dark p-4 rounded-xl font-bold h-32 resize-none" placeholder="اكتب رسالتك..." value={msgText} onChange={e => setMsgText(e.target.value)}/>
            <div className="flex gap-3 mt-8">
              <button onClick={async () => { await push(ref(db, 'notifications'), { senderId: user.id, receiverId: messageTarget.id, message: msgText, timestamp: new Date().toISOString(), isRead: false }); alert('تم الإرسال'); setMessageTarget(null); setMsgText(''); }} className="flex-1 bg-gray-600 text-white py-4 rounded-xl font-black">إرسال الآن</button>
              <button onClick={() => setMessageTarget(null)} className="flex-1 bg-white/5 text-white/40 py-4 rounded-xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
