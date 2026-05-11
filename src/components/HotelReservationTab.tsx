'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, Lock, Search, FileText, Mail, Save, Printer, Building2, Calendar, User, Image as ImageIcon, X, LogIn, Key, LogOut, Send, Edit2 } from 'lucide-react';

const INITIAL_HOTELS = [
  // İSTANBUL
  { id: 'h1', city: 'İstanbul', code: 'SAW', name: 'Miracle Istanbul Asia', email: 'cumali@miracleistanbulasia.com', phone: '0216 510 04 04' },
  { id: 'h2', city: 'İstanbul', code: 'SAW', name: 'Hampton by Hilton', email: 'Kurtkoy.Rezervasyon@Hilton.com, Aslihan.Saglam@Hilton.com', phone: '0216 692 46 00' },
  { id: 'h3', city: 'İstanbul', code: 'SAW', name: 'Movenpick', email: 'Alican.YAGDI@movenpick.com, HB883-FO2@accor.com', phone: '0216 585 60 60' },
  { id: 'h4', city: 'İstanbul', code: 'SAW', name: 'Nearport Hotel', email: 'salesmng@nearporthotel.com', phone: '0216 585 60 60' },
 
  // İZMİR
  { id: 'h5', city: 'İzmir', code: 'ADB', name: 'TAV Airport Hotel', email: 'ufuk.kayalar@tavairporthotels.com.tr', phone: '0232 414 50 72' },
  { id: 'h6', city: 'İzmir', code: 'ADB', name: 'Orty Hotel', email: 'yonetim@ortyhotels.com, info@ortyhotels.com', phone: '0232 274 71 71' },
  { id: 'h7', city: 'İzmir', code: 'ADB', name: 'Wyndham Grand', email: 'tugce.aktolgalilar@wyndhamgrandizmir.com, 26@wyndhamgrandizmir.com', phone: '0232 414 10 10' },
 
  // ANTALYA
  { id: 'h8', city: 'Antalya', code: 'AYT', name: 'The Marmara', email: 'zbakir@themarmarahotels.com, mafo@themarmarahotels.com', phone: '0242 249 36 00' },
  { id: 'h9', city: 'Antalya', code: 'AYT', name: 'IC Hotels Airport', email: 'foairport@ichotels.com.tr, firatcicek@ichotels.com.tr', phone: '0242 463 10 10' },

  // ANKARA
  { id: 'h10', city: 'Ankara', code: 'ESB', name: 'The Lost Hotel', email: 'info@thelosthotel.com', phone: '0312 447 12 12' },
  { id: 'h11', city: 'Ankara', code: 'ESB', name: 'The Green Park', email: 'ankara@thegreenpark.com', phone: '0312 258 00 00' },

  // ADANA
  { id: 'h12', city: 'Adana', code: 'ADA', name: 'Seyhan Otel', email: 'info@seyhanotel.com', phone: '0322 457 58 10' },
  { id: 'h13', city: 'Adana', code: 'ADA', name: 'HiltonSA', email: 'sezen.baris@hilton.com', phone: '0322 355 50 00' },

  // DİĞER ŞEHİRLER
  { id: 'h14', city: 'Bodrum', code: 'BJV', name: 'Zeytinada Hotel', email: 'info@zeytinada.com, onburo@zeytinada.com', phone: '0252 316 04 04' },
  { id: 'h15', city: 'Dalaman', code: 'DLM', name: 'Lykia Resort', email: 'info@lykiaresorthotel.com', phone: '0252 284 52 22' },
  { id: 'h16', city: 'Kayseri', code: 'ASR', name: 'Novotel', email: 'H6074-RE@accor.com', phone: '0352 207 30 00' },
  { id: 'h17', city: 'Gaziantep', code: 'GZT', name: 'Divan Hotel', email: 'info.divangaziantep@divan.com.tr', phone: '0342 211 05 00' },
  { id: 'h18', city: 'Samsun', code: 'SZF', name: 'Hampton Samsun', email: 'SSZHX_Hampton@hilton.com', phone: '0362 311 07 07' },
  { id: 'h19', city: 'Konya', code: 'KYA', name: 'Dedeman Konya', email: 'konya@dedeman.com', phone: '0332 221 66 00' },
  { id: 'h20', city: 'Trabzon', code: 'TZX', name: 'Zorlu Grand', email: 'info@zorlugrand.com', phone: '0462 326 84 00' },
  { id: 'h21', city: 'Van', code: 'VAN', name: 'DoubleTree by Hilton', email: 'info@doubletreevan.com', phone: '0432 227 02 27' },
  { id: 'h22', city: 'Lefkoşa', code: 'ECN', name: 'Merit Lefkoşa', email: 'info.lefkosa@merithotels.com', phone: '0392 600 55 00' },
];

