'use client';
import { Clock, Building2, ArrowLeftRight, Settings, PlaneTakeoff, ShieldCheck } from 'lucide-react';

interface HomeTabProps {
  setActiveTab: (tab: 'home' | 'analysis' | 'comparison' | 'crewDelay' | 'hotelReservation') => void;
}

export default function HomeTab({ setActiveTab }: HomeTabProps) {
  return (
      <div className="flex-1 overflow-auto custom-scroll p-8 bg-slate-50 h-[100vh]">
        <div className="max-w-6xl mx-auto h-full flex flex-col justify-center pb-20">
           
           {/* YUKARI HEADER KISMI */}
           <div className="mb-14 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-600/30">
                <PlaneTakeoff className="w-10 h-10 text-white" />
             </div>
             <h1 className="text-4xl font-black text-slate-800 tracking-tight">Operasyonel Analiz Suite</h1>
             <p className="text-slate-500 mt-4 max-w-2xl mx-auto font-medium text-lg">
                Günlük operasyon yönetimi, gecikme analizleri ve konaklama çözümlerinizi tek platformdan, güvenle ve kolayca yönetin. Lütfen giriş yapmak istediğiniz <strong>modülü seçin.</strong>
             </p>
           </div>
           
           {/* MODÜL KARTLARI */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150">
               
               {/* CREW DELAY KARTI */}
               <div onClick={() => setActiveTab('crewDelay')} className="bg-white rounded-3xl p-8 border border-transparent shadow-xl shadow-slate-200/50 cursor-pointer hover:-translate-y-2 hover:border-red-500 hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300 group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-red-500 opacity-5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-[2] transition-transform duration-700"></div>
                   <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-red-100">
                      <Clock strokeWidth={2.5} size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Gecikme Analizi Paneli</h3>
                   <p className="text-sm text-slate-500 leading-relaxed font-medium">Uçuş personel kaynaklı aylık veya günlük gecikme (Excel) raporlarını yükleyin. OTP oranlarını, gecikme kodlarını ve şef bazlı performansı dinamik grafiklerle görün.</p>
                   
                   <div className="mt-8 flex items-center font-bold text-xs text-red-600 uppercase tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       Modüle Gir &rarr;
                   </div>
               </div>

               {/* HOTELS KARTI */}
               <div onClick={() => setActiveTab('hotelReservation')} className="bg-white rounded-3xl p-8 border border-transparent shadow-xl shadow-slate-200/50 cursor-pointer hover:-translate-y-2 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 opacity-5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-[2] transition-transform duration-700"></div>
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-blue-100">
                      <Building2 strokeWidth={2.5} size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Otel Rezervasyon</h3>
                   <p className="text-sm text-slate-500 leading-relaxed font-medium">Kurumsal anlaşmalı otellere saniyeler içinde formatlı otomatik rezervasyon/konaklama belgeleri oluşturun, Outlook veya PDF üzerinden otellere kolayca iletin.</p>
                   
                   <div className="mt-8 flex items-center font-bold text-xs text-blue-600 uppercase tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       Modüle Gir &rarr;
                   </div>
               </div>

               {/* KARŞILAŞTIRMA KARTI */}
               <div onClick={() => setActiveTab('comparison')} className="bg-white rounded-3xl p-8 border border-transparent shadow-xl shadow-slate-200/50 cursor-pointer hover:-translate-y-2 hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 group relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 opacity-5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-[2] transition-transform duration-700"></div>
                   <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-emerald-100">
                      <ArrowLeftRight strokeWidth={2.5} size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Yıllık Karşılaştırma</h3>
                   <p className="text-sm text-slate-500 leading-relaxed font-medium">Önceki yıllarla ve farklı periyotlarla aranızdaki operasyonel gecikme/kayıp analizlerini bağımsız iki farklı Excel yüklemesi yaparak hızla taraf tarafa mukayese edin.</p>
                   
                   <div className="mt-8 flex items-center font-bold text-xs text-emerald-600 uppercase tracking-widest gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       Modüle Gir &rarr;
                   </div>
               </div>

           </div>
           
           {/* FOOTER */}
           <div className="mt-16 text-center text-[11px] font-bold text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-widest animate-in fade-in duration-1000 delay-300">
              <ShieldCheck size={16} className="text-emerald-500" /> Developed & Secured by Company System
           </div>

        </div>
      </div>
  );
}
