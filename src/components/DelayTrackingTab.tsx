'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane, Calendar, Clock, Save, Trash2, Edit3, X,
  FileSpreadsheet, AlertCircle, CheckCircle2, XCircle,
  Car, MessageSquare, Bell, MessageCircle
} from 'lucide-react';

interface FlightRecord {
  id: string;
  date: string;
  registration: string;
  flightNo: string;
  from: string;
  to: string;
  std: string;
  etd: string;
  newReportingTime: string;
  pairing: boolean;
  notification: boolean;
  sms: boolean;
  crewEtd: string;
  pickUp: string;
  notes: string;
}

const getInitialForm = (): Omit<FlightRecord, 'id'> => ({
  date: new Date().toISOString().split('T')[0],
  registration: '', flightNo: '', from: '', to: '', std: '', etd: '',
  newReportingTime: '', pairing: false, notification: false, sms: false,
  crewEtd: '', pickUp: '', notes: '',
});

function TableHeader() {
  return (
    <thead className="text-xs text-slate-500 uppercase bg-slate-100 border-b border-slate-200 sticky top-0 z-20">
      <tr>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">REG</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">FLT NO</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">FROM</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">TO</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">STD</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">ETD</th>
        <th className="px-3 py-3 whitespace-nowrap bg-yellow-100 text-yellow-800 font-extrabold border-x border-yellow-200">NEW RPT</th>
        <th className="px-3 py-3 whitespace-nowrap text-center bg-slate-100">PAIRING</th>
        <th className="px-3 py-3 whitespace-nowrap text-center bg-slate-100">NOTIF.</th>
        <th className="px-3 py-3 whitespace-nowrap text-center bg-slate-100">SMS</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">CREW ETD</th>
        <th className="px-3 py-3 whitespace-nowrap bg-slate-100">PICK UP</th>
        <th className="px-3 py-3 min-w-[180px] bg-slate-100">NOTES</th>
        <th className="px-3 py-3 text-right bg-slate-100">ACT.</th>
      </tr>
    </thead>
  );
}