export default function HotelReservationTab() {
  const [hotels, setHotels] = useState<any[]>(INITIAL_HOTELS);
  const [loading, setLoading] = useState(true);
 
  // LOGIN STATE
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginView, setLoginView] = useState<'login' | 'forgot'>('login');
  const [loginData, setLoginData] = useState({ username: '', password: '', email: '' });
  const [loginError, setLoginError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [logoUrl, setLogoUrl] = useState("https://upload.wikimedia.org/wikipedia/commons/2/21/Pegasus_Airlines_logo.svg");
  const [editingHotel, setEditingHotel] = useState<any | null>(null);
  const [editHotelData, setEditHotelData] = useState({ city: '', code: '', name: '', email: '', phone: '' });

  // Form State
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
 
  const [guests, setGuests] = useState([
    { id: 1, name: '', sng: false, dbl: false, entryCode: '', entryDate: '', entryTime: '', exitCode: '', exitDate: '', exitTime: '', remarks: '' }
  ]);

  // Load custom hotels from local storage instead of Firebase
  useEffect(() => {
    const customHotelsStr = localStorage.getItem('custom_hotels');
    if (customHotelsStr) {
      try {
        const customHotels = JSON.parse(customHotelsStr);
        setHotels([...INITIAL_HOTELS, ...customHotels]);
      } catch (e) {
        setHotels(INITIAL_HOTELS);
      }
    } else {
      setHotels(INITIAL_HOTELS);
    }
    
    const savedLogo = localStorage.getItem('hotel_logo_url');
    if (savedLogo) {
      setLogoUrl(savedLogo);
    }

    setLoading(false);
  }, []);

  const saveLogo = (url: string) => {
    setLogoUrl(url);
    localStorage.setItem('hotel_logo_url', url);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (loginData.username === 'admin' && loginData.password === '1234') {
        setIsAdminMode(true);
        setShowLoginModal(false);
        setLoginData({ username: '', password: '', email: '' });
    } else {
        setLoginError('Kullanıcı adı veya şifre hatalı!');
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginData.email) {
        setTimeout(() => {
            setResetSuccess(true);
        }, 1000);
    }
  };

  const openLogin = () => {
    if (isAdminMode) {
        if(window.confirm("Yönetici modundan çıkmak istiyor musunuz?")) {
            setIsAdminMode(false);
        }
    } else {
        setLoginView('login');
        setLoginError('');
        setResetSuccess(false);
        setShowLoginModal(true);
    }
  };

  const handleAddHotel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newHotel = {
      id: 'c_' + Date.now().toString(),
      city: formData.get('city') as string,
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string
    };
   
    const customHotelsStr = localStorage.getItem('custom_hotels');
    const customHotels = customHotelsStr ? JSON.parse(customHotelsStr) : [];
    const updatedCustomHotels = [...customHotels, newHotel];
    
    localStorage.setItem('custom_hotels', JSON.stringify(updatedCustomHotels));
    setHotels([...INITIAL_HOTELS, ...updatedCustomHotels]);
    
    (e.target as HTMLFormElement).reset();
    alert("Otel başarıyla eklendi! Listede görebilirsiniz.");
  };

  const handleDeleteHotel = (id: string) => {
    if(!id.startsWith('h')) {
       if(window.confirm("Bu oteli silmek istediğinize emin misiniz?")) {
         const customHotelsStr = localStorage.getItem('custom_hotels');
         if (customHotelsStr) {
           const customHotels = JSON.parse(customHotelsStr);
           const updated = customHotels.filter((h: any) => h.id !== id);
           localStorage.setItem('custom_hotels', JSON.stringify(updated));
           setHotels([...INITIAL_HOTELS, ...updated]);
         }
       }
    } else {
        alert("Sistemde yüklü gelen varsayılan oteller silinemez. Sadece sonradan eklediklerinizi silebilirsiniz.");
    }
  };

  const handleOpenEditHotel = (hotel: any) => {
    setEditingHotel(hotel);
    setEditHotelData({ city: hotel.city, code: hotel.code, name: hotel.name, email: hotel.email, phone: hotel.phone || '' });
  };

  const handleSaveHotelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;
    const updated = hotels.map((h: any) => h.id === editingHotel.id ? { ...h, ...editHotelData } : h);
    setHotels(updated);
    // Persist only custom hotels
    const customHotels = updated.filter((h: any) => !INITIAL_HOTELS.find((ih) => ih.id === h.id));
    localStorage.setItem('custom_hotels', JSON.stringify(customHotels));
    setEditingHotel(null);
  };

  const addGuestRow = () => {
    setGuests([...guests, { id: Date.now(), name: '', sng: false, dbl: false, entryCode: '', entryDate: formDate, entryTime: '', exitCode: '', exitDate: '', exitTime: '', remarks: '' }]);
  };

  const updateGuest = (id: number, field: string, value: any) => {
    setGuests(guests.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const removeGuest = (id: number) => {
    setGuests(guests.filter(g => g.id !== id));
  };

  const filteredHotels = hotels.filter(h =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateMailto = () => {
    if (!selectedHotel) return;
   
    const cleanEmails = selectedHotel.email
      .replace(/[\/;]/g, ',')
      .split(',')
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0)
      .join(',');

    const subject = `HOTEL RESERVATION - ${selectedHotel.name} - ${formDate}`;
    let body = `TO: ${selectedHotel.name}\nATTN: RESERVATION DEPARTMENT\n\n`;
    body += `PLEASE CONFIRM THE FOLLOWING RESERVATION:\n\n`;
   
    guests.forEach((g, i) => {
      if(g.name) {
        body += `${i+1}. ${g.name.toUpperCase()}\n`;
        body += `   Room: ${g.sng ? 'SNG' : ''} ${g.dbl ? 'DBL' : ''}\n`;
        body += `   Entry: ${g.entryCode ? `[${g.entryCode}] ` : ''}${g.entryDate} ${g.entryTime}\n`;
        body += `   Exit:  ${g.exitCode ? `[${g.exitCode}] ` : ''}${g.exitDate} ${g.exitTime}\n`;
        body += `   Note: ${g.remarks}\n\n`;
      }
    });

    body += `\nBest Regards,\nReservation Team`;
   
    window.location.href = `mailto:${cleanEmails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handlePrint = () => {
    // Hide sidebar, header and other elements while printing
    const style = document.createElement('style');
    style.innerHTML = `@media print { aside { display:none !important; } header { display:none !important; } .print\\:hidden { display:none !important; } }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 100);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Yükleniyor...</div>;

  return (
    <div className="flex-1 flex flex-col font-sans text-gray-800 bg-slate-50 overflow-hidden relative">
      
      {/* LOCAL HEADER (replaces the old full page header) */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-8 h-8 rounded flex items-center justify-center text-white font-bold shadow-sm">
            <Building2 size={16} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Otel Rezervasyon</h1>
            <p className="text-[10px] text-slate-400">Kurumsal Konaklama Yönetimi</p>
          </div>
        </div>
        <button
          onClick={openLogin}
          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium border ${isAdminMode ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
        >
          {isAdminMode ? <LogOut size={14} /> : <Lock size={14} />}
          {isAdminMode ? 'Yönetici Çıkış' : 'Admin Girişi'}
        </button>
      </div>

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[60] backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-sm">
                        {loginView === 'login' ? <LogIn size={16} className="text-blue-400" /> : <Key size={16} className="text-amber-400"/>}
                        {loginView === 'login' ? 'Yönetici Girişi' : 'Şifre Sıfırlama'}
                    </h3>
                    <button onClick={() => setShowLoginModal(false)} className="hover:bg-slate-700/50 p-1.5 rounded-lg transition-colors"><X size={16}/></button>
                </div>
               
                <div className="p-6">
                    {loginView === 'login' ? (
                        <form onSubmit={handleLoginSubmit} className="space-y-4">
                            {loginError && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-xs font-medium text-center">
                                    {loginError}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Kullanıcı Adı</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                                    placeholder="admin"
                                    value={loginData.username}
                                    onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Şifre</label>
                                <input
                                    type="password"
                                    className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                                    placeholder="••••"
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                                    required
                                />
                            </div>
                           
                            <div className="flex justify-between items-center text-[11px] mt-1">
                                <span className="text-slate-400">Demo: admin / 1234</span>
                                <button type="button" onClick={() => {setLoginView('forgot'); setLoginError('');}} className="text-blue-600 hover:text-blue-700 font-medium">Şifremi Unuttum?</button>
                            </div>

                            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg transition-colors mt-2 text-sm shadow-sm">
                                Giriş Yap
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                            {!resetSuccess ? (
                                <>
                                    <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                        Lütfen hesabınıza kayıtlı e-posta adresinizi girin. Size bir şifre sıfırlama bağlantısı göndereceğiz.
                                    </p>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1.5">E-posta Adresi</label>
                                        <input
                                            type="email"
                                            className="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                                            placeholder="ornek@sirket.com"
                                            value={loginData.email}
                                            onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition mt-2 flex items-center justify-center gap-2 text-sm shadow-sm">
                                        <Send size={14}/> Sıfırlama Bağlantısı Gönder
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Mail size={24}/>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 mb-1.5">E-posta Gönderildi!</h4>
                                    <p className="text-xs text-slate-500">
                                        Lütfen gelen kutunuzu kontrol edin. Şifre sıfırlama talimatlarını içeren bir e-posta gönderdik.
                                    </p>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => {setLoginView('login'); setResetSuccess(false);}}
                                className="w-full text-slate-500 hover:text-slate-800 text-[11px] font-medium mt-4 pt-4 border-t border-slate-100 flex justify-center items-center gap-1"
                            >
                                ← Giriş Ekranına Dön
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* MAIN CONTENT DIV */}
      <div className="flex-1 overflow-auto custom-scroll p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* YÖNETİCİ MODU: Ayarlar ve Ekleme */}
          {isAdminMode && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500 animate-in fade-in slide-in-from-top-4 print:hidden">
              <div className="flex flex-col md:flex-row gap-8">
               
                {/* SOL: Otel Ekleme */}
                <div className="flex-1">
                  <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800"><Building2 size={16} className="text-amber-500"/> Otel Ekle / Yönet</h2>
                  <form onSubmit={handleAddHotel} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200/60">
                    <input name="city" placeholder="Şehir (örn: Ankara)" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" required />
                    <input name="code" placeholder="Kod (örn: ESB)" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" required />
                    <input name="name" placeholder="Otel Adı" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400 md:col-span-2" required />
                    <input name="email" placeholder="E-posta (Virgül ile ayırın)" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400 md:col-span-2" required />
                    <input name="phone" placeholder="Telefon" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" />
                    <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded text-xs flex items-center justify-center gap-1.5 font-bold transition-colors shadow-sm"><Plus size={14}/> Yeni Otel Ekle</button>
                  </form>
                </div>

                {/* SAĞ: Genel Ayarlar (Logo) */}
                <div className="md:w-1/3 border-l border-slate-200 pl-0 md:pl-8">
                  <h2 className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-800"><Settings size={16} className="text-slate-400"/> Form Ayarları</h2>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/60">
                    <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><ImageIcon size={14}/> Kurumsal Logo URL</label>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => saveLogo(e.target.value)}
                      className="w-full border border-slate-300 p-2 rounded text-xs mb-2 outline-none focus:border-blue-400"
                      placeholder="https://..."
                    />
                    <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Çıktı formunda görünecek firma logusunun izi. Şeffaf (PNG) tercih ediniz.</p>
                    <div className="border border-slate-200 p-2 bg-white flex justify-center items-center h-16 rounded-lg relative overflow-hidden">
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjZjBmMCIgc3Ryb2tlLXdpZHRoPSIxIj48L3BhdGg+Cjwvc3ZnPg==')] opacity-30"></div>
                      <img src={logoUrl} alt="Logo Önizleme" className="max-h-12 object-contain relative z-10" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}/>
                    </div>
                  </div>
                </div>

              </div>

              {/* Otel Listesi Yönetimi */}
              <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
                <div className="overflow-x-auto max-h-48 custom-scroll">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-500 uppercase sticky top-0 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Şehir</th>
                        <th className="p-2.5">Kod</th>
                        <th className="p-2.5">Otel Adı</th>
                        <th className="p-2.5">E-posta</th>
                        <th className="p-2.5 text-center">Düzenle</th>
                        <th className="p-2.5 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {hotels.map(h => (
                        <tr key={h.id} className="hover:bg-slate-50/80">
                          <td className="p-2.5 text-slate-700">{h.city}</td>
                          <td className="p-2.5"><span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200 flex w-max">{h.code}</span></td>
                          <td className="p-2.5 font-bold text-slate-800">{h.name}</td>
                          <td className="p-2.5 text-slate-500 truncate max-w-[150px]" title={h.email}>{h.email}</td>
                          <td className="p-2.5 text-center">
                            <button onClick={() => handleOpenEditHotel(h)} className="p-1.5 rounded-md transition-colors text-blue-500 hover:bg-blue-50 hover:text-blue-700" title="Düzenle">
                               <Edit2 size={14}/>
                            </button>
                          </td>
                          <td className="p-2.5 text-center">
                            <button onClick={() => handleDeleteHotel(h.id)} className={`p-1.5 rounded-md transition-colors ${h.id.startsWith('h') ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50 hover:text-red-700'}`} disabled={h.id.startsWith('h')} title={h.id.startsWith('h') ? 'Sistem oteli silinemez' : 'Sil'}>
                               <Trash2 size={14}/>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Edit Hotel Modal */}
              {editingHotel && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2 text-sm"><Edit2 size={16} className="text-amber-400"/> Otel Düzenle: {editingHotel.name}</h3>
                      <button onClick={() => setEditingHotel(null)} className="hover:bg-slate-700/50 p-1.5 rounded-lg"><X size={16}/></button>
                    </div>
                    <form onSubmit={handleSaveHotelEdit} className="p-5 grid grid-cols-2 gap-3">
                      <input value={editHotelData.city} onChange={e => setEditHotelData(p => ({...p, city: e.target.value}))} placeholder="Şehir" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" required />
                      <input value={editHotelData.code} onChange={e => setEditHotelData(p => ({...p, code: e.target.value}))} placeholder="Kod" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" required />
                      <input value={editHotelData.name} onChange={e => setEditHotelData(p => ({...p, name: e.target.value}))} placeholder="Otel Adı" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400 col-span-2" required />
                      <input value={editHotelData.email} onChange={e => setEditHotelData(p => ({...p, email: e.target.value}))} placeholder="E-posta" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400 col-span-2" required />
                      <input value={editHotelData.phone} onChange={e => setEditHotelData(p => ({...p, phone: e.target.value}))} placeholder="Telefon" className="border border-slate-300 p-2 text-xs rounded outline-none focus:border-amber-400" />
                      <div className="flex justify-end gap-2 col-span-2 mt-2">
                        <button type="button" onClick={() => setEditingHotel(null)} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">Vazgeç</button>
                        <button type="submit" className="px-5 py-2 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold shadow-sm"><Save size={12} className="inline mr-1"/>Kaydet</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
           
            {/* SOL PANEL: Otel Seçimi */}
            <div className="lg:col-span-3 lg:sticky lg:top-0 space-y-4 print:hidden">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[calc(100vh-140px)] flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Search size={16} className="text-blue-500"/>
                  Otel Arama & Seçim
                </h3>
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Şehir, kod veya otel ara..."
                    className="w-full border border-slate-300 pl-8 pr-3 py-2 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scroll">
                  {filteredHotels.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">Sonuç bulunamadı.</div>
                  ) : (
                    filteredHotels.map(h => (
                      <div
                        key={h.id}
                        onClick={() => setSelectedHotel(h)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedHotel?.id === h.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400/50 shadow-sm' : 'hover:bg-slate-50 border-slate-200 bg-white'}`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`text-xs font-bold ${selectedHotel?.id === h.id ? 'text-blue-800' : 'text-slate-800'}`}>{h.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border ${selectedHotel?.id === h.id ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{h.code}</span>
                        </div>
                        <div className={`text-[10px] flex items-center gap-1 font-medium ${selectedHotel?.id === h.id ? 'text-blue-600/80' : 'text-slate-500'}`}>
                           <Building2 size={10} /> {h.city} • <span title={h.email} className="truncate">{h.email.split(',')[0]}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* SAĞ PANEL: Rezervasyon Formu */}
            <div className="lg:col-span-9 flex flex-col min-h-[calc(100vh-140px)]">
              {selectedHotel ? (
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 print:hidden animate-in fade-in">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Hedef Tesis: <span className="font-black text-slate-800 text-sm tracking-tight">{selectedHotel.name}</span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-bold transition-colors shadow-sm">
                        <Printer size={14} /> Yazdır / PDF Seç
                      </button>
                      <button onClick={generateMailto} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-sm shadow-blue-600/20">
                        <Mail size={14} /> Form E-postala
                      </button>
                    </div>
                  </div>

                  {/* FORM KAĞIDI */}
                  <div className="bg-white shadow-md border border-slate-300 mx-auto print:shadow-none print:border-none print:w-full rounded-sm" style={{ minHeight: '297mm', padding: '15mm' }}>
                   
                    {/* Header (LOGO KISMI) */}
                    <div className="flex justify-between items-end border-b-[3px] border-black pb-4 mb-8">
                      <div>
                        {/* Dinamik Logo */}
                        <img
                          src={logoUrl}
                          alt="Company Logo"
                          className="h-16 mb-2 object-contain"
                          onError={(e) => {
                               (e.target as HTMLImageElement).style.display = 'none';
                               ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'block';
                          }}
                        />
                        <div className="hidden h-16 items-center">
                            <h1 className="text-4xl font-black text-red-600 tracking-tighter" style={{ fontFamily: 'Arial, sans-serif' }}>COMPANY</h1>
                            <span className="text-slate-900 text-xl font-bold ml-2 mt-2">AIRLINES</span>
                        </div>
                       
                        <p className="text-sm font-black text-slate-600 tracking-widest mt-2 uppercase">Company Hotel Reservation Form</p>
                      </div>
                      <div className="text-right text-[10px] font-mono leading-relaxed font-semibold">
                        <div>DATE ISSUED: {new Date().toLocaleDateString('tr-TR')}</div>
                        <div>SYSTEM REF: PG-{Math.floor(Math.random() * 100000)} / A</div>
                        <div>PAGE: 1 OF 1</div>
                      </div>
                    </div>

                    {/* TO / FROM BLOCKS */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      {/* TO */}
                      <div className="border-[1.5px] border-black p-4 relative pt-5">
                        <span className="absolute -top-3 left-3 bg-white px-2 font-black text-sm tracking-wider">TO (HOTEL)</span>
                        <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
                          <div className="font-bold text-slate-600 tracking-widest">NAME:</div><div className="uppercase font-black text-sm">{selectedHotel.name}</div>
                          <div className="font-bold text-slate-600 tracking-widest">ATTN:</div><div className="font-bold">RESERVATION DEPARTMENT</div>
                          <div className="font-bold text-slate-600 tracking-widest">TEL:</div><div className="font-medium">{selectedHotel.phone || '-'}</div>
                          <div className="font-bold text-slate-600 tracking-widest">EMAIL:</div><div className="break-words font-medium">{selectedHotel.email}</div>
                        </div>
                      </div>

                      {/* FROM */}
                      <div className="border-[1.5px] border-black p-4 relative pt-5 bg-slate-50/50 print:bg-transparent">
                        <span className="absolute -top-3 left-3 bg-white px-2 font-black text-sm tracking-wider">FROM (SENDER)</span>
                        <div className="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
                          <div className="font-bold text-slate-600 tracking-widest">DEPT:</div><div className="font-bold">CREW CONTROL / OPERATIONS</div>
                          <div className="font-bold text-slate-600 tracking-widest">COMPANY:</div><div className="font-black">COMPANY AIRLINES INC.</div>
                          <div className="font-bold text-slate-600 tracking-widest">TEL:</div><div className="font-medium">+90 216 XXX XX X1</div>
                          <div className="font-bold text-slate-600 tracking-widest">DATE:</div>
                          <div className="flex items-center group">
                             <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="font-mono bg-transparent w-full font-bold outline-none border-b border-transparent group-hover:border-slate-300 focus:border-black transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* GUEST LIST TABLE */}
                    <div className="mb-8 relative">
                      <h3 className="font-black border-b-2 border-black mb-3 text-sm tracking-wider py-1">ACCOMMODATION DETAILS</h3>
                      <table className="w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100/50 print:bg-slate-100 text-slate-700">
                            <th className="border-[1.5px] border-black p-2 w-8 font-black">#</th>
                            <th className="border-[1.5px] border-black p-2 text-left font-black">NAME AND SURNAME</th>
                            <th className="border-[1.5px] border-black p-2 w-10 text-center font-black">SNG</th>
                            <th className="border-[1.5px] border-black p-2 w-10 text-center font-black">DBL</th>
                            <th className="border-[1.5px] border-black p-2 w-[140px] text-center font-black">CHECK-IN (Flt/Date/Time)</th>
                            <th className="border-[1.5px] border-black p-2 w-[140px] text-center font-black">CHECK-OUT (Flt/Date/Time)</th>
                            <th className="border-[1.5px] border-black p-2 text-left font-black w-40">REMARKS / INFO</th>
                            <th className="border border-r-0 border-t-0 p-2 w-8 print:hidden border-b-0 border-white"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {guests.map((guest, index) => (
                            <tr key={guest.id} className="group">
                              <td className="border-[1.5px] border-black p-2 text-center font-black text-slate-500">{index + 1}</td>
                              <td className="border-[1.5px] border-black p-1 bg-yellow-50/10">
                                <input
                                  type="text"
                                  value={guest.name}
                                  onChange={(e) => updateGuest(guest.id, 'name', e.target.value)}
                                  className="w-full uppercase font-bold outline-none bg-transparent placeholder-slate-300"
                                  placeholder="GUEST NAME"
                                />
                              </td>
                              <td className="border-[1.5px] border-black p-1 text-center bg-slate-50 print:bg-transparent">
                                <input type="checkbox" checked={guest.sng} onChange={(e) => updateGuest(guest.id, 'sng', e.target.checked)} className="w-3.5 h-3.5 accent-black cursor-pointer" />
                              </td>
                              <td className="border-[1.5px] border-black p-1 text-center bg-slate-50 print:bg-transparent">
                                <input type="checkbox" checked={guest.dbl} onChange={(e) => updateGuest(guest.id, 'dbl', e.target.checked)} className="w-3.5 h-3.5 accent-black cursor-pointer" />
                              </td>
                              
                              {/* C/IN */}
                              <td className="border-[1.5px] border-black p-1 align-top bg-blue-50/20">
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    type="text"
                                    value={guest.entryCode}
                                    onChange={(e) => updateGuest(guest.id, 'entryCode', e.target.value)}
                                    className="w-full text-[11px] font-bold outline-none bg-transparent placeholder-slate-400 p-0.5"
                                    placeholder="Arrival Flt."
                                  />
                                  <div className="flex border-t border-slate-200/50 mt-0.5 pt-0.5">
                                    <input
                                      type="date"
                                      value={guest.entryDate}
                                      onChange={(e) => updateGuest(guest.id, 'entryDate', e.target.value)}
                                      className="w-full text-[9px] outline-none bg-transparent font-medium"
                                    />
                                    <input
                                      type="time"
                                      value={guest.entryTime}
                                      onChange={(e) => updateGuest(guest.id, 'entryTime', e.target.value)}
                                      className="w-full max-w-[45px] text-[9px] outline-none bg-transparent font-bold"
                                    />
                                  </div>
                                </div>
                              </td>
                              
                              {/* C/OUT */}
                              <td className="border-[1.5px] border-black p-1 align-top bg-red-50/20">
                                <div className="flex flex-col gap-0.5">
                                  <input
                                    type="text"
                                    value={guest.exitCode}
                                    onChange={(e) => updateGuest(guest.id, 'exitCode', e.target.value)}
                                    className="w-full text-[11px] font-bold outline-none bg-transparent placeholder-slate-400 p-0.5"
                                    placeholder="Depart Flt."
                                  />
                                  <div className="flex border-t border-slate-200/50 mt-0.5 pt-0.5">
                                    <input
                                      type="date"
                                      value={guest.exitDate}
                                      onChange={(e) => updateGuest(guest.id, 'exitDate', e.target.value)}
                                      className="w-full text-[9px] outline-none bg-transparent font-medium"
                                    />
                                    <input
                                      type="time"
                                      value={guest.exitTime}
                                      onChange={(e) => updateGuest(guest.id, 'exitTime', e.target.value)}
                                      className="w-full max-w-[45px] text-[9px] outline-none bg-transparent font-bold"
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* REMARKS */}
                              <td className="border-[1.5px] border-black p-1">
                                <input type="text" value={guest.remarks} onChange={(e) => updateGuest(guest.id, 'remarks', e.target.value)} className="w-full outline-none bg-transparent text-[10px] italic" placeholder="Add specific note..." />
                              </td>

                              <td className="p-1 pl-2 text-center print:hidden border-none align-middle w-8">
                                {guests.length > 1 && (
                                  <button onClick={() => removeGuest(guest.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100" title="Satırı Sil"><Trash2 size={13} /></button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Floating Add Btn */}
                      <button onClick={addGuestRow} className="absolute -left-3 rounded-full mt-3 flex items-center justify-center p-2 bg-slate-800 text-white shadow-md hover:bg-slate-700 transition-transform hover:scale-110 print:hidden" title="Yeni Kişi Satırı Ekle">
                         <Plus size={16}/>
                      </button>
                    </div>

                    {/* Footer Text */}
                    <div className="text-[10px] font-medium border-t-[3px] border-black pt-4 mt-12">
                      <p className="font-bold text-sm tracking-wider mb-2">NOTES & INSTRUCTIONS:</p>
                      <ul className="list-disc pl-5 space-y-1.5 uppercase font-medium text-slate-700">
                        <li>Please confirm availability and rates via email return upon receiving this request.</li>
                        <li>Payment will be covered by Company Account / Invoice unless specified otherwise.</li>
                        <li>Extra expenses (minibar, phone, dry cleaning etc.) belong to the guest and should be charged personally.</li>
                      </ul>
                    </div>

                    <div className="mt-16 flex justify-between items-end px-10">
                       <div className="text-center">
                          <div className="border-b border-black w-48 mb-2"></div>
                          <div className="text-xs font-bold tracking-widest text-slate-600">AUTHORIZED SIGNATURE</div>
                       </div>
                       <div className="text-center">
                          <div className="border-dashed border-b border-black w-48 mb-2"></div>
                          <div className="text-xs font-bold tracking-widest text-slate-600">HOTEL CONFIRMATION & STAMP</div>
                       </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50 print:hidden m-4 min-h-[400px]">
                  <div className="bg-slate-100 p-6 rounded-full mb-6">
                     <Building2 size={48} className="text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">Otel Seçimi Yapın</h3>
                  <p className="text-sm text-slate-500 max-w-sm text-center leading-relaxed">Rezervasyon formu oluşturabilmek için lütfen sol taraftaki listeden işlem yapmak istediğiniz oteli seçin veya aratın.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
