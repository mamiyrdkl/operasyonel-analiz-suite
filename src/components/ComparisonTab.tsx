'use client';
import { useState } from 'react';
import { ArrowLeftRight, UploadCloud, Play, FileSpreadsheet, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HEADER_ALIASES, findColumnIndex, parseFlightDate, cleanStr, extractDelayColumns } from '@/lib/excelParser';
import { useSettings } from '@/lib/useSettings';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

type TimeStats = {
   timeKey: string; 
   totalFlights: number;
   onTime: number; 
   totalDelayMins: number; 
   crewDelayCount: number; 
   crewDelayMins: number; 
};

type YearData = {
   yearLabel: string;
   stats: Record<string, TimeStats>;
};

export default function ComparisonTab() {
  const { delayCodes } = useSettings();
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ y1: YearData, y2: YearData } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, num: 1 | 2) => {
    const file = e.target.files?.[0];
    if (file) {
      if (num === 1) setFile1(file);
      else setFile2(file);
    }
  };

  const parseYearlyData = async (file: File, fallbackLabel: string): Promise<YearData | null> => {
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
             try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: 'array' });
                const rawData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
                
                let headerRowIndex = -1;
                let maxMatchCount = 0;
                
                for (let i = 0; i < Math.min(100, rawData.length); i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0) continue;
                    let currentScore = 0;
                    if (findColumnIndex(row, HEADER_ALIASES.flight) !== -1) currentScore += 10;
                    if (findColumnIndex(row, HEADER_ALIASES.dateLong) !== -1 || findColumnIndex(row, HEADER_ALIASES.std) !== -1) currentScore += 5;
                    row.forEach((c: any) => {
                        const str = cleanStr(c);
                        if(str.includes('DELAY') || str.includes('GECIKME')) currentScore += 1;
                    });
                    if (currentScore > maxMatchCount) { maxMatchCount = currentScore; headerRowIndex = i; }
                }

                if (headerRowIndex === -1) { resolve(null); return; }

                const headerRow = rawData[headerRowIndex];
                const idxFlight = findColumnIndex(headerRow, HEADER_ALIASES.flight);
                const idxDateLong = findColumnIndex(headerRow, HEADER_ALIASES.dateLong);
                const idxStd = findColumnIndex(headerRow, HEADER_ALIASES.std);
                const delayCols = extractDelayColumns(headerRow);

                const stats: Record<string, TimeStats> = {};
                let detectedYear = fallbackLabel;
                const fileYearMatch = file.name.match(/(20\d{2})/);
                if (fileYearMatch) detectedYear = fileYearMatch[1];
                let lastValidDate: Date | null = null;

                for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0 || idxFlight === -1 || !row[idxFlight]) continue;

                    let dateObj: Date | null = null;
                    if (idxDateLong !== -1) dateObj = parseFlightDate(row[idxDateLong], false);
                    if (!dateObj && idxStd !== -1) dateObj = parseFlightDate(row[idxStd], false); 
                    
                    if (!dateObj && lastValidDate) dateObj = new Date(lastValidDate.getTime());
                    else if (dateObj) lastValidDate = dateObj;
                    else continue;
                    
                    const yr = dateObj.getUTCFullYear();
                    if (detectedYear === fallbackLabel && !fileYearMatch && yr > 2000 && yr <= 2100) {
                        detectedYear = yr.toString();
                    }

                    // Dynamically Generate Day/Month Time Key natively 
                    const d = String(dateObj.getUTCDate()).padStart(2, '0');
                    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                    const timeKey = `${d}/${m}`;
                    
                    if (!stats[timeKey]) {
                        stats[timeKey] = { timeKey, totalFlights: 0, onTime: 0, totalDelayMins: 0, crewDelayCount: 0, crewDelayMins: 0 };
                    }

                    let flightTotalDelayMins = 0;
                    let hasCrewDelay = false;
                    let flightCrewDelayMins = 0;

                    delayCols.forEach((g: any) => {
                        const code = cleanStr(row[g.codeIdx]);
                        const time = parseInt(row[g.timeIdx] || "0");
                        flightTotalDelayMins += time;
                        
                        const isCrewCode = delayCodes.find(c => c.code === code);
                        if (isCrewCode && time >= 15) {
                            hasCrewDelay = true;
                            flightCrewDelayMins += time;
                        }
                    });

                    stats[timeKey].totalFlights += 1;
                    if (flightTotalDelayMins <= 15) stats[timeKey].onTime += 1;
                    stats[timeKey].totalDelayMins += flightTotalDelayMins;

                    if (hasCrewDelay) {
                        stats[timeKey].crewDelayCount += 1;
                        stats[timeKey].crewDelayMins += flightCrewDelayMins;
                    }
                }
                
                resolve({ yearLabel: detectedYear, stats });
             } catch(err) { resolve(null); }
          }
          reader.readAsArrayBuffer(file);
      });
  }

  const compareData = async () => {
    if(!file1 || !file2) return;
    if(delayCodes.length === 0) {
        alert("Lütfen Ayarlar kısmından Gecikme Kodları tanımlayın!");
        return;
    }
    setIsProcessing(true);
    
    const y1Data = await parseYearlyData(file1, "YIL 1");
    const y2Data = await parseYearlyData(file2, "YIL 2");
    
    if(y1Data && y2Data) {
        setResults({ y1: y1Data, y2: y2Data });
    } else {
        alert("Dosyalar ayrıştırılamadı. Formatları kontrol edin.");
    }
    setIsProcessing(false);
  };

  const calculateTotals = (data?: YearData) => {
      if(!data) return { tf: 0, ot: 0, tdm: 0, cdc: 0, cdm: 0 };
      let tf=0, ot=0, tdm=0, cdc=0, cdm=0;
      Object.values(data.stats).forEach(m => {
          tf+=m.totalFlights; ot+=m.onTime; tdm+=m.totalDelayMins; cdc+=m.crewDelayCount; cdm+=m.crewDelayMins;
      });
      return { tf, ot, tdm, cdc, cdm };
  }

  const t1 = calculateTotals(results?.y1);
  const t2 = calculateTotals(results?.y2);

  const timeLabelsSet = new Set<string>();
  if (results) {
      Object.keys(results.y1.stats).forEach(k => timeLabelsSet.add(k));
      Object.keys(results.y2.stats).forEach(k => timeLabelsSet.add(k));
  }
  
  const sortedKeys = Array.from(timeLabelsSet).sort((a,b) => {
      const [d1, m1] = a.split('/').map(Number);
      const [d2, m2] = b.split('/').map(Number);
      if (m1 !== m2) return m1 - m2;
      return d1 - d2;
  });

  const getS1 = (k: string) => results?.y1.stats[k] || { totalFlights: 0, onTime: 0, crewDelayCount: 0, crewDelayMins: 0 };
  const getS2 = (k: string) => results?.y2.stats[k] || { totalFlights: 0, onTime: 0, crewDelayCount: 0, crewDelayMins: 0 };

  const s1data = sortedKeys.map(k => getS1(k));
  const s2data = sortedKeys.map(k => getS2(k));

  const otpChartData = {
      labels: sortedKeys,
      datasets: [
          { label: results?.y1.yearLabel || 'Y1', data: s1data.map(s => s.totalFlights ? (s.onTime / s.totalFlights * 100) : 0), borderColor: '#94a3b8', backgroundColor: '#94a3b8', tension: 0.3 },
          { label: results?.y2.yearLabel || 'Y2', data: s2data.map(s => s.totalFlights ? (s.onTime / s.totalFlights * 100) : 0), borderColor: '#eab308', backgroundColor: '#eab308', tension: 0.3 }
      ]
  };

  const delayChartData = {
      labels: sortedKeys,
      datasets: [
          { label: results?.y1.yearLabel || 'Y1', data: s1data.map(s => s.crewDelayMins), backgroundColor: '#cbd5e1' },
          { label: results?.y2.yearLabel || 'Y2', data: s2data.map(s => s.crewDelayMins), backgroundColor: '#f59e0b' }
      ]
  };

  const ratioChartData = {
      labels: sortedKeys,
      datasets: [
          { label: results?.y1.yearLabel || 'Y1', data: s1data.map(s => s.totalFlights ? (s.crewDelayMins / s.totalFlights) : 0), borderColor: '#94a3b8', tension: 0.3 },
          { label: results?.y2.yearLabel || 'Y2', data: s2data.map(s => s.totalFlights ? (s.crewDelayMins / s.totalFlights) : 0), borderColor: '#eab308', tension: 0.3 }
      ]
  };

  const fmtMins = (mins: number): string => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-slate-50 transition-opacity duration-300 w-full h-full z-10">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex justify-between items-center shrink-0 shadow-sm z-10 w-full">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
             <ArrowLeftRight className="w-5 h-5"/>
          </div>
          Yıllık Karşılaştırma Analizi
        </h2>
        <div className="flex gap-3 items-center">
            <button 
               disabled={!file1 || !file2 || isProcessing}
               onClick={compareData}
               className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
               <Play className={`w-4 h-4 ${isProcessing ? 'animate-pulse' : ''}`} /> KARŞILAŞTIR
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <button disabled={!results} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2">
               <FileSpreadsheet className="w-4 h-4" /> EXCEL
            </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-auto p-4 flex flex-col gap-4 w-full h-full relative">
         {isProcessing && (
           <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center">
                 <Play className="w-12 h-12 text-blue-600 animate-pulse mb-4" />
                 <span className="font-bold text-slate-800 tracking-wider">DEVASA KARŞILAŞTIRMA YAPILIYOR...</span>
              </div>
           </div>
         )}
         <div className="grid grid-cols-2 gap-4 shrink-0 z-10 w-full">
            <div className={`bg-white p-4 rounded-xl shadow-sm border transition-all duration-300 w-full ${file1 ? 'border-green-500 shadow-green-100 ring-2 ring-emerald-50' : 'border-slate-200'}`}>
               <div className="flex justify-between mb-2 items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${file1 ? 'text-green-700' : 'text-slate-500'}`}>1. YIL (1. DOSYA)</span> 
                  {file1 && <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-green-200"><Check className="w-3 h-3"/> {file1.name}</span>}
               </div>
               <label className={`upload-box flex flex-col items-center justify-center h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 group w-full ${file1 ? 'border-green-400 bg-green-50 hover:bg-green-100' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                  <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => handleFileChange(e, 1)} />
                  <span className={`text-xs font-medium transition flex items-center gap-2 ${file1 ? 'text-green-600' : 'text-slate-500 group-hover:text-blue-600'}`}>
                      {file1 ? <Check className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                      {file1 ? 'Yüklendi - Değiştir' : '1. Yıl Excel Dosyasını Seçin'}
                  </span>
               </label>
            </div>

            <div className={`bg-white p-4 rounded-xl shadow-sm border transition-all duration-300 w-full ${file2 ? 'border-green-500 shadow-green-100 ring-2 ring-emerald-50' : 'border-slate-200'}`}>
               <div className="flex justify-between mb-2 items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${file2 ? 'text-green-700' : 'text-yellow-600'}`}>2. YIL (2. DOSYA)</span> 
                  {file2 && <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-green-200"><Check className="w-3 h-3"/> {file2.name}</span>}
               </div>
               <label className={`upload-box flex flex-col items-center justify-center h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 group w-full ${file2 ? 'border-green-400 bg-green-50 hover:bg-green-100' : 'border-yellow-200 bg-yellow-50/30 hover:bg-yellow-50'}`}>
                  <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => handleFileChange(e, 2)} />
                  <span className={`text-xs font-medium transition flex items-center gap-2 ${file2 ? 'text-green-600' : 'text-yellow-600 group-hover:text-yellow-700'}`}>
                       {file2 ? <Check className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                       {file2 ? 'Yüklendi - Değiştir' : '2. Yıl Excel Dosyasını Seçin'}
                  </span>
               </label>
            </div>
         </div>

         {results && (
             <div id="comparison-results" className="flex flex-col gap-4 z-10 w-full animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 bg-slate-50 pt-1">
                <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm w-full">
                   <div className="bg-slate-100/50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">GÜNLÜK KARŞILAŞTIRMA MATRİSİ</span>
                      <span className="text-[9px] text-slate-500 font-medium bg-slate-200 px-2 py-0.5 rounded-full">{sortedKeys.length} Eşleşen Gün Bulundu</span>
                   </div>
                   <div className="overflow-auto w-full max-h-[400px] custom-scroll relative">
                      <table className="excel-table w-full text-center table-fixed text-[10px]">
                         <thead className="sticky top-0 z-20 shadow-sm">
                            <tr>
                               <th rowSpan={2} className="w-16 bg-slate-200 text-slate-700 text-center align-middle border-b border-r border-slate-300 font-black">GÜN</th>
                               <th colSpan={2} className="w-24 bg-slate-200 text-slate-700 text-center border-b border-r border-slate-300 font-bold">UÇUŞ (Adet)</th>
                               <th colSpan={2} className="w-24 bg-slate-200 text-slate-700 text-center border-b border-r border-slate-300 font-bold">ON-TIME %</th>
                               <th colSpan={2} className="w-24 bg-slate-200 text-slate-700 text-center border-b border-r border-slate-300 font-bold">EKİP GEC (Adt)</th>
                               <th colSpan={2} className="w-24 bg-slate-200 text-slate-700 text-center border-b border-r border-slate-300 font-bold">EKİP GEC (Dk)</th>
                               <th colSpan={2} className="w-24 bg-slate-200 text-slate-700 text-center border-b border-slate-300 font-bold">ETKİ (Ratio)</th>
                            </tr>
                            <tr>
                               <th className="bg-slate-100 text-slate-600 font-bold text-center border-b">{results.y1.yearLabel}</th>
                               <th className="bg-yellow-100 text-yellow-800 font-bold text-center border-b border-r border-slate-300">{results.y2.yearLabel}</th>
                               
                               <th className="bg-slate-100 text-slate-600 font-bold text-center border-b">{results.y1.yearLabel}</th>
                               <th className="bg-yellow-100 text-yellow-800 font-bold text-center border-b border-r border-slate-300">{results.y2.yearLabel}</th>
                               
                               <th className="bg-slate-100 text-slate-600 font-bold text-center border-b">{results.y1.yearLabel}</th>
                               <th className="bg-yellow-100 text-yellow-800 font-bold text-center border-b border-r border-slate-300">{results.y2.yearLabel}</th>
                               
                               <th className="bg-slate-100 text-slate-600 font-bold text-center border-b">{results.y1.yearLabel}</th>
                               <th className="bg-yellow-100 text-yellow-800 font-bold text-center border-b border-r border-slate-300">{results.y2.yearLabel}</th>

                               <th className="bg-slate-100 text-slate-600 font-bold text-center border-b">{results.y1.yearLabel}</th>
                               <th className="bg-yellow-100 text-yellow-800 font-bold text-center border-b">{results.y2.yearLabel}</th>
                            </tr>
                         </thead>
                         <tbody>
                            {sortedKeys.map((k, i) => {
                                const y1s = getS1(k);
                                const y2s = getS2(k);
                                const y1Otp = y1s.totalFlights ? (y1s.onTime / y1s.totalFlights * 100).toFixed(1) : "-";
                                const y2Otp = y2s.totalFlights ? (y2s.onTime / y2s.totalFlights * 100).toFixed(1) : "-";
                                const y1Etki = y1s.totalFlights ? (y1s.crewDelayMins / y1s.totalFlights).toFixed(3) : "-";
                                const y2Etki = y2s.totalFlights ? (y2s.crewDelayMins / y2s.totalFlights).toFixed(3) : "-";

                                return (
                                <tr key={k} className="hover:bg-slate-50 border-b border-slate-200">
                                   <td className="font-bold text-indigo-700 focus:text-indigo-900 border-r border-slate-300 bg-slate-50/50">{k}</td>
                                   
                                   <td className="text-slate-600">{y1s.totalFlights || '-'}</td>
                                   <td className="font-bold text-slate-800 bg-yellow-50/40 border-r border-slate-300">{y2s.totalFlights || '-'}</td>
                                   
                                   <td className="text-slate-600">{y1Otp}%</td>
                                   <td className="font-bold text-blue-700 bg-yellow-50/40 border-r border-slate-300">{y2Otp}%</td>
                                   
                                   <td className="text-slate-500">{y1s.crewDelayCount || '-'}</td>
                                   <td className="font-bold text-slate-800 bg-yellow-50/40 border-r border-slate-300">{y2s.crewDelayCount || '-'}</td>
                                   
                                   <td className="text-rose-600 font-bold font-mono">{fmtMins(y1s.crewDelayMins)}</td>
                                   <td className="font-black text-rose-700 bg-yellow-50/40 border-r border-slate-300 font-mono">{fmtMins(y2s.crewDelayMins)}</td>
                                   
                                   <td className="text-slate-500 font-mono">{y1Etki}</td>
                                   <td className="font-bold font-mono text-slate-800 bg-yellow-50/40">{y2Etki}</td>
                                </tr>
                            )})}
                         </tbody>
                         <tfoot className="bg-slate-200 font-bold text-slate-800 border-t-[3px] border-slate-400">
                            <tr>
                                <td className="p-2 border-r border-slate-300 text-xs">YIL</td>
                                <td className="p-2">{t1.tf}</td><td className="p-2 bg-yellow-200 border-r border-slate-400">{t2.tf}</td>
                                <td className="p-2">{(t1.ot/t1.tf*100 || 0).toFixed(1)}%</td><td className="p-2 bg-yellow-200 border-r border-slate-400">{(t2.ot/t2.tf*100 || 0).toFixed(1)}%</td>
                                <td className="p-2">{t1.cdc}</td><td className="p-2 bg-yellow-200 border-r border-slate-400">{t2.cdc}</td>
                                <td className="p-2 text-rose-700 font-mono">{fmtMins(t1.cdm)}</td><td className="p-2 bg-yellow-200 text-rose-700 border-r border-slate-400 font-mono">{fmtMins(t2.cdm)}</td>
                                <td className="p-2 font-mono">{(t1.cdm/t1.tf || 0).toFixed(3)}</td><td className="p-2 bg-yellow-200 font-mono">{(t2.cdm/t2.tf || 0).toFixed(3)}</td>
                            </tr>
                         </tfoot>
                      </table>
                   </div>
                </div>

                {/* REAL LIVE CHARTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[240px] w-full mt-2">
                   <div className="col-span-1 bg-white border border-slate-300 rounded-xl p-3 flex flex-col shadow-sm">
                     <h4 className="text-[10px] font-bold text-center mb-1 text-slate-600 uppercase tracking-widest border-b border-slate-100 pb-1">OTP % Trendi</h4>
                     <div className="flex-1 w-full relative"><Line data={otpChartData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:8,font:{size:9}}}}}} /></div>
                   </div>
                   <div className="col-span-1 bg-white border border-slate-300 rounded-xl p-3 flex flex-col shadow-sm">
                     <h4 className="text-[10px] font-bold text-center mb-1 text-slate-600 uppercase tracking-widest border-b border-slate-100 pb-1">Ekip Gecikmesi (Dk) Karşılaştırma</h4>
                     <div className="flex-1 w-full relative"><Bar data={delayChartData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:8,font:{size:9}}}}}} /></div>
                   </div>
                   <div className="col-span-1 bg-white border border-slate-300 rounded-xl p-3 flex flex-col shadow-sm">
                     <h4 className="text-[10px] font-bold text-center mb-1 text-slate-600 uppercase tracking-widest border-b border-slate-100 pb-1">Gecikme Etki Oranı Trendi</h4>
                     <div className="flex-1 w-full relative"><Line data={ratioChartData} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:8,font:{size:9}}}}}} /></div>
                   </div>
                </div>
             </div>
         )}
      </main>
    </div>
  );
}
