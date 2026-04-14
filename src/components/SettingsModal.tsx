'use client';
import { useState, useEffect } from 'react';
import { useSettings, DelayCode } from '@/lib/useSettings';
import { Trash2, Plus, X, Edit, Save, Users, Tags, Wand2 } from 'lucide-react';

export default function SettingsModal({ onClose }: { onClose:()=>void }) {
  const { chiefs, saveChiefs, delayCodes, saveDelayCodes, geminiKey, saveGeminiKey } = useSettings();
  const [activeTab, setActiveTab] = useState<'chiefs' | 'codes' | 'system'>('chiefs');
  
  const [geminiKeyField, setGeminiKeyField] = useState("");
  
  // Chief States
  const [chiefList, setChiefList] = useState<string[]>([]);
  const [newChief, setNewChief] = useState("");

  // Delay Code States
  const [codeList, setCodeList] = useState<DelayCode[]>([]);
  const [newCodeField, setNewCodeField] = useState("");
  const [newDescField, setNewDescField] = useState("");
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [editDescVal, setEditDescVal] = useState("");

  useEffect(() => {
     setChiefList(chiefs);
     setCodeList(delayCodes);
     setGeminiKeyField(geminiKey || "");
  }, [chiefs, delayCodes, geminiKey]);

  // --- CHIEF LOGIC ---
  const addChief = () => { 
      if(newChief.trim() && !chiefList.includes(newChief.trim().toUpperCase())) { 
          setChiefList([...chiefList, newChief.trim().toUpperCase()]); 
          setNewChief(""); 
      } 
  }
  const removeChief = (val: string) => { setChiefList(chiefList.filter(c => c !== val)); }

  // --- DELAY CODE LOGIC ---
  const addCode = () => {
      const trimmedCode = newCodeField.trim().toUpperCase();
      if(trimmedCode && newDescField.trim() && !codeList.some(c => c.code === trimmedCode)) {
          setCodeList([...codeList, { code: trimmedCode, desc: newDescField.trim() }]);
          setNewCodeField("");
          setNewDescField("");
      } else if (codeList.some(c => c.code === trimmedCode)) {
          alert("Bu kod zaten mevcut!");
      }
  }
  const removeCode = (val: string) => { setCodeList(codeList.filter(c => c.code !== val)); }
  
  const initiateEdit = (codeObj: DelayCode) => {
      setEditingCodeId(codeObj.code);
      setEditDescVal(codeObj.desc);
  }
  
  const saveCodeEdit = () => {
      setCodeList(codeList.map(c => c.code === editingCodeId ? { ...c, desc: editDescVal } : c));
      setEditingCodeId(null);
  }

  // --- SAVE ALL ---
  const saveAndClose = () => { 
      saveChiefs(chiefList); 
      saveDelayCodes(codeList);
      saveGeminiKey(geminiKeyField);
      onClose(); 
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center animate-in fade-in duration-200">
       <div className="bg-white rounded-2xl shadow-2xl p-6 w-[700px] flex flex-col relative animate-in zoom-in-95 max-h-[90vh]">
          <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
          
          <h3 className="text-2xl font-black mb-1 text-slate-800">Sistem Tanımları</h3>
          <p className="text-sm text-slate-500 mb-6">Operasyon analizinde eşleştirilecek temel kuralları belirleyin.</p>
          
          {/* TAB NAVIGATION */}
          <div className="flex gap-4 border-b-2 border-slate-100 mb-6 shrink-0">
             <button 
                 onClick={() => setActiveTab('chiefs')}
                 className={`pb-3 font-bold text-sm tracking-wide transition border-b-2 flex items-center gap-2 px-2 ${activeTab === 'chiefs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
             >
                 <Users className="w-4 h-4" /> VARDİYA AMİRLERİ
             </button>
             <button 
                 onClick={() => setActiveTab('codes')}
                 className={`pb-3 font-bold text-sm tracking-wide transition border-b-2 flex items-center gap-2 px-2 ${activeTab === 'codes' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
             >
                 <Tags className="w-4 h-4" /> GECİKME KODLARI
             </button>
             <button 
                 onClick={() => setActiveTab('system')}
                 className={`pb-3 font-bold text-sm tracking-wide transition border-b-2 flex items-center gap-2 px-2 ${activeTab === 'system' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
             >
                 <Wand2 className="w-4 h-4" /> YAPAY ZEKA (AI)
             </button>
          </div>

          {/* CHIEFS AREA */}
          {activeTab === 'chiefs' && (
              <div className="flex flex-col flex-1 min-h-[300px]">
                 <div className="flex gap-2 mb-4">
                    <input autoFocus value={newChief} onChange={e=>setNewChief(e.target.value)} onKeyDown={e=>e.key==='Enter' && addChief()} placeholder="AMİR ADI SOYADI..." className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-blue-500 focus:border-blue-400 transition uppercase" />
                    <button onClick={addChief} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold text-sm shadow-md transition drop-shadow-sm"><Plus className="w-5 h-5" /> EKLE</button>
                 </div>
                 <div className="flex-1 overflow-y-auto max-h-80 border-2 border-slate-100 rounded-xl p-3 bg-slate-50 flex flex-col gap-2 custom-scroll">
                    {chiefList.map(c => (
                        <div key={c} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm text-sm font-bold text-slate-700 hover:border-blue-300 transition group">
                           <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-blue-600 transition"></div>
                              {c}
                           </div>
                           <button onClick={()=>removeChief(c)} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-600 p-2 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {chiefList.length===0 && <p className="text-center text-xs text-slate-400 p-6 font-medium">Amir listesi boş.</p>}
                 </div>
              </div>
          )}

          {/* DELAY CODES AREA */}
          {activeTab === 'codes' && (
              <div className="flex flex-col flex-1 min-h-[300px]">
                 <div className="flex gap-2 mb-4 bg-red-50/50 p-2 rounded-xl border border-red-100">
                    <input 
                       value={newCodeField} 
                       onChange={e=>setNewCodeField(e.target.value)} 
                       placeholder="KOD (örn: 64X)" 
                       className="w-32 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-red-500 uppercase" 
                    />
                    <input 
                       value={newDescField} 
                       onChange={e=>setNewDescField(e.target.value)} 
                       onKeyDown={e=>e.key==='Enter' && addCode()}
                       placeholder="Gecikme Açıklaması..." 
                       className="flex-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-red-500" 
                    />
                    <button onClick={addCode} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-sm shadow-md transition drop-shadow-sm"><Plus className="w-5 h-5" /> EKLE</button>
                 </div>
                 <div className="flex-1 overflow-y-auto max-h-80 border-2 border-slate-100 rounded-xl p-3 bg-slate-50 flex flex-col gap-2 custom-scroll">
                    {codeList.map(codeObj => (
                        <div key={codeObj.code} className={`flex flex-col bg-white border ${editingCodeId === codeObj.code ? 'border-blue-400 bg-blue-50/10' : 'border-slate-200'} p-3 rounded-lg shadow-sm transition group gap-2`}>
                           <div className="flex justify-between items-center w-full">
                               <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                  <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 border border-rose-100 rounded text-xs shrink-0">{codeObj.code}</span>
                                  {editingCodeId === codeObj.code ? (
                                      <input autoFocus value={editDescVal} onChange={e=>setEditDescVal(e.target.value)} onKeyDown={e=>e.key==='Enter' && saveCodeEdit()} className="flex-1 border-b-2 border-blue-400 focus:outline-none bg-transparent text-sm font-bold text-blue-900" />
                                  ) : (
                                      <span className="text-sm font-medium text-slate-700 truncate" title={codeObj.desc}>{codeObj.desc}</span>
                                  )}
                               </div>
                               <div className="flex gap-1 shrink-0 ml-2">
                                  {editingCodeId === codeObj.code ? (
                                      <button onClick={saveCodeEdit} className="text-white bg-blue-500 hover:bg-blue-600 p-1.5 rounded-lg transition"><Save className="w-4 h-4" /></button>
                                  ) : (
                                      <button onClick={()=>initiateEdit(codeObj)} className="text-blue-500 hover:text-white bg-blue-50 hover:bg-blue-600 p-1.5 rounded-lg transition"><Edit className="w-4 h-4" /></button>
                                  )}
                                  <button onClick={()=>removeCode(codeObj.code)} className="text-red-500 hover:text-white bg-red-50 hover:bg-red-600 p-1.5 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                               </div>
                           </div>
                        </div>
                    ))}
                    {codeList.length===0 && <p className="text-center text-xs text-slate-400 p-6 font-medium">Gecikme Kodu tanımlanmamış.</p>}
                 </div>
              </div>
          )}

          {/* AI / SYSTEM AREA */}
          {activeTab === 'system' && (
              <div className="flex flex-col flex-1 min-h-[300px] p-2">
                 <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                    <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-2"><Wand2 className="w-5 h-5"/> API Konfigürasyonu</h4>
                    <p className="text-xs text-purple-700/80 leading-relaxed font-medium">Grafiklerinizi ve operasyonel verilerinizi inceleyen uzman bir analiz raporu oluşturması için sistem Google Gemini Pro modelini kullanır. Bu ağın çalışabilmesi için ücretsiz API anahtarı eklemelisiniz.</p>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition underline mt-2 inline-block py-1">Buraya Tıklayarak Ücretsiz Google API Anahtarı Al</a>
                 </div>
                 
                 <div className="flex flex-col gap-2 mt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Gemini API Anahtarı</label>
                    <input 
                        type="password" 
                        value={geminiKeyField} 
                        onChange={e=>setGeminiKeyField(e.target.value)} 
                        placeholder="AIzaSy..." 
                        className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-purple-500 focus:border-purple-400 transition tracking-widest shadow-sm" 
                    />
                 </div>
              </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100">
             <button onClick={saveAndClose} className="bg-slate-900 text-white px-4 py-4 rounded-xl text-sm font-black tracking-widest shadow-md hover:bg-slate-800 transition w-full hover:shadow-lg hover:-translate-y-0.5 transform">TÜM DEĞİŞİKLİKLERİ KAYDET</button>
          </div>
       </div>
    </div>
  )
}
