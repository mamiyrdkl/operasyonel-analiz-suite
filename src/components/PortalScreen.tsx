'use client';
import { Building2, ArrowRight, PlaneTakeoff } from 'lucide-react';

interface PortalScreenProps {
  onSelectApp: (app: 'ANALYSIS_SUITE' | 'HOTEL' | 'CHECK_IN') => void;
}

export default function PortalScreen({ onSelectApp }: PortalScreenProps) {
  return (
    <div className="min-h-screen w-full bg-slate-900 bg-[url('/pegasus-wing.png')] bg-cover bg-center bg-no-repeat flex items-center justify-center relative overflow-hidden">
      
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"></div>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          
          {/* ANALYSIS SUITE CARD */}
          <div 
            onClick={() => onSelectApp('ANALYSIS_SUITE')}
            className="group cursor-pointer bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-2xl hover:-translate-y-2 relative overflow-hidden flex flex-col items-center text-center"
          >
             <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             
             <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-600/30 group-hover:scale-110 transition-transform duration-500">
                <PlaneTakeoff className="w-8 h-8 text-white" strokeWidth={2.5} />
             </div>
             
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight drop-shadow-md">Analiz Suite</h2>
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

        </div>

      </div>
    </div>
  );
}