export default function DelayTrackingTab() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState(getInitialForm());

  useEffect(() => {
    const saved = localStorage.getItem('crewDelayFlights');
    if (saved) {
      try { setFlights(JSON.parse(saved)); } catch { /* skip */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('crewDelayFlights', JSON.stringify(flights));
  }, [flights]);

  const sortedFlights = useMemo(() => {
    return [...flights].sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      const completeA = a.pairing && a.notification && a.sms;
      const completeB = b.pairing && b.notification && b.sms;
      if (completeA !== completeB) return completeA ? 1 : -1;
      return (a.std || '').localeCompare(b.std || '');
    });
  }, [flights]);

  const groupedFlights = useMemo(() => {
    const groups: { date: string; items: FlightRecord[] }[] = [];
    sortedFlights.forEach(flight => {
      const last = groups[groups.length - 1];
      if (last && last.date === flight.date) last.items.push(flight);
      else groups.push({ date: flight.date, items: [flight] });
    });
    return groups;
  }, [sortedFlights]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    if (name === 'registration' && value.length > 3) return;
    if (name === 'flightNo') {
      if (value.length > 4) return;
      if (value && !/^\d+$/.test(value)) return;
    }
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleEditClick = (flight: FlightRecord) => {
    const cleanReg = flight.registration ? flight.registration.replace(/^TC-/, '') : '';
    const cleanFlt = flight.flightNo ? flight.flightNo.replace(/^PC/, '') : '';
    setFormData({ ...flight, registration: cleanReg, flightNo: cleanFlt, pickUp: flight.pickUp || '' });
    setEditId(flight.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData(getInitialForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalReg = formData.registration.toUpperCase();
    if (finalReg && !finalReg.startsWith('TC-')) finalReg = 'TC-' + finalReg;
    let finalFlt = formData.flightNo.toUpperCase();
    if (finalFlt && !finalFlt.startsWith('PC')) finalFlt = 'PC' + finalFlt;

    const dataToSave = {
      ...formData,
      registration: finalReg,
      flightNo: finalFlt,
      from: formData.from.toUpperCase(),
      to: formData.to.toUpperCase(),
    };

    if (editId) {
      setFlights(prev => prev.map(item => item.id === editId ? { ...dataToSave, id: editId } : item));
      setEditId(null);
    } else {
      setFlights(prev => [...prev, { ...dataToSave, id: Date.now().toString() }]);
    }
    setFormData(getInitialForm());
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
      setFlights(prev => prev.filter(item => item.id !== id));
      if (editId === id) handleCancelEdit();
    }
  };

  const exportToCSV = () => {
    const delimiter = ';';
    const headers = ['DATE', 'REGISTRATION', 'FLIGHT NO', 'FROM', 'TO', 'STD', 'ETD', 'NEW REPORTING TIME', 'PAIRING', 'NOTIFICATION', 'SMS', 'CREW ETD', 'PICK UP', 'NOTES'];
    const rows = sortedFlights.map(f => [
      formatDateDisplay(f.date), f.registration, f.flightNo, f.from, f.to,
      f.std, f.etd, f.newReportingTime,
      f.pairing ? 'YES' : 'NO', f.notification ? 'YES' : 'NO', f.sms ? 'YES' : 'NO',
      f.crewEtd, f.pickUp,
      `"${(f.notes || '').replace(/"/g, '""')}"`
    ].join(delimiter));
    const csvContent = '\uFEFF' + [headers.join(delimiter), ...rows].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `crew_delay_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col font-sans h-full bg-slate-50 relative overflow-hidden">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            <Plane size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Crew Delay Tracker</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Ekip Gecikme Takip Sistemi</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors text-xs font-bold shadow-sm"
        >
          <FileSpreadsheet size={14} /> CSV İndir
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-5 space-y-5">
        
        {/* FORM */}
        <div className={`bg-white p-5 rounded-xl shadow-sm border transition-all duration-300 ${editId ? 'border-yellow-400 ring-2 ring-yellow-100' : 'border-slate-200'}`}>
          <h2 className="text-xs font-bold text-slate-500 mb-4 flex items-center justify-between uppercase tracking-wider border-b border-slate-100 pb-3">
            <span className="flex items-center gap-2">
              <div className={`w-1.5 h-4 rounded-full ${editId ? 'bg-yellow-500' : 'bg-blue-500'}`} />
              {editId ? 'Kaydı Düzenle' : 'Yeni Kayıt Girişi'}
            </span>
            {editId && (
              <button onClick={handleCancelEdit} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold">
                <X size={12} /> VAZGEÇ
              </button>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            
            {/* DATE */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Calendar size={10} /> Tarih
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full h-9 px-2 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>

            {/* REGISTRATION */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Registration</label>
              <div className="flex items-center h-9">
                <span className="h-full flex items-center px-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l text-slate-500 font-bold text-xs">TC-</span>
                <input
                  type="text" name="registration" placeholder="NBP" required maxLength={3}
                  value={formData.registration} onChange={handleChange}
                  className="w-full h-full px-2 text-sm border border-slate-300 rounded-r focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-slate-700"
                />
              </div>
            </div>

            {/* FLIGHT NO */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Flight No</label>
              <div className="flex items-center h-9">
                <span className="h-full flex items-center px-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l text-slate-500 font-bold text-xs">PC</span>
                <input
                  type="text" inputMode="numeric" name="flightNo" placeholder="1001" required
                  value={formData.flightNo} onChange={handleChange}
                  className="w-full h-full px-2 text-sm border border-slate-300 rounded-r focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-slate-700"
                />
              </div>
            </div>

            {/* FROM */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">From</label>
              <input type="text" name="from" placeholder="SAW" maxLength={3} value={formData.from} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-slate-700"
              />
            </div>

            {/* TO */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">To</label>
              <input type="text" name="to" placeholder="AYT" maxLength={3} value={formData.to} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-slate-700"
              />
            </div>

            {/* STD */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Clock size={10} /> STD
              </label>
              <input type="time" name="std" value={formData.std} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>

            {/* ETD */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Clock size={10} /> ETD
              </label>
              <input type="time" name="etd" value={formData.etd} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-red-200 bg-red-50 rounded focus:ring-2 focus:ring-red-400 outline-none text-red-700 font-bold"
              />
            </div>

            {/* NEW REPORTING TIME */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-yellow-700 uppercase mb-1 flex items-center gap-1">
                <AlertCircle size={10} /> New Rpt
              </label>
              <input type="time" name="newReportingTime" required value={formData.newReportingTime} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-400 outline-none bg-yellow-50 font-extrabold text-yellow-900"
              />
            </div>

            {/* CREW ETD */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Crew ETD</label>
              <input type="time" name="crewEtd" value={formData.crewEtd} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>

            {/* PAIRING */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 block">Pairing</label>
              <label className="flex items-center h-9 w-full px-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer bg-white gap-2">
                <input type="checkbox" name="pairing" checked={formData.pairing} onChange={handleChange} className="w-4 h-4 accent-green-600" />
                <span className="text-xs font-medium text-slate-600">Onaylandı</span>
              </label>
            </div>

            {/* NOTIFICATION */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Bell size={10} /> Notif.
              </label>
              <label className="flex items-center h-9 w-full px-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer bg-white gap-2">
                <input type="checkbox" name="notification" checked={formData.notification} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600">Tebliğ Edildi</span>
              </label>
            </div>

            {/* SMS */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <MessageCircle size={10} /> SMS
              </label>
              <label className="flex items-center h-9 w-full px-2 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer bg-white gap-2">
                <input type="checkbox" name="sms" checked={formData.sms} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
                <span className="text-xs font-medium text-slate-600">Gönderildi</span>
              </label>
            </div>

            {/* PICK UP */}
            <div className="col-span-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Car size={10} /> Pick Up
              </label>
              <select name="pickUp" value={formData.pickUp} onChange={handleChange}
                className="w-full h-9 px-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700 font-medium"
              >
                <option value="">-</option>
                <option value="Taksi">Taksi</option>
                <option value="Efatur">Efatur</option>
              </select>
            </div>

            {/* NOTES */}
            <div className="col-span-5">
              <label className="text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                <MessageSquare size={10} /> Notes
              </label>
              <input type="text" name="notes" placeholder="Operasyonel notlar ve açıklamalar..." value={formData.notes} onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
              />
            </div>

            {/* SUBMIT */}
            <div className="col-span-2 flex items-end">
              <button
                type="submit"
                className={`w-full h-9 rounded-lg font-bold shadow-sm flex justify-center items-center gap-2 text-white text-xs tracking-wide transition-colors ${editId ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-700 hover:bg-blue-800'}`}
              >
                {editId ? <><Edit3 size={12} /> GÜNCELLE</> : <><Save size={12} /> KAYDET</>}
              </button>
            </div>
          </form>
        </div>

        {/* FLIGHT LIST */}
        <div className="space-y-5 pb-4">
          {groupedFlights.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-dashed border-slate-200 overflow-hidden">
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Plane size={40} className="mb-3 opacity-30" />
                <p className="font-medium text-sm">Henüz kayıt girilmemiş</p>
                <p className="text-xs mt-1">Yukarıdaki formu kullanarak gecikme kaydı ekleyin</p>
              </div>
            </div>
          ) : (
            groupedFlights.map(group => (
              <div key={group.date} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-800 text-white px-5 py-3 flex justify-between items-center">
                  <h3 className="font-bold flex items-center gap-2 text-sm">
                    <Calendar size={15} />
                    {formatDateDisplay(group.date)}
                  </h3>
                  <span className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300 border border-slate-600 font-medium">
                    {group.items.length} UÇUŞ
                  </span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scroll">
                  <table className="w-full text-sm text-left">
                    <TableHeader />
                    <tbody className="divide-y divide-slate-100">
                      {group.items.map(flight => {
                        const isComplete = flight.pairing && flight.notification && flight.sms;
                        return (
                          <tr
                            key={flight.id}
                            onClick={() => handleEditClick(flight)}
                            className={`hover:bg-blue-50 transition-colors cursor-pointer ${editId === flight.id ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-200' : ''} ${isComplete ? 'opacity-70' : ''}`}
                          >
                            <td className="px-3 py-2.5 font-bold text-slate-800 text-xs">{flight.registration}</td>
                            <td className="px-3 py-2.5 font-bold text-blue-700 text-xs">{flight.flightNo}</td>
                            <td className="px-3 py-2.5 text-slate-600 text-xs font-medium">{flight.from}</td>
                            <td className="px-3 py-2.5 text-slate-600 text-xs font-medium">{flight.to}</td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs">{flight.std}</td>
                            <td className="px-3 py-2.5 font-bold text-red-600 text-xs">{flight.etd}</td>
                            <td className="px-3 py-2.5 font-extrabold text-yellow-900 bg-yellow-50 border-x border-yellow-200 text-xs">{flight.newReportingTime}</td>
                            <td className="px-3 py-2.5 text-center">
                              {flight.pairing
                                ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                                : <XCircle size={16} className="text-slate-300 mx-auto" />}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {flight.notification
                                ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                                : <XCircle size={16} className="text-slate-300 mx-auto" />}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {flight.sms
                                ? <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                                : <XCircle size={16} className="text-slate-300 mx-auto" />}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 text-xs">{flight.crewEtd}</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-slate-700">{flight.pickUp}</td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs italic max-w-[160px] truncate" title={flight.notes}>{flight.notes}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={e => handleDelete(e, flight.id)}
                                className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                                title="Sil"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
