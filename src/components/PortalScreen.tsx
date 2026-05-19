'use client';
import { Building2, ArrowRight, PlaneTakeoff, ClipboardList } from 'lucide-react';

interface PortalScreenProps {
  onSelectApp: (app: 'ANALYSIS_SUITE' | 'HOTEL' | 'CHECK_IN' | 'DELAY_TRACKING') => void;
}

export default function PortalScreen({ onSelectApp }: PortalScreenProps) {
  return (
    <div className="min-h-screen w-full bg-slate-900 bg-[url('/pegasus-wing.png')] bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden">
      
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]"></div>

      {/* Cabin window frame - left panel: oval window with Pegasus tail visible outside */}
      <div className="absolute left-0 top-0 bottom-0 w-[300px] pointer-events-none z-0" style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(15,23,42,0) 0%, rgba(15,23,42,0.98) 72%)',
      }}>
        {/* Oval window outer frame */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2" style={{ width: '190px', height: '240px' }}>
          {/* Window border - thick plastic frame */}
          <div className="absolute inset-0 rounded-[50%] border-[14px] border-slate-500/70" style={{
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.7), inset 0 0 80px rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.5)',
          }}/>
          {/* Sky visible through window */}
          <div className="absolute inset-[14px] rounded-[50%] overflow-hidden" style={{
            background: 'linear-gradient(180deg, rgba(56,130,200,0.25) 0%, rgba(100,160,230,0.15) 60%, rgba(200,220,255,0.08) 100%)',
          }}>
            {/* Pegasus aircraft TAIL silhouette visible through window */}
            <svg viewBox="0 0 160 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.55 }}>
              {/* Main tail fin (vertical stabilizer) */}
              <polygon points="72,170 88,170 95,80 65,80" fill="white"/>
              {/* Tail fin top sweep */}
              <path d="M65,80 Q78,20 88,30 L95,80 Z" fill="white"/>
              {/* Fuselage rear section (tapered tube) */}
              <ellipse cx="80" cy="168" rx="18" ry="8" fill="white"/>
              <rect x="62" y="130" width="36" height="40" rx="4" fill="white"/>
              {/* Left horizontal stabilizer */}
              <polygon points="62,148 10,135 10,128 62,140" fill="rgba(255,255,255,0.85)"/>
              {/* Right horizontal stabilizer */}
              <polygon points="98,148 150,135 150,128 98,140" fill="rgba(255,255,255,0.85)"/>
              {/* Engine exhaust glow */}
              <ellipse cx="80" cy="176" rx="8" ry="4" fill="rgba(255,200,100,0.4)"/>
              {/* Fuselage windows row (tiny) */}
              <rect x="66" y="143" width="6" height="4" rx="1" fill="rgba(147,210,255,0.7)"/>
              <rect x="75" y="143" width="6" height="4" rx="1" fill="rgba(147,210,255,0.7)"/>
              <rect x="84" y="143" width="6" height="4" rx="1" fill="rgba(147,210,255,0.7)"/>
              {/* Distance haze */}
              <ellipse cx="80" cy="160" rx="40" ry="60" fill="rgba(150,190,255,0.05)"/>
            </svg>
          </div>
          {/* Window glare/reflection */}
          <div className="absolute inset-[14px] rounded-[50%]" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)',
          }}/>
          {/* Inner window seal ring */}
          <div className="absolute inset-[10px] rounded-[50%] border border-slate-400/20"/>
        </div>
      </div>


      <div className="relative z-10 max-w-6xl w-full px-6 flex flex-col items-center">
        
        {/* HEADER */}
        <div className="text-center mb-16 animate-in fade-in slide-in-from-top-10 duration-1000">
           <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-2xl">
              <PlaneTakeoff className="w-10 h-10 text-white" />
           </div>
           <h1 className="text-5xl font-black text-white tracking-tight drop-shadow-lg">Şirket Ana Portalı</h1>
           <p className="text-slate-300 mt-4 max-w-2xl mx-auto font-medium text-lg drop-shadow">
              Operasyon ve kurum içi modüllere erişim platformu. Lütfen giriş yapmak istediğiniz sistemi seçin.
           </p>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          
          {/* ANALYSIS SUITE CARD */}
          <div 
            onClick={() => onSelectApp('ANALYSIS_SUITE')}
            className="group cursor-pointer bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col items-center text-center"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             
             <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-600/30 group-hover:scale-110 transition-transform duration-500">
                <PlaneTakeoff className="w-8 h-8 text-white" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Ekip Gecikme Takip</h2>
             <p className="text-slate-300 leading-relaxed font-medium mb-6 text-sm">
                Amir ve vardiya bazlı detaylı ekip gecikme analizleri ile yıllık / dönemsel gecikme karşılaştırma modüllerini barındıran tam teşekküllü ekran.
             </p>
             
             <div className="mt-auto flex items-center justify-center gap-2 bg-white/10 px-5 py-2.5 text-sm rounded-full text-white font-bold group-hover:bg-red-600 transition-colors">
                Uygulamaya Git <ArrowRight size={16} />
             </div>
          </div>

          {/* CHECK-IN CARD */}
          <div 
            onClick={() => onSelectApp('CHECK_IN')}
            className="group cursor-pointer bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col items-center text-center"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             
             <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-teal-600/30 group-hover:scale-110 transition-transform duration-500">
                <PlaneTakeoff className="w-8 h-8 text-white" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Check-In Kontrol</h2>
             <p className="text-slate-300 leading-relaxed font-medium mb-6 text-sm">
                Check-in yapamayan veya eksik işlemi bulunan uçuş ekiplerini tespit ederek base'e, duty'e veya pass uçuşa göre akıllı filtreleme yapın.
             </p>
             
             <div className="mt-auto flex items-center justify-center gap-2 bg-white/10 px-5 py-2.5 text-sm rounded-full text-white font-bold group-hover:bg-teal-600 transition-colors">
                Uygulamaya Git <ArrowRight size={16} />
             </div>
          </div>

          {/* HOTEL RESERVATION CARD */}
          <div 
            onClick={() => onSelectApp('HOTEL')}
            className="group cursor-pointer bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col items-center text-center"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             
             <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30 group-hover:scale-110 transition-transform duration-500">
                <Building2 className="w-8 h-8 text-white" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Otel Rezervasyon</h2>
             <p className="text-slate-300 leading-relaxed font-medium mb-6 text-sm">
                Kurumsal otel anlaşmaları, ekip ve yolcu rezervasyon fişleri, PDF çıktıları ve yönetim modülünü barındıran konaklama platformu.
             </p>
             
             <div className="mt-auto flex items-center justify-center gap-2 bg-white/10 px-5 py-2.5 text-sm rounded-full text-white font-bold group-hover:bg-blue-600 transition-colors">
                Uygulamaya Git <ArrowRight size={16} />
             </div>
          </div>


          {/* DELAY TRACKING CARD */}
          <div 
            onClick={() => onSelectApp('DELAY_TRACKING')}
            className="group cursor-pointer bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col items-center text-center"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             
             <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-amber-600/30 group-hover:scale-110 transition-transform duration-500">
                <ClipboardList className="w-8 h-8 text-white" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Gecikme Takip</h2>
             <p className="text-slate-300 leading-relaxed font-medium mb-6 text-sm">
                Günlük uçuşlarda yaşanan gecikmeleri kayıt altına alan, pairing/bildirim/SMS durumlarını takip eden operasyonel görev izleme ekranı.
             </p>
             
             <div className="mt-auto flex items-center justify-center gap-2 bg-white/10 px-5 py-2.5 text-sm rounded-full text-white font-bold group-hover:bg-amber-600 transition-colors">
                Uygulamaya Git <ArrowRight size={16} />
             </div>
          </div>

        </div>

      </div>
    </div>
  );
}
