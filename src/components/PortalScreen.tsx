'use client';
import { Building2, ArrowRight, PlaneTakeoff, ClipboardList } from 'lucide-react';

interface PortalScreenProps {
  onSelectApp: (app: 'ANALYSIS_SUITE' | 'HOTEL' | 'CHECK_IN' | 'DELAY_TRACKING') => void;
}

export default function PortalScreen({ onSelectApp }: PortalScreenProps) {
  return (
    <div className="min-h-screen w-full bg-slate-900 bg-[url('/pegasus-wing.png')] bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden">
      
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px]"></div>

      {/* Aircraft window frame effect - left side */}
      <div className="absolute left-0 top-0 bottom-0 w-[260px] pointer-events-none z-0" style={{
        background: 'radial-gradient(ellipse at left center, transparent 55%, rgba(15,23,42,0.95) 80%)',
      }}>
        {/* Oval window frame */}
        <div className="absolute left-8 top-1/2 -translate-y-1/2" style={{ width: '180px', height: '220px' }}>
          <div className="absolute inset-0 rounded-[50%] border-[10px] border-slate-600/60 shadow-2xl" style={{
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,0,0,0.4)',
            background: 'linear-gradient(135deg, rgba(147,197,253,0.08) 0%, rgba(96,165,250,0.04) 100%)',
          }}/>
          {/* Window inner reflection */}
          <div className="absolute top-4 left-4 w-12 h-6 rounded-full bg-white/5 rotate-[-20deg]"/>
        </div>
      </div>

      {/* Distant Pegasus aircraft silhouette - right center area */}
      <div className="absolute right-[12%] top-1/2 -translate-y-[60%] z-0 pointer-events-none opacity-30">
        <svg viewBox="0 0 600 200" width="500" height="170" xmlns="http://www.w3.org/2000/svg">
          {/* Fuselage */}
          <ellipse cx="300" cy="100" rx="230" ry="28" fill="white"/>
          {/* Nose */}
          <ellipse cx="530" cy="100" rx="40" ry="18" fill="white"/>
          {/* Tail fin */}
          <polygon points="70,100 90,50 110,100" fill="white"/>
          {/* Horizontal stabilizer left */}
          <polygon points="80,100 60,130 110,110" fill="white"/>
          {/* Horizontal stabilizer right */}
          <polygon points="80,100 60,70 110,90" fill="white"/>
          {/* Main wing - top */}
          <polygon points="270,96 200,20 350,88" fill="white"/>
          {/* Main wing - bottom */}
          <polygon points="270,104 200,180 350,112" fill="white"/>
          {/* Engine pod under wing */}
          <ellipse cx="225" cy="115" rx="35" ry="10" fill="rgba(255,255,255,0.7)"/>
          <ellipse cx="225" cy="85" rx="35" ry="10" fill="rgba(255,255,255,0.7)"/>
          {/* Windows row */}
          {[400,430,460,490,510].map((x, i) => (
            <ellipse key={i} cx={x} cy="96" rx="7" ry="5" fill="rgba(147,210,255,0.6)"/>
          ))}
        </svg>
      </div>

      {/* Subtle Pegasus text watermark on wing area */}
      <div className="absolute bottom-8 right-12 z-0 pointer-events-none opacity-10 text-white font-black text-[80px] tracking-tighter select-none" style={{ fontFamily: 'Arial Black, sans-serif' }}>
        PEGASUS
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
