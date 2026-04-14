'use client';
import { useState, useMemo } from 'react';
import { RefreshCw, FolderOpen, Wand2, FileSpreadsheet, X, CodeSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HEADER_ALIASES, findColumnIndex, parseFlightDate, cleanStr, extractDelayColumns } from '@/lib/excelParser';
import { exportToExcelWithLogo } from '@/lib/excelExport';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { useSettings } from '@/lib/useSettings';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const distinctColors = ['#FBBF24', '#60A5FA', '#34D399', '#A78BFA', '#F472B6', '#22D3EE', '#F87171', '#818CF8', '#4ADE80', '#FB923C'];

export default function AnalysisTab() {
  const { chiefs, delayCodes, isLoaded } = useSettings();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("Dosya Seç");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFileName(selected.name);
    }
  };

  const processData = () => {
    if (!file) return;
    setIsProcessing(true);

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
                if (findColumnIndex(row, HEADER_ALIASES.depPort) !== -1) currentScore += 2;
                
                row.forEach((c: any) => {
                    const str = cleanStr(c);
                    if(str.includes('DELAY') || str.includes('GECIKME') || str.includes('GECİKME')) currentScore += 1;
                });

                if (currentScore > maxMatchCount) {
                    maxMatchCount = currentScore;
                    headerRowIndex = i;
                }
            }

            if (maxMatchCount < 10) {
                 for (let i = 0; i < Math.min(100, rawData.length); i++) {
                    if (findColumnIndex(rawData[i], HEADER_ALIASES.flight) !== -1) {
                        headerRowIndex = i; break;
                    }
                }
            }

            if (headerRowIndex === -1) {
                alert("Başlık satırı bulunamadı! Excel formatını kontrol edin.");
                setIsProcessing(false);
                return;
            }

            const headerRow = rawData[headerRowIndex];
            const idxFlight = findColumnIndex(headerRow, HEADER_ALIASES.flight);
            const idxDepPort = findColumnIndex(headerRow, HEADER_ALIASES.depPort);
            const idxArrPort = findColumnIndex(headerRow, HEADER_ALIASES.arrPort);
            const idxStd = findColumnIndex(headerRow, HEADER_ALIASES.std);
            const idxAtd = findColumnIndex(headerRow, HEADER_ALIASES.atd);
            const idxRemark = findColumnIndex(headerRow, HEADER_ALIASES.remark);
            const idxDateLong = findColumnIndex(headerRow, HEADER_ALIASES.dateLong);
            const delayCols = extractDelayColumns(headerRow);

            const parsedResults: any[] = [];
            let lastValidDate: Date | null = null;

            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0 || idxFlight === -1 || !row[idxFlight]) continue;

                let dateObj: Date | null = null;
                if (idxDateLong !== -1) dateObj = parseFlightDate(row[idxDateLong], false);
                if (!dateObj && idxStd !== -1) dateObj = parseFlightDate(row[idxStd], false); 
                
                if (!dateObj && lastValidDate) {
                    dateObj = new Date(lastValidDate.getTime());
                } else if (dateObj) {
                    lastValidDate = dateObj;
                } else {
                    continue;
                }

                const dateIso = dateObj.toISOString().split('T')[0];
                const d = String(dateObj.getUTCDate()).padStart(2, '0');
                const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
                const dateStr = `${d}/${m}/${dateObj.getUTCFullYear()}`;

                let timeVal = 0;
                if (idxStd !== -1) {
                    const s = String(row[idxStd] || "").replace(/[^0-9]/g, '').padStart(4, '0');
                    timeVal = parseInt(s) || 0;
                }

                let shift = "NIGHT"; 
                if (timeVal >= 701 && timeVal <= 1500) shift = "EARLY";
                else if (timeVal >= 1501 && timeVal <= 2300) shift = "LATE";

                delayCols.forEach((g: any) => {
                    const code = cleanStr(row[g.codeIdx]);
                    const time = parseInt(row[g.timeIdx] || "0");
                    const matchedCode = delayCodes.find(c => c.code === code);
                    
                    if (matchedCode && time >= 15) {
                        parsedResults.push({
                            id: i + "_" + code + "_" + Math.random().toString(36).substr(2, 5), 
                            date: dateStr, dateIso, shift, 
                            flight: row[idxFlight], 
                            depPort: idxDepPort !== -1 ? row[idxDepPort] : "", 
                            arrPort: idxArrPort !== -1 ? row[idxArrPort] : "",
                            std: idxStd !== -1 ? row[idxStd] : "", 
                            atd: idxAtd !== -1 ? row[idxAtd] : "", 
                            delayCode: code, delayTimeVal: time,
                            remark: idxRemark !== -1 ? row[idxRemark] : "",
                            desc: matchedCode.desc,
                            chief: "" 
                        });
                    }
                });
            }

            // Tarihe göre (eskiden yeniye) ve her tarih içinde NIGHT → EARLY → LATE sırala
            const shiftOrder: Record<string, number> = { NIGHT: 0, EARLY: 1, LATE: 2 };
            parsedResults.sort((a: any, b: any) => {
              // Önce tarihe göre sırala
              const dateCompare = (a.dateIso || '').localeCompare(b.dateIso || '');
              if (dateCompare !== 0) return dateCompare;
              // Aynı tarihte vardiyaya göre sırala
              const shiftA = shiftOrder[a.shift] ?? 3;
              const shiftB = shiftOrder[b.shift] ?? 3;
              if (shiftA !== shiftB) return shiftA - shiftB;
              // Aynı vardiyada STD'ye göre sırala
              const stdA = parseInt(String(a.std || '0').replace(/[^0-9]/g, '')) || 0;
              const stdB = parseInt(String(b.std || '0').replace(/[^0-9]/g, '')) || 0;
              return stdA - stdB;
            });

            setProcessedData(parsedResults);
            setIsProcessing(false);
            if (parsedResults.length === 0) alert("Ekip Kaynaklı gecikme bulunamadı veya format uyumsuz.");

        } catch (err) {
            console.error(err);
            alert("İşleme hatası");
            setIsProcessing(false);
        }
    };
    reader.readAsArrayBuffer(file);
  }

  const updateChief = (idxToUpdate: number, newVal: string) => {
      setProcessedData(prev => prev.map((item, i) => i === idxToUpdate ? { ...item, chief: newVal } : item));
  };

  // --- CHART METRICS ---
  const hasData = processedData.length > 0;
  
  const { totalMins, shiftTotals, chiefTotals, chiefList } = useMemo(() => {
    let tMins = 0;
    const sTotals = { EARLY: 0, LATE: 0, NIGHT: 0 };
    const cTotals: Record<string, number> = {};

    processedData.forEach(d => {
        tMins += d.delayTimeVal;
        if (sTotals[d.shift as keyof typeof sTotals] !== undefined) sTotals[d.shift as keyof typeof sTotals] += d.delayTimeVal;
        
        const chiefStr = d.chief && String(d.chief).trim() !== "" ? d.chief : "UNASSIGNED";
        if (chiefStr !== "UNASSIGNED") {
           if (!cTotals[chiefStr]) cTotals[chiefStr] = 0;
           cTotals[chiefStr] += d.delayTimeVal;
        }
    });

    const cList = Object.entries(cTotals).sort(([,a], [,b]) => b - a);
    return { totalMins: tMins, shiftTotals: sTotals, chiefTotals: cTotals, chiefList: cList };
  }, [processedData]);

  // Chart Properties

  const shiftBarChartData = {
      labels: ['EARLY', 'LATE', 'NIGHT'],
      datasets: [{
          label: 'Dakika',
          data: [shiftTotals.EARLY, shiftTotals.LATE, shiftTotals.NIGHT],
          backgroundColor: ['#f59e0b', '#06b6d4', '#4f46e5'],
          borderRadius: 4,
      }]
  };

  const barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Inter', weight: 'bold' as const } } },
          y: { display: false, beginAtZero: true } // Hide Y axis for cleaner look
      },
      layout: { padding: 4 }
  };

  const chiefChartData = {
    labels: chiefList.map(c => c[0]),
    datasets: [{
        data: chiefList.map(c => c[1]),
        backgroundColor: distinctColors,
        borderWidth: 2, 
        borderColor: '#ffffff', 
        hoverOffset: 4
    }]
  };

  const pieChartOptions = { 
      responsive: true, 
      maintainAspectRatio: false, 
      plugins: { 
          legend: { position: 'right' as const, labels: { boxWidth: 8, font: { size: 9, family: 'Inter', weight: 'bold' as const } } } 
      },
      layout: { padding: 4 }
  };

  return (
    <div className="absolute inset-0 flex flex-col transition-opacity duration-300 z-10 w-full h-full">
      <header className="bg-white border-b border-slate-200 px-8 py-3 flex justify-between items-center shrink-0 shadow-sm z-20 w-full relative">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <PieChartIcon />
            </div>
            Ekip Gecikme Analizi
        </h2>
        <div className="flex items-center gap-3">
            <div className="relative flex items-center gap-2">
                <input type="file" id="fileInputAnalysis" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleFileUpload} />
                <label htmlFor="fileInputAnalysis" className="bg-white border text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm flex items-center gap-2">
                    <FolderOpen className="text-slate-500 w-4 h-4" /> <span>{fileName}</span>
                </label>
            </div>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <button 
                disabled={fileName === "Dosya Seç" || isProcessing}
                onClick={processData}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} /> PROCESS
            </button>
            <button 
                disabled={!hasData}
                onClick={() => setAiModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
                <Wand2 className="w-4 h-4" /> AI ASSISTANT
            </button>
            <button 
                onClick={() => exportToExcelWithLogo(processedData)}
                disabled={!hasData}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
                <FileSpreadsheet className="w-4 h-4" /> EXPORT EXCEL
            </button>
        </div>
      </header>

      <main id="analysis-results" className="flex-1 flex flex-col overflow-hidden p-4 gap-4 relative bg-slate-50">
        {isProcessing && (
           <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
              <div className="flex flex-col items-center">
                 <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                 <span className="font-bold text-slate-800 tracking-wider">PARSING EXCEL ENGINE...</span>
              </div>
           </div>
        )}

        <div className="grid grid-cols-12 gap-3 min-h-[200px] shrink-0 w-full z-10 transition-all duration-500">
            {/* METRICS */}
            <div className="col-span-2 flex flex-col gap-3">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest">TOTAL FLIGHTS</span>
                    <span className="text-3xl font-black text-slate-800 mt-1">{new Set(processedData.map(d => d.flight)).size}</span>
                    <span className="text-[9px] text-blue-600 mt-1 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{'Gecikmeli (>15dk)'}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest">TOTAL DELAY</span>
                    <span className="text-3xl font-black text-red-600 mt-1">{totalMins}</span>
                    <span className="text-[9px] text-red-600 mt-1 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Dakika</span>
                </div>
            </div>
            
            {/* SHIFT CHART (BAR CHART NOW) */}
            <div className="col-span-3 bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex flex-col overflow-hidden">
              <h3 className="text-[11px] font-bold text-slate-500 tracking-widest border-b border-slate-100 pb-1 mb-1">SHIFT DISTRIBUTION</h3>
              <div className="flex-1 w-full relative mt-2">
                 {hasData ? <Bar data={shiftBarChartData} options={barChartOptions} /> : <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">No Data</div>}
              </div>
            </div>
            
            {/* CHIEF LIST (LEADERBOARD) */}
            <div className="col-span-3 bg-white border border-slate-200 shadow-sm rounded-xl border-l-[4px] border-l-slate-800 p-2 flex flex-col overflow-hidden">
              <h3 className="text-[10px] font-bold text-slate-500 tracking-widest border-b border-slate-100 pb-1 mb-0.5">CHIEF LEADERBOARD <span className="text-slate-400 font-medium">(dk)</span></h3>
              <div className="flex-1 overflow-hidden mt-0.5 flex flex-col gap-px">
                 {!hasData && <div className="text-[9px] text-slate-400 text-center italic mt-2">Waiting for data...</div>}
                 {hasData && chiefList.length === 0 && <div className="text-[9px] text-slate-400 text-center italic mt-2">Please assign chiefs below.</div>}
                 {hasData && chiefList.map((chief, i) => (
                    <div key={chief[0]} className="flex justify-between items-center bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                       <span className="font-bold text-[9px] flex items-center gap-1"><div className="w-1 h-1 rounded-full" style={{backgroundColor: distinctColors[i % distinctColors.length]}}></div>{chief[0]}</span>
                       <span className="bg-slate-200 text-slate-700 font-bold px-1 py-px rounded text-[9px]">{chief[1]} dk</span>
                    </div>
                 ))}
              </div>
              <div className="shrink-0 pt-1 mt-0.5 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-600 text-[10px]">GRAND TOTAL</span>
                  <span className="font-black text-slate-800 text-[10px] bg-slate-100 px-1.5 py-px rounded border border-slate-200">{totalMins} dk</span>
              </div>
            </div>
            
            {/* CHIEF CHART */}
            <div className="col-span-4 bg-white border border-slate-200 shadow-sm rounded-xl p-3 flex flex-col overflow-hidden">
              <h3 className="text-[11px] font-bold text-slate-500 tracking-widest border-b border-slate-100 pb-1 mb-1">CHIEF RATIO</h3>
               <div className="flex-1 w-full relative mt-1">
                 {hasData ? (chiefList.length > 0 ? <Pie data={chiefChartData} options={pieChartOptions} /> : <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-[10px] text-center"><p>Assign chiefs to view chart.</p></div>) : <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">No Data</div>}
              </div>
            </div>
        </div>

        {/* LIST TABLE AREA */}
        <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-sm flex flex-col border-[2px] border-slate-300 z-10 w-full relative">
            <div className="bg-slate-100/50 border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2"><CodeSquare className="w-3.5 h-3.5 text-slate-500"/> Operation Details <span className="bg-white px-2 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200">{processedData.length} Records</span></span>
                <span className="text-[9px] text-slate-500 font-medium bg-slate-200 px-2 py-0.5 rounded-full">Intelligent Auto-Sort Active</span>
            </div>
            <div className="flex-1 overflow-auto custom-scroll w-full relative">
               {/* table-auto enables content-based widths, preventing forced large gaps */}
               <table className="excel-table w-full text-left table-auto">
                  <thead className="sticky top-0 shadow-sm z-20">
                      <tr>
                          <th className="w-8 text-center bg-slate-200 text-slate-800 border-b border-slate-300">#</th>
                          <th className="w-[70px] bg-slate-200 text-slate-800 border-b border-slate-300">DATE (Z)</th>
                          <th className="w-14 bg-slate-200 text-slate-800 border-b border-slate-300 text-center">SHIFT</th>
                          <th className="w-32 bg-blue-100 text-blue-900 border-b border-blue-200 border-l border-r text-center">ASSIGNED CHIEF</th>
                          <th className="w-[60px] bg-slate-200 text-slate-800 border-b border-slate-300">FLIGHT</th>
                          <th className="w-14 bg-slate-200 text-slate-800 border-b border-slate-300 text-center">FROM</th>
                          <th className="w-14 bg-slate-200 text-slate-800 border-b border-slate-300 text-center">TO</th>
                          <th className="w-[50px] bg-slate-200 text-slate-800 border-b border-slate-300 text-center">STD</th>
                          <th className="w-16 bg-slate-200 text-slate-800 border-b border-slate-300 text-center">CODE</th>
                          <th className="w-[60px] bg-slate-200 text-slate-800 border-b border-slate-300 text-right pr-2">DAKİKA</th>
                          <th className="bg-slate-200 text-slate-800 border-b border-slate-300">DESCRIPTION</th>
                      </tr>
                  </thead>
                  <tbody>
                      {hasData ? (
                           processedData.map((row, i) => (
                             <tr key={row.id} className="hover:bg-slate-50">
                               <td className="text-center text-slate-400 font-medium text-[10px]">{i+1}</td>
                               <td className="font-mono text-slate-600 text-[10px]">{row.date}</td>
                               <td className="text-center">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${row.shift === 'EARLY' ? 'bg-amber-100 text-amber-800' : (row.shift === 'LATE' ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800')}`}>{row.shift}</span>
                               </td>
                               <td className="p-0 border-l border-r border-slate-100 bg-blue-50/20 align-middle">
                                   <select 
                                       value={row.chief}
                                       onChange={(e) => updateChief(i, e.target.value)}
                                       className="w-full bg-transparent outline-none text-[10px] font-bold text-slate-700 cursor-pointer px-1 py-1 h-full hover:bg-white transition text-center"
                                   >
                                       <option value="" className="text-slate-400 italic">-- Assign --</option>
                                       {chiefs.map(c => <option key={c} value={c}>{c}</option>)}
                                   </select>
                               </td>
                               <td className="font-bold text-slate-800 text-[11px]">{row.flight}</td>
                               <td className="text-slate-600 text-[10px] text-center font-bold tracking-widest">{row.depPort}</td>
                               <td className="text-slate-600 text-[10px] text-center font-bold tracking-widest">{row.arrPort}</td>
                               <td className="font-mono text-indigo-800 font-bold text-[10px] text-center">{row.std}</td>
                               <td className="text-center">
                                  <span className="bg-red-50 text-red-700 px-1.5 py-0.5 border border-red-200 rounded font-bold text-[10px]">{row.delayCode}</span>
                               </td>
                               <td className="text-right font-black text-rose-600 pr-2 text-[11px]">{row.delayTimeVal}</td>
                               <td className="text-[10px] text-slate-600 font-medium truncate max-w-[280px]" title={row.desc}>{row.desc}</td>
                             </tr>  
                           ))
                      ) : (
                          <tr><td colSpan={11} className="py-24 text-center text-slate-400 italic text-sm">Waiting for dataset. Upload Excel and click Process.</td></tr>
                      )}
                  </tbody>
               </table>
            </div>
        </div>
      </main>

      {/* AI ASSISTANT MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex justify-center items-center animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[600px] flex flex-col relative animate-in zoom-in-95 duration-300 border border-slate-200 overflow-hidden">
               <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-6 flex justify-between items-start text-white shrink-0">
                  <div>
                    <h3 className="text-2xl font-black flex items-center gap-3 tracking-tight"><Wand2 className="w-8 h-8 text-yellow-300" /> Operational Genius (AI)</h3>
                    <p className="text-indigo-100 mt-1 text-sm font-medium">I have fully analyzed your flight delays. Need a summary? Just ask.</p>
                  </div>
                  <button onClick={() => setAiModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition backdrop-blur-sm">
                     <X className="w-5 h-5 text-white" />
                  </button>
               </div>
               <div className="flex-1 bg-slate-50 p-6 flex items-center justify-center flex-col gap-4">
                   <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center relative shadow-inner">
                       <Wand2 className="w-10 h-10 text-indigo-600 animate-bounce" />
                       <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
                        </span>
                   </div>
                   <h4 className="text-xl font-bold text-slate-700">Analytics AI Engine Coming Soon</h4>
                   <p className="text-slate-500 text-center max-w-lg text-sm">
                      We're upgrading the legacy API link to a more secure Serverless architecture right inside Next.js. Your huge dataset ({processedData.length} Records) is staged and waiting for the AI backend.
                   </p>
               </div>
               <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                  <button onClick={() => setAiModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition">Cancel</button>
                  <button className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition opacity-80 cursor-not-allowed">Deploy Engine</button>
               </div>
           </div>
        </div>
      )}
    </div>
  );
}

const PieChartIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
);
