
import React, { useState } from 'react';
import { User } from '../types';
import { db, ref, onValue } from '../firebase';
import { Sparkles, User as UserIcon, Lock, Loader2, ArrowLeft } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (username === 'admin' && password === 'admin') {
      onLogin({
        id: 'admin-id', username: 'admin', employeeName: 'مدير النظام', role: 'admin', employeeCode: '001', phone: '', isOnline: true, permissions: { registerSales: true, viewSalesHistory: true, registerInventory: true, viewInventoryHistory: true, registerCompetitorPrices: true, viewCompetitorReports: true, viewVacationMgmt: true, viewSettings: true, viewColleaguesSales: true }, vacationBalance: { annual: 30, casual: 7, sick: 15, exams: 0 }
      });
      return;
    }

    onValue(ref(db, 'users'), (snapshot) => {
      const usersData = snapshot.val();
      if (usersData) {
        const found = Object.entries(usersData).find(([id, u]: any) => u.username === username && u.password === password);
        if (found) {
          const [id, data]: [string, any] = found;
          onLogin({ ...data, id: data.id || id });
        } else {
          setError('خطأ في بيانات الدخول');
          setLoading(false);
        }
      } else {
        setError('لا يوجد مستخدمين مسجلين');
        setLoading(false);
      }
    }, { onlyOnce: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-transparent" dir="rtl">
      <div className="glass-card-dark w-full max-w-md rounded-[3rem] p-10 relative overflow-hidden text-center">
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-900 rounded-3xl shadow-2xl mb-8">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">SOFT ROSE</h1>
          <p className="text-gray-400 font-bold uppercase text-[9px] tracking-[0.3em] mb-12">Portal Access</p>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4">
              <UserIcon className="text-gray-400" size={18} />
              <input className="w-full bg-transparent p-4 outline-none font-bold text-white text-right" placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4">
              <Lock className="text-gray-400" size={18} />
              <input type="password" className="w-full bg-transparent p-4 outline-none font-bold text-white text-right" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && <p className="text-red-400 text-xs font-black">{error}</p>}

            <button type="submit" disabled={loading} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95">
              {loading ? <Loader2 className="animate-spin" size={20}/> : <><span>تسجيل دخول</span><ArrowLeft size={18}/></>}
            </button>
          </form>

          <div className="mt-14 opacity-50">
             <p className="text-[11px] font-black text-gray-300">مع تحيات المطور Amir Lamay</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
