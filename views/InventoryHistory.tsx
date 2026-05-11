
import React, { useState, useEffect } from 'react';
import { User, InventoryRecord } from '../types';
import { db, ref, onValue } from '../firebase';
import { Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  user: User;
  markets: string[];
  users: User[];
}

const InventoryHistory: React.FC<Props> = ({ user, markets, users }) => {
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [filterMarket, setFilterMarket] = useState('');

  useEffect(() => {
    const invRef = ref(db, 'inventory');
    onValue(invRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let list = Object.entries(data).map(([id, val]: any) => ({ ...val, id }));
        if (user.role !== 'admin') {
          list = list.filter(r => r.userId === user.id);
        }
        setRecords(list);
      }
    });
  }, [user]);

  const filtered = records.filter(r => filterMarket ? r.marketName === filterMarket : true);

  const exportExcel = (record: InventoryRecord) => {
    const data = record.items.map(item => ({
      'الصنف': item.productName,
      'الكمية': item.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المخزون");
    XLSX.writeFile(wb, `مخزون_${record.marketName}_${new Date(record.date).toLocaleDateString('ar-EG')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">سجل المخزون السابق</h2>
        
        <div className="mb-6 flex gap-4">
          <select 
            className="flex-1 border rounded-lg p-2"
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
          >
            <option value="">كل الماركت</option>
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="space-y-4">
          {filtered.map(record => (
            <div key={record.id} className="border rounded-xl p-4 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg">{record.marketName}</h3>
                <p className="text-sm text-gray-500">
                  التاريخ: {new Date(record.date).toLocaleDateString('ar-EG')} | 
                  الموظف: {record.userName}
                </p>
                <div className="mt-2 text-xs text-gray-600">
                  عدد الأصناف: {record.items.length}
                </div>
              </div>
              <button 
                onClick={() => exportExcel(record)}
                className="bg-white border text-gray-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition"
              >
                <Download size={18}/> تصدير اكسيل
              </button>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-10 text-gray-500">لا توجد سجلات مخزون</div>}
        </div>
      </div>
    </div>
  );
};

export default InventoryHistory;
