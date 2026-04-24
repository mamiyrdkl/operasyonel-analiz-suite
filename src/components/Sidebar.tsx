'use client';

import { PieChart, ArrowLeftRight, Settings, CalendarDays, Clock, Building2, LogOut, PlaneTakeoff } from 'lucide-react';
import { AppType } from '@/app/page';

interface SidebarProps {
  currentApp: AppType;
  goBackToPortal: () => void;
  activeTab: 'analysis' | 'comparison' | 'crewDelay';
  setActiveTab: (tab: 'analysis' | 'comparison' | 'crewDelay') => void;
  openAdminModal: () => void;
}

const fixedHolidays: Record<string, string> = {
  "01-01": "Yılbaşı", "23-04": "23 Nisan Ulusal Egemenlik", "01-05": "1 Mayıs İşçi Bayramı", 
  "19-05": "19 Mayıs Atatürk'ü Anma", "15-07": "15 Temmuz Demokrasi", "30-08": "30 Ağustos Zafer Bayramı", 
  "29-10": "29 Ekim Cumhuriyet Bayramı"
};

const religiousHolidays: Record<string, string> = {
  "10-04-2024": "Ramazan Bayramı", "11-04-2024": "Ramazan Bayramı", "12-04-2024": "Ramazan Bayramı",
  "16-06-2024": "Kurban Bayramı", "17-06-2024": "Kurban Bayramı", "18-06-2024": "Kurban Bayramı", "19-06-2024": "Kurban Bayramı",
  
  "30-03-2025": "Ramazan Bayramı", "31-03-2025": "Ramazan Bayramı", "01-04-2025": "Ramazan Bayramı",
  "06-06-2025": "Kurban Bayramı", "07-06-2025": "Kurban Bayramı", "08-06-2025": "Kurban Bayramı", "09-06-2025": "Kurban Bayramı",

  "20-03-2026": "Ramazan Bayramı", "21-03-2026": "Ramazan Bayramı", "22-03-2026": "Ramazan Bayramı",
  "27-05-2026": "Kurban Bayramı", "28-05-2026": "Kurban Bayramı", "29-05-2026": "Kurban Bayramı", "30-05-2026": "Kurban Bayramı"
};

export default function Sidebar({ currentApp, goBackToPortal, activeTab, setActiveTab, openAdminModal }: SidebarProps) {
  const linkBaseClasses = 'flex items-center gap-3 px-4 py-3 mb-2 rounded-lg text-[0.9rem] font-medium transition-all cursor-pointer';
  const getLinkClasses = (isActive: boolean) => 
    isActive 
      ? `${linkBaseClasses} bg-red-600 text-white shadow-md shadow-red-600/40`
      : `${linkBaseClasses} text-slate-400 hover:bg-slate-800 hover:text-white`;

  const renderCalendar = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); 
    const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    
    const days = [];
    for(let i = 0; i < startDay; i++) {
       days.push(<div key={`empty-${i}`} className="py-1"></div>);
    }
    
    for(let i = 1; i <= daysInMonth; i++) {
       const shortDateStr = `${String(i).padStart(2,'0')}-${String(currentMonth + 1).padStart(2,'0')}`;
       const fullDateStr = `${shortDateStr}-${currentYear}`;
       const holidayName = fixedHolidays[shortDateStr] || religiousHolidays[fullDateStr];
       const isHoliday = !!holidayName;
       const isToday = i === currentDay;
       
       let bgClass = "hover:bg-slate-700 text-slate-400";
       if (isToday) bgClass = "bg-blue-600 text-white font-bold shadow-sm";
       else if (isHoliday) bgClass = "bg-red-500/20 text-red-400 font-bold border border-red-500/30";
       
       days.push(<div key={i} className={`text-center text-[10px] py-1 rounded transition-colors cursor-default ${bgClass}`} title={isHoliday ? holidayName : ''}>{i}</div>);
    }

    return (
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 shadow-lg mt-auto mb-4 mx-4">
          <div className="flex justify-between items-center mb-3">
             <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-blue-400"/> {monthNames[currentMonth]} {currentYear}</span>
             <span className="text-[8px] font-bold tracking-widest text-red-300 uppercase px-1 border border-red-400/30 rounded bg-red-400/10">Tatil</span>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
             {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => <div key={d} className="text-center text-[9px] font-bold text-slate-500">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
             {days}
          </div>
      </div>
    )
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 shadow-xl z-20">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-white p-1.5 rounded-lg flex items-center justify-center shadow-sm h-10 w-auto min-w-[40px] overflow-hidden">
          <div className="text-red-600 flex items-center justify-center font-black">PEG</div>
        </div>
        <div className="flex flex-col">
           <span className="font-bold text-[15px] tracking-tight text-white mb-0.5 mt-0.5 leading-none">
              {currentApp === 'HOTEL' ? 'Otel Paneli' : currentApp === 'CHECK_IN' ? 'Check-In Paneli' : 'Analiz Suite'}
           </span>
           <span className="text-[10px] text-slate-400">v2.1 Workspace</span>
        </div>
      </div>
      
      <nav className="flex-1 pt-4 overflow-y-auto flex flex-col custom-scroll">
        
        {/* Back to Portal Button */}
        <div className="px-4 mb-4 border-b border-slate-800 pb-4">
           <div onClick={goBackToPortal} className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-red-600/80 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm">
              <LogOut size={14} /> Ana Portala Dön
           </div>
        </div>

        {currentApp === 'ANALYSIS_SUITE' && (
           <>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 px-6 tracking-wider">Analiz Modülleri</div>
              <div className="px-4">
                  <div onClick={() => setActiveTab('analysis')} className={getLinkClasses(activeTab === 'analysis')}>
                    <PieChart className="w-5 h-5 text-center" /> 
                    <span>Ekip Gecikme Paneli</span>
                  </div>

                  <div onClick={() => setActiveTab('comparison')} className={getLinkClasses(activeTab === 'comparison')}>
                    <ArrowLeftRight className="w-5 h-5 text-center" /> 
                    <span>Yıllık Karşılaştırma</span>
                  </div>
              </div>
           </>
        )}

        {currentApp === 'HOTEL' && (
           <>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 px-6 tracking-wider">Rezervasyon</div>
              <div className="px-4">
                  <div className={getLinkClasses(true)}>
                    <Building2 className="w-5 h-5 text-center" /> 
                    <span>Otel Anlaşmaları</span>
                  </div>
              </div>
           </>
        )}

        {currentApp === 'CHECK_IN' && (
           <>
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-3 px-6 tracking-wider">İzleme Modülü</div>
              <div className="px-4">
                  <div className={getLinkClasses(true)}>
                    <PlaneTakeoff className="w-5 h-5 text-center" /> 
                    <span>Gelişmiş Check-In</span>
                  </div>
              </div>
           </>
        )}
        
        {currentApp === 'ANALYSIS_SUITE' && (
          <>
            <div className="mt-8 text-[10px] font-bold text-slate-500 uppercase mb-3 px-6 tracking-wider">Yönetim Paneli</div>
            <div className="px-4 mb-6">
                <div onClick={openAdminModal} className={`${linkBaseClasses} text-slate-400 hover:text-white hover:bg-slate-800`}>
                  <Settings className="w-5 h-5 text-center" /> 
                  <span>Ayarlar & Tanımlar</span>
                </div>
            </div>
          </>
        )}

        {/* Dynamic Operational Mini Calendar */}
        {renderCalendar()}
      </nav>
      
      <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center font-mono">
        v2.0 - React Edition
      </div>
    </aside>
  );
}
