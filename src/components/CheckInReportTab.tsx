'use client';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { PlaneTakeoff, RotateCcw, UploadCloud, AlertTriangle, Users, FileSpreadsheet, CheckCircle2, Ticket, Briefcase, Trash2, PieChart } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CheckInReportTab() {
    const [tabState, setTabState] = useState<'summary'|'detail-active'|'detail-pass'>('summary');
    const [detailsActive, setDetailsActive] = useState<any[]>([]);
    const [detailsPass, setDetailsPass] = useState<any[]>([]);
    const [summaryData, setSummaryData] = useState<any[]>([]);
    const [grandTotal, setGrandTotal] = useState({ active: 0, pass: 0, total: 0 });
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasData = detailsActive.length > 0 || detailsPass.length > 0;

    const parseDateSafe = (input: any) => {
        if (!input || input === '-') return null;
        if (input instanceof Date && !isNaN(input.getTime())) return input;

        const str = input.toString().trim();
        const parts = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(.*)$/);
        
        if (parts) {
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1;
            const year = parseInt(parts[3], 10);
            
            let hours = 0, minutes = 0;
            const timePart = parts[4].trim();
            const timeMatch = timePart.match(/(\d{1,2}):(\d{1,2})/);
            if (timeMatch) {
                hours = parseInt(timeMatch[1], 10);
                minutes = parseInt(timeMatch[2], 10);
            }
            return new Date(year, month, day, hours, minutes);
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    const formatDateTimeTR = (dateInput: any) => {
        const date = parseDateSafe(dateInput);
        if (!date) return "-";
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const h = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${d}/${m}/${y} ${h}:${min}`;
    };

    const convertToObjectsWithSmartHeader = (data: any[]) => {
        if (!data || data.length === 0) throw new Error("Dosya boş.");
        let headerIdx = -1;
        for (let i = 0; i < Math.min(data.length, 30); i++) {
            const str = JSON.stringify(data[i]).toLowerCase();
            if ((str.includes('flight') && str.includes('number')) || str.includes('company id')) {
                headerIdx = i; break;
            }
        }
        if (headerIdx === -1) headerIdx = 0;

        const headers = data[headerIdx].map((h: any) => h ? h.toString().trim() : "");
        const result = [];
        
        for (let i = headerIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            const obj: any = {};
            headers.forEach((h: string, idx: number) => {
                if (h) obj[h] = row[idx];
            });
            result.push(obj);
        }
        return result;
    };

    const processFile = (file: File) => {
        setErrorMsg("");
        setIsProcessing(true);
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.xlsm')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
                    const processedData = convertToObjectsWithSmartHeader(jsonData);
                    analyzeData(processedData);
                } catch (err: any) { 
                    setErrorMsg("Dosya Okuma Hatası: " + err.message); 
                    setIsProcessing(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            setErrorMsg("Lütfen geçerli bir CSV veya Excel dosyası yükleyin.");
            setIsProcessing(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const analyzeData = (data: any[]) => {
        let tempActive: any[] = [];
        let tempPass: any[] = [];
        const processedDuties = new Set();

        data.forEach(row => {
            let logDate = row['Check-In Log Date'];
            if (logDate === undefined) logDate = row['Check-In Date'];
            
            const isMissing = !logDate || logDate.toString().trim() === '' || logDate.toString().toLowerCase() === 'nan';

            if (isMissing) {
                let rawFlightNo = row['Flight Number'] ? row['Flight Number'].toString().toUpperCase() : '';
                let occupation = row['Occupation'] ? row['Occupation'].toString().toUpperCase() : '';
                
                const fullName = (row['Crew Name'] || '') + ' ' + (row['Crew Surname'] || '');
                const id = row['Company ID'] || fullName;
                const dutyStartDate = row['Duty Start Date'];
                const base = row['Base'] ? row['Base'].toString().trim().toUpperCase() : '';
                const flightRoute = row['Flight Route'] ? row['Flight Route'].toString().trim().toUpperCase() : '';

                if (!fullName.trim() && !rawFlightNo) return;

                let firstSector = rawFlightNo.split(/[-/]/)[0].trim();

                if (occupation && rawFlightNo === occupation) return;
                if (rawFlightNo.includes('//')) return;
                if (/^[A-Z]{3}\d/.test(rawFlightNo)) return;

                const departureAirport = flightRoute.split(/[-/]/)[0].trim();
                const checkinCapableAirports = ['SAW', 'AYT', 'ADB', 'ECN', 'COV', 'ESB'];
                
                if (base && departureAirport) {
                    if (base !== departureAirport && !checkinCapableAirports.includes(departureAirport)) {
                        return; 
                    }
                }

                const flightParts = rawFlightNo.split(/[-/ ]+/).filter((p:string) => p.trim().length > 0);
                const banList = [
                    'SIM', 'LPC', 'OPC', 'GRD', 'CRS', 'YER', 'EĞİTİM', 'EGITIM', 'COURSE',
                    'SEPT', 'CRM', 'OFFICE', 'OFIS', 'SBY', 'STBY', 'STANDBY', 'NOBET', 'NÖBET',
                    'ALARM', 'RSRV', 'MEETING', 'TOPLANTI', 'DOC', 'VİZE', 'VISA', 'PASAPORT',
                    'HOTEL', 'OTEL', 'TRANS', 'DH', 'DEADHEAD', 'ADM', 'ADMIN',
                    'TR', 'LN', 'CHK', 'OBS', 'SUPER', 'LINE', 'TRAINING', 'CHECK',
                    'REFRESH', 'REF', 'EGT', 'VAC', 'OFF', 'AL', 'SICK', 'RAPOR', 'IZIN', 'İZİN',
                    'DECR', 'IPT'
                ];

                let hasBannedActivity = false;
                for (const part of flightParts) {
                    const partUpper = part.toUpperCase();
                    const partClean = partUpper.replace(/^\(P\)/, '');
                    if (partClean.startsWith('GT') || partClean.startsWith('TK') || banList.some(ban => partUpper.includes(ban))) {
                        hasBannedActivity = true;
                        break;
                    }
                }

                if (hasBannedActivity) return;

                const digitsOnly = firstSector.replace(/\D/g, '');
                if (digitsOnly.length === 0) return;

                let dateKey = "UNKNOWN_DATE";
                const pDate = parseDateSafe(dutyStartDate);
                if (pDate) {
                    dateKey = `${pDate.getFullYear()}-${pDate.getMonth()}-${pDate.getDate()}`;
                } else {
                    dateKey = firstSector;
                }
                const uniqueKey = `${id}_${dateKey}`;

                if (!processedDuties.has(uniqueKey)) {
                    processedDuties.add(uniqueKey);
                    const cleanRow = {
                        _id: Math.random().toString(36).substr(2, 9),
                        id: row['Company ID'] || '-',
                        name: fullName,
                        rank: row['Rank Type'] || '-',
                        startDate: dutyStartDate || '-',
                        endDate: row['Duty End Date'] || '-',
                        flight: rawFlightNo,
                        route: row['Flight Route'] || '-',
                        base: row['Base'] || '-',
                        type: 'DUTY'
                    };

                    if (firstSector.toUpperCase().includes('(P)')) {
                        cleanRow.type = 'PASS';
                        tempPass.push(cleanRow);
                    } else {
                        cleanRow.type = 'DUTY';
                        tempActive.push(cleanRow);
                    }
                }
            }
        });

        const dateSorter = (a: any, b: any) => {
            const dateA = parseDateSafe(a.startDate);
            const dateB = parseDateSafe(b.startDate);
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateA.getTime() - dateB.getTime();
        };

        tempActive.sort(dateSorter);
        tempPass.sort(dateSorter);

        setDetailsActive(tempActive);
        setDetailsPass(tempPass);
        setIsProcessing(false);
    };

    useEffect(() => {
        if (!hasData) return;
        let gTotal = { active: 0, pass: 0, total: 0 };
        const pMap: any = {};

        const processRow = (row: any) => {
            if (!pMap[row.id]) {
                pMap[row.id] = { id: row.id, name: row.name, rank: row.rank, base: row.base, active: 0, pass: 0, total: 0 };
            }
            pMap[row.id].total++;
            if (row.type === 'PASS') pMap[row.id].pass++;
            else pMap[row.id].active++;
        };

        detailsActive.forEach(processRow);
        detailsPass.forEach(processRow);

        const sData = Object.values(pMap).sort((a: any, b: any) => b.total - a.total);
        sData.forEach((item: any) => {
            gTotal.active += item.active;
            gTotal.pass += item.pass;
            gTotal.total += item.total;
        });

        setSummaryData(sData);
        setGrandTotal(gTotal);
    }, [detailsActive, detailsPass, hasData]);

    const deleteRow = (id: string, type: 'DUTY'|'PASS') => {
        if (!window.confirm("Bu kaydı listeden silmek istediğinize emin misiniz?")) return;
        if (type === 'DUTY') setDetailsActive(prev => prev.filter(item => item._id !== id));
        else setDetailsPass(prev => prev.filter(item => item._id !== id));
    };

    const downloadExcel = () => {
        import('exceljs').then((ExcelJS: any) => {
             const workbook = new ExcelJS.default.Workbook();

             const turqoiseFill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFE0F7FA'} } as any;
             const whiteFill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFFFFFFF'} } as any;
             const headerFill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF0C4A6E'} } as any;
             const totalFill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF374151'} } as any;

             const addSheet = (data: any[], name: string, isSummary: boolean) => {
                 if(data.length === 0) return;
                 const sheet = workbook.addWorksheet(name);
                 
                 let columns = [];
                 if (isSummary) {
                     columns = [
                         { header: 'BASE', key: 'base', width: 10 },
                         { header: 'CREW ID', key: 'id', width: 15 },
                         { header: 'RANK', key: 'rank', width: 10 },
                         { header: 'CREW NAME', key: 'name', width: 30 },
                         { header: 'DUTY FLIGHT', key: 'active', width: 15 },
                         { header: 'PASS FLIGHT', key: 'pass', width: 15 },
                         { header: 'TOTAL', key: 'total', width: 10 },
                     ];
                 } else {
                     columns = [
                         { header: 'BASE', key: 'base', width: 10 },
                         { header: 'CREW ID', key: 'id', width: 15 },
                         { header: 'RANK', key: 'rank', width: 10 },
                         { header: 'CREW NAME', key: 'name', width: 30 },
                         { header: 'DUTY START', key: 'startDate', width: 20 },
                         { header: 'DUTY END', key: 'endDate', width: 20 },
                         { header: 'FLIGHT NO', key: 'flight', width: 20 },
                         { header: 'SECTOR', key: 'route', width: 15 },
                     ];
                 }
                 sheet.columns = columns;

                 // Header Style
                 sheet.getRow(1).eachCell((cell: any) => {
                     cell.fill = headerFill;
                     cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, name: 'Calibri', size: 11 };
                     cell.alignment = { vertical: 'middle', horizontal: 'center' };
                     cell.border = { top: {style:'thick'}, bottom: {style:'thick'}, left: {style:'thick'}, right: {style:'thick'} };
                 });

                 data.forEach((row, i) => {
                     const rowData: any = {};
                     if(isSummary) {
                         rowData.base = row.base; rowData.id = row.id; rowData.rank = row.rank; rowData.name = row.name;
                         rowData.active = row.active; rowData.pass = row.pass; rowData.total = row.total;
                     } else {
                         rowData.base = row.base; rowData.id = row.id; rowData.rank = row.rank; rowData.name = row.name;
                         rowData.startDate = formatDateTimeTR(row.startDate); rowData.endDate = formatDateTimeTR(row.endDate);
                         rowData.flight = row.flight; rowData.route = row.route;
                     }

                     const addedRow = sheet.addRow(rowData);
                     addedRow.eachCell((cell: any) => {
                         cell.fill = (i % 2 !== 0) ? turqoiseFill : whiteFill;
                         cell.font = { name: 'Calibri', size: 11 };
                         cell.border = { top: {style:'dashed'}, bottom: {style:'dashed'}, left: {style:'thin'}, right: {style:'thin'} };
                     });
                 });

                 // Footer
                 if (isSummary) {
                     const footRow = sheet.addRow({ name: 'GRAND TOTAL:', active: grandTotal.active, pass: grandTotal.pass, total: grandTotal.total });
                     footRow.eachCell((cell: any, colN: number) => {
                         cell.fill = totalFill;
                         cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
                         cell.alignment = { horizontal: colN === 4 ? 'right' : 'center' };
                     });
                 }
             };

             addSheet(summaryData, "Summary", true);
             addSheet(detailsActive, "Duty", false);
             addSheet(detailsPass, "Pass", false);

             workbook.xlsx.writeBuffer().then((buffer: any) => {
                 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `Kirilimli_Liste_${Date.now()}.xlsx`;
                 a.click();
                 window.URL.revokeObjectURL(url);
             });
        });
    };

    const chartData = useMemo(() => {
        const counts: Record<string, number> = {};
        [...detailsActive, ...detailsPass].forEach(r => counts[r.base] = (counts[r.base] || 0) + 1);
        return {
            labels: Object.keys(counts),
            datasets: [{
                label: ' Hata Sayısı',
                data: Object.values(counts),
                backgroundColor: ['#0c4a6e', '#0ea5e9', '#0284c7', '#38bdf8', '#7dd3fc', '#bae6fd']
            }]
        };
    }, [detailsActive, detailsPass]);

    return (
        <div className="flex-1 flex flex-col font-sans h-full bg-slate-50 relative overflow-hidden">
             
             {/* Header */}
             <header className="bg-sky-900 text-white px-6 py-4 flex justify-between items-center z-10 shrink-0 shadow-lg print:hidden">
                <div className="flex items-center gap-3">
                     <div className="bg-white/10 p-2 rounded-lg"><PlaneTakeoff className="text-sky-400 w-6 h-6" /></div>
                     <div>
                         <h1 className="text-xl font-bold tracking-wide">Check-In Kontrol Paneli</h1>
                         <p className="text-[10px] text-sky-200 uppercase tracking-widest font-semibold">Gelişmiş Operasyonel Raporlama</p>
                     </div>
                </div>
                <button onClick={() => { setDetailsActive([]); setDetailsPass([]); setSummaryData([]); setTabState('summary'); setGrandTotal({active:0, pass:0, total:0}); }} className="text-xs bg-sky-800 hover:bg-sky-700 px-4 py-2 rounded-lg transition border border-sky-700 flex items-center gap-2 font-bold shadow-sm">
                    <RotateCcw className="w-4 h-4" /> Yeni Dosya
                </button>
             </header>

             <main className="flex-1 overflow-y-auto px-6 py-6" onDragOver={handleDrop} onDrop={handleDrop}>
                 
                 {!hasData && (
                     <div className="max-w-xl mx-auto mt-12 animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-white rounded-2xl shadow-xl p-10 text-center border-2 border-dashed border-sky-200 hover:border-sky-500 transition relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                             <div className="w-20 h-20 bg-sky-50 rounded-full flex flex-col items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:bg-sky-100 transition duration-300">
                                 {isProcessing ? <RotateCcw className="w-8 h-8 text-sky-600 animate-spin" /> : <UploadCloud className="w-10 h-10 text-sky-600" />}
                             </div>
                             <h2 className="text-2xl font-bold text-slate-800 mb-2">Rapor Dosyasını Yükleyin</h2>
                             <p className="text-slate-500 mb-6 text-sm">Analiz etmek için <span className="font-semibold text-sky-700">Excel (.xlsx)</span> veya <span className="font-semibold text-sky-700">CSV</span> dosyasını buraya sürükleyin.</p>
                             
                             <input type="file" ref={fileInputRef} accept=".csv, .xlsx, .xls, .xlsm" className="hidden" onChange={handleFileChange} />
                             <span className="bg-sky-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-sky-600/30">Dosya Seç</span>
                             
                             {errorMsg && <p className="mt-4 text-xs text-red-600 font-bold bg-red-50 p-2 rounded">{errorMsg}</p>}
                        </div>
                     </div>
                 )}

                 {hasData && (
                     <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                         {/* Stats Cards */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <div className="bg-white rounded-xl shadow-sm border-l-4 border-rose-500 p-4 relative overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOPLAM HATALI UÇUŞ</p>
                                  <h3 className="text-3xl font-black text-slate-800 mt-1">{grandTotal.total}</h3>
                                  <div className="text-rose-600 text-[11px] font-bold flex items-center gap-1 mt-1"><AlertTriangle className="w-3.5 h-3.5"/> Check-In Eksik</div>
                              </div>
                              <div className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 p-4 relative overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PERSONEL SAYISI</p>
                                  <h3 className="text-3xl font-black text-slate-800 mt-1">{summaryData.length}</h3>
                                  <div className="text-purple-600 text-[11px] font-bold flex items-center gap-1 mt-1"><Users className="w-3.5 h-3.5"/> Etkilenen Kişi</div>
                              </div>
                              <div className="bg-white rounded-xl shadow-sm border-l-4 border-amber-500 p-4 relative overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DUTY FLIGHT (AKTİF)</p>
                                  <h3 className="text-3xl font-black text-slate-800 mt-1">{grandTotal.active}</h3>
                                  <div className="text-amber-600 text-[11px] font-bold flex items-center gap-1 mt-1"><Briefcase className="w-3.5 h-3.5"/> Operasyonel Uçuş</div>
                              </div>
                              <div className="bg-white rounded-xl shadow-sm border-l-4 border-blue-500 p-4 relative overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PASS FLIGHT (YOLCU)</p>
                                  <h3 className="text-3xl font-black text-slate-800 mt-1">{grandTotal.pass}</h3>
                                  <div className="text-blue-600 text-[11px] font-bold flex items-center gap-1 mt-1"><Ticket className="w-3.5 h-3.5"/> Pasif Transfer</div>
                              </div>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                              {tabState === 'summary' && (
                                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 lg:col-span-1">
                                       <h3 className="text-xs font-bold text-slate-500 tracking-widest text-center border-b pb-2 mb-2">BASE DAĞILIMI</h3>
                                       <div className="h-48 w-full"><Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }} /></div>
                                  </div>
                              )}

                              <div className={`bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden ${tabState==='summary' ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
                                   
                                   <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-3">
                                        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm text-xs font-bold">
                                            <button onClick={()=>setTabState('summary')} className={`px-4 py-2 rounded-md transition flex items-center gap-1.5 ${tabState==='summary' ? 'bg-sky-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                <PieChart className="w-4 h-4" /> General Summary
                                            </button>
                                            <button onClick={()=>setTabState('detail-active')} className={`px-4 py-2 rounded-md transition flex items-center gap-1.5 ${tabState==='detail-active' ? 'bg-sky-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                <PlaneTakeoff className="w-4 h-4" /> Duty List
                                            </button>
                                            <button onClick={()=>setTabState('detail-pass')} className={`px-4 py-2 rounded-md transition flex items-center gap-1.5 ${tabState==='detail-pass' ? 'bg-sky-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                <Ticket className="w-4 h-4" /> Pass List
                                            </button>
                                        </div>
                                        <button onClick={downloadExcel} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-xs rounded-lg font-bold shadow flex items-center gap-2">
                                            <FileSpreadsheet className="w-4 h-4"/> EXCEL AKTAR
                                        </button>
                                   </div>

                                   <div className="overflow-x-auto min-h-[400px] max-h-[600px] overflow-y-auto custom-scroll">
                                       <table className="w-full text-left text-xs bg-white border-separate" style={{ borderSpacing: 0 }}>
                                            <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 z-10">
                                                {tabState === 'summary' ? (
                                                    <tr>
                                                        <th className="px-4 py-3 border-b border-r border-slate-200 text-center">#</th>
                                                        <th className="px-4 py-3 border-b border-r border-slate-200">BASE</th>
                                                        <th className="px-4 py-3 border-b border-r border-slate-200">CREW ID</th>
                                                        <th className="px-4 py-3 border-b border-r border-slate-200">RANK</th>
                                                        <th className="px-4 py-3 border-b border-r border-slate-200">CREW NAME</th>
                                                        <th className="px-4 py-3 border-b border-r border-amber-200 bg-amber-50 text-amber-700 text-center">DUTY</th>
                                                        <th className="px-4 py-3 border-b border-r border-blue-200 bg-blue-50 text-blue-700 text-center">PASS</th>
                                                        <th className="px-4 py-3 border-b border-rose-200 bg-rose-50 text-rose-700 text-center">TOTAL</th>
                                                    </tr>
                                                ) : (
                                                    <tr>
                                                        <th className="px-4 py-3 border-b border-slate-200">BASE</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">CREW ID</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">RANK</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">CREW NAME</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">DUTY START</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">DUTY END</th>
                                                        <th className="px-4 py-3 border-b border-slate-200 text-sky-700">FLIGHT NO</th>
                                                        <th className="px-4 py-3 border-b border-slate-200">SECTOR</th>
                                                        <th className="px-4 py-3 border-b border-slate-200 w-10">DEL</th>
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody>
                                                 {tabState === 'summary' && summaryData.map((s, i) => (
                                                     <tr key={s.id} className="hover:bg-slate-50 transition border-b border-slate-200">
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 text-center text-slate-400 font-mono">{i+1}</td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 font-bold">{s.base}</td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 font-mono text-slate-500">{s.id}</td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100"><span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{s.rank}</span></td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 font-bold text-slate-800">{s.name}</td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 text-center font-bold text-amber-600 bg-amber-50/30">{s.active || '-'}</td>
                                                         <td className="px-4 py-2 border-b border-r border-slate-100 text-center font-bold text-blue-600 bg-blue-50/30">{s.pass || '-'}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 text-center font-black text-rose-600 bg-rose-50/50">{s.total}</td>
                                                     </tr>
                                                 ))}

                                                 {tabState !== 'summary' && (tabState === 'detail-active' ? detailsActive : detailsPass).map(d => (
                                                     <tr key={d._id} className="hover:bg-slate-50 transition border-b border-slate-100 group">
                                                         <td className="px-4 py-2 border-b border-slate-100 font-bold">{d.base}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 font-mono text-slate-500">{d.id}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100"><span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{d.rank}</span></td>
                                                         <td className="px-4 py-2 border-b border-slate-100 font-medium">{d.name}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">{formatDateTimeTR(d.startDate).replace(' ', ' | ')}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 text-slate-600 whitespace-nowrap">{formatDateTimeTR(d.endDate).replace(' ', ' | ')}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 font-mono font-bold text-sky-700">{d.flight}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100 text-slate-500">{d.route}</td>
                                                         <td className="px-4 py-2 border-b border-slate-100">
                                                             <button className="text-slate-300 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50" onClick={() => deleteRow(d._id, d.type)}>
                                                                 <Trash2 className="w-4 h-4" />
                                                             </button>
                                                         </td>
                                                     </tr>
                                                 ))}

                                                 {((tabState === 'summary' && summaryData.length === 0) || 
                                                  (tabState === 'detail-active' && detailsActive.length === 0) || 
                                                  (tabState === 'detail-pass' && detailsPass.length === 0)) && (
                                                     <tr><td colSpan={10} className="py-20 text-center"><CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto mb-3" /><p className="text-slate-500 font-medium">Bu listede gösterilecek kayıt kalmadı.</p></td></tr>
                                                 )}
                                            </tbody>
                                            {tabState === 'summary' && summaryData.length > 0 && (
                                                <tfoot className="bg-slate-800 text-white font-bold tracking-wider">
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-3 text-right">GRAND TOTAL:</td>
                                                        <td className="px-4 py-3 text-center text-amber-400">{grandTotal.active}</td>
                                                        <td className="px-4 py-3 text-center text-blue-400">{grandTotal.pass}</td>
                                                        <td className="px-4 py-3 text-center text-rose-400 text-sm">{grandTotal.total}</td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                       </table>
                                   </div>
                              </div>
                         </div>
                     </div>
                 )}
             </main>
        </div>
    );
}
