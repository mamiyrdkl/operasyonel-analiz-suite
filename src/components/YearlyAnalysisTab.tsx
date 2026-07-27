'use client';
import React, { useState, useMemo, useRef } from 'react';
import { BarChart3, FolderOpen, RefreshCw, FileSpreadsheet, CalendarDays, Users, AlertTriangle, Clock, ChevronDown, ChevronUp, Upload, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HEADER_ALIASES, findColumnIndex, parseFlightDate, cleanStr, extractDelayColumns, parseDelayTime, matchDelayCode } from '@/lib/excelParser';
import { useSettings } from '@/lib/useSettings';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Filler } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Filler);

const MONTH_NAMES = ['OCA','ŞUB','MAR','NİS','MAY','HAZ','TEM','AĞU','EYL','EKİ','KAS','ARA'];
const SHIFT_COLORS: Record<string, string> = { EARLY: '#f59e0b', LATE: '#06b6d4', NIGHT: '#6366f1' };
const CODE_COLORS = ['#ef4444','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#22c55e','#64748b'];

type YearlyRecord = {
  date: string; dateIso: string; month: number; monthName: string;
  shift: string; flight: string; depPort: string; arrPort: string;
  std: string; atd: string; delayCode: string; delayTimeVal: number;
  desc: string; chief: string; remark: string;
};

type ChiefScheduleEntry = { date: string; shift: string; chief: string };

// Türkçe karakter normalize — İ→I, Ş→S, Ç→C, Ü→U, Ö→O, Ğ→G, ı→I
const normalizeTR = (s: string): string => {
  return s
    .replace(/İ/g, 'I').replace(/ı/g, 'I')
    .replace(/Ş/g, 'S').replace(/ş/g, 'S')
    .replace(/Ç/g, 'C').replace(/ç/g, 'C')
    .replace(/Ü/g, 'U').replace(/ü/g, 'U')
    .replace(/Ö/g, 'O').replace(/ö/g, 'O')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'G')
    .toUpperCase();
};

// ===================== COMPONENT =====================
export default function YearlyAnalysisTab() {
  const { delayCodes, chiefs } = useSettings();
  const [monthlyFiles, setMonthlyFiles] = useState<Record<number, File[]>>({});
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [chiefSchedule, setChiefSchedule] = useState<ChiefScheduleEntry[]>([]);
  const chiefScheduleRef = useRef<ChiefScheduleEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<YearlyRecord[]>([]);
  const [activeView, setActiveView] = useState<'monthly' | 'shift' | 'code' | 'chief'>('monthly');
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(true);

  const totalFileCount = Object.values(monthlyFiles).reduce((s, arr) => s + arr.length, 0);

  // ===================== FILE HANDLERS =====================
  const handleMonthFileUpload = (monthIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setMonthlyFiles(prev => ({
        ...prev,
        [monthIdx]: [...(prev[monthIdx] || []), ...selected]
      }));
    }
    e.target.value = ''; // Reset input
  };

  const removeMonthFile = (monthIdx: number, fileIdx: number) => {
    setMonthlyFiles(prev => {
      const updated = [...(prev[monthIdx] || [])];
      updated.splice(fileIdx, 1);
      return { ...prev, [monthIdx]: updated };
    });
  };

  const clearAllFiles = () => {
    setMonthlyFiles({});
    setData([]);
  };

  const handleScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setScheduleFile(f);
      parseScheduleFile(f);
    }
  };

  // ===================== PARSE SCHEDULE =====================
  const parseScheduleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target?.result as ArrayBuffer), { type: 'array' });
        const allEntries: ChiefScheduleEntry[] = [];
        const settingsChiefNames = chiefs.map(c => cleanStr(c));
        const settingsChiefNorm = chiefs.map(c => normalizeTR(cleanStr(c)));
        
        console.log('[Schedule] === BAŞLADI ===');
        console.log('[Schedule] Şefler:', chiefs);
        console.log('[Schedule] Normalize:', settingsChiefNorm);
        console.log('[Schedule] Sayfalar:', wb.SheetNames.join(', '));

        wb.SheetNames.forEach((sheetName, sheetIdx) => {
          const rawData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
          if (!rawData || rawData.length === 0) return;
          console.log(`\n[Schedule] ====== "${sheetName}" (${rawData.length} satır) ======`);

          // Ay/Yıl tespiti
          let monthYear = detectMonthYear(sheetName, file.name, rawData, sheetIdx, wb.SheetNames.length);
          if (!monthYear) {
            console.log(`[Schedule] ⚠ Ay tespit edilemedi! Sayfa: "${sheetName}"`);
            return; // Bu sayfayı atla
          }
          const { month, year } = monthYear;
          console.log(`[Schedule] → ${MONTH_NAMES[month]} ${year}`);

          // Gün sütunlarını bul
          let dayHeaderRowIdx = -1;
          let dayColMap: Record<number, number> = {};
          let bestDayCount = 0;
          for (let r = 0; r < Math.min(100, rawData.length); r++) {
            const row = rawData[r];
            if (!row) continue;
            const numCols: Record<number, number> = {};
            let cnt = 0;
            for (let c = 0; c < row.length; c++) {
              const v = typeof row[c] === 'number' ? row[c] : parseInt(String(row[c]).trim());
              if (!isNaN(v) && v >= 1 && v <= 31 && Number.isInteger(v)) { numCols[v] = c; cnt++; }
            }
            if (cnt >= 5 && cnt > bestDayCount) { bestDayCount = cnt; dayHeaderRowIdx = r; dayColMap = numCols; }
          }
          if (dayHeaderRowIdx === -1) { console.log('[Schedule] Gün sütunları bulunamadı!'); return; }
          console.log(`[Schedule] Gün satırı: ${dayHeaderRowIdx}, ${Object.keys(dayColMap).length} gün`);

          // PASS 1: Her satırdaki isim ve shift verisini çıkar
          const rowData: { idx: number; chief: string; shiftCnt: number }[] = [];
          for (let r = 0; r < rawData.length; r++) {
            const row = rawData[r];
            if (!row || row.length < 2) continue;

            // Gün sütunlarındaki E/L/N sayısını say
            let shiftCnt = 0;
            for (const colIdx of Object.values(dayColMap)) {
              const v = String(row[colIdx] || '').trim().toUpperCase();
              if (v === 'E' || v === 'L' || v === 'N') shiftCnt++;
            }

            // Şef ismi ara — Türkçe karakter normalize ile
            let chief = '';
            for (let c = 0; c < row.length; c++) {
              const cv = cleanStr(row[c]);
              const cvNorm = normalizeTR(cv);
              if (cv.length < 3 || /^\d+$/.test(cv)) continue;
              for (let si = 0; si < settingsChiefNorm.length; si++) {
                const scNorm = settingsChiefNorm[si];
                // Tam eşleşme (normalize)
                if (cvNorm === scNorm) { chief = chiefs[si]; break; }
                // İçerik eşleşmesi (normalize)
                if ((cvNorm.includes(scNorm) || scNorm.includes(cvNorm)) && cv.length >= 4) { chief = chiefs[si]; break; }
                // Soyisim eşleşmesi (normalize)
                const sParts = scNorm.split(/\s+/);
                const cParts = cvNorm.split(/\s+/);
                for (const cp of cParts) {
                  if (cp.length >= 4 && sParts.some(sp => sp.length >= 4 && sp === cp)) { chief = chiefs[si]; break; }
                }
                if (chief) break;
              }
              if (chief) break;
            }
            rowData.push({ idx: r, chief, shiftCnt });
          }

          // PASS 2: E/L/N olan satırlar için yukarıya bakarak en yakın ismi bul
          let foundCount = 0;
          for (const rd of rowData) {
            if (rd.shiftCnt < 3) continue;
            
            let assignedChief = rd.chief;
            if (!assignedChief) {
              // Yukarıya bak
              for (let look = rowData.indexOf(rd) - 1; look >= 0; look--) {
                if (rowData[look].chief) { assignedChief = rowData[look].chief; break; }
              }
            }
            if (!assignedChief) {
              console.log(`[Schedule] ✗ Satır ${rd.idx}: ${rd.shiftCnt} shift ama isim yok`);
              continue;
            }

            foundCount++;
            const row = rawData[rd.idx];
            let added = 0;
            for (const [dayStr, colIdx] of Object.entries(dayColMap)) {
              const dayNum = parseInt(dayStr);
              const v = String(row[colIdx] || '').trim().toUpperCase();
              let shift = '';
              if (v === 'E') shift = 'EARLY';
              else if (v === 'L') shift = 'LATE';
              else if (v === 'N') shift = 'NIGHT';
              if (shift) {
                const dt = new Date(Date.UTC(year, month, dayNum));
                if (dt.getUTCMonth() === month && dt.getUTCDate() === dayNum) {
                  allEntries.push({ date: dt.toISOString().split('T')[0], shift, chief: assignedChief });
                  added++;
                }
              }
            }
            console.log(`[Schedule] ✓ Satır ${rd.idx}: "${assignedChief}" → ${added} vardiya`);
          }
          console.log(`[Schedule] Sayfa: ${foundCount} amir satırı`);
        });

        chiefScheduleRef.current = allEntries;
        setChiefSchedule(allEntries);

        const uChiefs = [...new Set(allEntries.map(e => e.chief))];
        const uMonths = [...new Set(allEntries.map(e => e.date.substring(0, 7)))].sort();
        console.log(`[Schedule] === TOPLAM: ${allEntries.length} kayıt, ${uChiefs.length} amir ===`);

        if (allEntries.length > 0) {
          const perChief = uChiefs.map(ch => `${ch}: ${allEntries.filter(e => e.chief === ch).length} vardiya`);
          alert(`✓ Çalışma programı yüklendi!\n\n${allEntries.length} vardiya kaydı\n\n${perChief.join('\n')}\n\nAylar: ${uMonths.join(', ')}`);
        } else {
          alert('Eşleşme bulunamadı. F12 → Console ile detayları kontrol edin.');
        }
      } catch (err) {
        console.error('[Schedule] HATA:', err);
        alert('Çalışma programı okunamadı: ' + (err as Error).message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Ay ve yıl tespiti: Sayfa adı, dosya adı veya içerikten
  const detectMonthYear = (sheetName: string, fileName: string, rawData: any[][], sheetIdx: number, totalSheets: number): { month: number; year: number } | null => {
    const turkishMonths: Record<string, number> = {
      'OCAK': 0, 'ŞUBAT': 1, 'SUBAT': 1, 'MART': 2, 'NİSAN': 3, 'NISAN': 3,
      'MAYIS': 4, 'HAZİRAN': 5, 'HAZIRAN': 5, 'TEMMUZ': 6, 'AĞUSTOS': 7, 'AGUSTOS': 7,
      'EYLÜL': 8, 'EYLUL': 8, 'EKİM': 9, 'EKIM': 9, 'KASIM': 10, 'ARALIK': 11,
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
      'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11,
      'JANUARY': 0, 'FEBRUARY': 1, 'MARCH': 2, 'APRIL': 3, 'JUNE': 5,
      'JULY': 6, 'AUGUST': 7, 'SEPTEMBER': 8, 'OCTOBER': 9, 'NOVEMBER': 10, 'DECEMBER': 11
    };

    const tryParse = (text: string): { month: number; year: number } | null => {
      const upper = text.toLocaleUpperCase('tr-TR').trim();
      // "OCAK 2026" veya "2026 OCAK" gibi
      for (const [name, idx] of Object.entries(turkishMonths)) {
        if (upper.includes(name)) {
          const yearMatch = upper.match(/(20\d{2})/);
          if (yearMatch) return { month: idx, year: parseInt(yearMatch[1]) };
          return { month: idx, year: new Date().getFullYear() };
        }
      }
      // Sayısal: "01/2026", "01-2026", "01.2026"
      const numMatch = upper.match(/(\d{1,2})[.\-/](\d{4})/);
      if (numMatch) {
        const m = parseInt(numMatch[1]) - 1;
        if (m >= 0 && m <= 11) return { month: m, year: parseInt(numMatch[2]) };
      }
      return null;
    };

    // 1. Sayfa adından
    let result = tryParse(sheetName);
    if (result) { console.log(`[Schedule] Ay tespit: Sayfa adı "${sheetName}" → ${MONTH_NAMES[result.month]} ${result.year}`); return result; }

    // 2. Dosya adından
    result = tryParse(fileName);
    if (result) { console.log(`[Schedule] Ay tespit: Dosya adı "${fileName}" → ${MONTH_NAMES[result.month]} ${result.year}`); return result; }

    // 3. İlk 10 satırdan
    for (let r = 0; r < Math.min(10, rawData.length); r++) {
      const row = rawData[r];
      if (!row) continue;
      for (const cell of row) {
        if (cell) {
          result = tryParse(String(cell));
          if (result) { console.log(`[Schedule] Ay tespit: Hücre satır ${r} → ${MONTH_NAMES[result.month]} ${result.year}`); return result; }
        }
      }
    }

    // 4. Gün sayısından ay tahmini: sayfadaki gün sütunlarının max değerine bak
    // Bu en son çare — 12 sayfalı dosyalarda sayfa sırasını kullan
    if (totalSheets >= 11 && totalSheets <= 13) {
      // 12 sayfalı Excel: her sayfa bir ay (Ocak=0, ..., Aralık=11)
      const month = sheetIdx % 12;
      const year = new Date().getFullYear();
      console.log(`[Schedule] Ay tespit: 12 sayfalı dosya, sayfa sırası ${sheetIdx} → ${MONTH_NAMES[month]} ${year}`);
      return { month, year };
    }

    return null;
  };

  // ===================== FIND CHIEF FROM SCHEDULE =====================
  const findChiefDebugCount = useRef(0);
  const findChief = (dateIso: string, shift: string): string => {
    const schedule = chiefScheduleRef.current;
    if (schedule.length === 0) return '';
    
    // SADECE tam eşleşme: tarih + vardiya
    // Gecikme hangi gün hangi vardiyada olduysa, o gün o vardiyada çalışan amir atanır
    const exact = schedule.find(e => e.date === dateIso && e.shift === shift);
    if (exact) return exact.chief;

    if (findChiefDebugCount.current < 10) {
      findChiefDebugCount.current++;
      console.log(`[FindChief] Eşleşmedi: ${dateIso} / ${shift} — schedule'da bu tarih+vardiya yok`);
    }
    return '';
  };

  // ===================== PROCESS ALL FILES =====================
  const processAllFiles = async () => {
    const allFiles = Object.values(monthlyFiles).flat();
    if (allFiles.length === 0 || delayCodes.length === 0) {
      alert(delayCodes.length === 0 ? 'Lütfen Ayarlar\'dan gecikme kodlarını tanımlayın!' : 'Lütfen en az 1 dosya yükleyin!');
      return;
    }
    setIsProcessing(true);
    findChiefDebugCount.current = 0;
    const allRecords: YearlyRecord[] = [];

    for (const file of allFiles) {
      const records = await parseOneFile(file);
      allRecords.push(...records);
    }

    // Sort by date then shift
    const shiftOrder: Record<string, number> = { NIGHT: 0, EARLY: 1, LATE: 2 };
    allRecords.sort((a, b) => {
      const dc = a.dateIso.localeCompare(b.dateIso);
      if (dc !== 0) return dc;
      return (shiftOrder[a.shift] ?? 3) - (shiftOrder[b.shift] ?? 3);
    });

    setData(allRecords);
    setIsProcessing(false);
    if (allRecords.length === 0) alert('Ekip kaynaklı gecikme bulunamadı.');
  };

  const parseOneFile = (file: File): Promise<YearlyRecord[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(raw, { type: 'array' });
          const rawData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

          let headerRowIndex = -1, maxScore = 0;
          for (let i = 0; i < Math.min(100, rawData.length); i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            let score = 0;
            if (findColumnIndex(row, HEADER_ALIASES.flight) !== -1) score += 10;
            if (findColumnIndex(row, HEADER_ALIASES.dateLong) !== -1 || findColumnIndex(row, HEADER_ALIASES.std) !== -1) score += 5;
            if (findColumnIndex(row, HEADER_ALIASES.depPort) !== -1) score += 2;
            row.forEach((c: any) => { const s = cleanStr(c); if (s.includes('DELAY') || s.includes('GECIKME') || s.includes('GECİKME')) score += 1; });
            if (score > maxScore) { maxScore = score; headerRowIndex = i; }
          }
          if (headerRowIndex === -1) { resolve([]); return; }

          const headerRow = rawData[headerRowIndex];
          const idxFlight = findColumnIndex(headerRow, HEADER_ALIASES.flight);
          const idxDepPort = findColumnIndex(headerRow, HEADER_ALIASES.depPort);
          const idxArrPort = findColumnIndex(headerRow, HEADER_ALIASES.arrPort);
          const idxStd = findColumnIndex(headerRow, HEADER_ALIASES.std);
          const idxAtd = findColumnIndex(headerRow, HEADER_ALIASES.atd);
          const idxRemark = findColumnIndex(headerRow, HEADER_ALIASES.remark);
          const idxDateLong = findColumnIndex(headerRow, HEADER_ALIASES.dateLong);
          const delayCols = extractDelayColumns(headerRow);

          const results: YearlyRecord[] = [];
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

            const dateIso = dateObj.toISOString().split('T')[0];
            const d = String(dateObj.getUTCDate()).padStart(2, '0');
            const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const dateStr = `${d}/${m}/${dateObj.getUTCFullYear()}`;
            const monthIdx = dateObj.getUTCMonth();

            let timeVal = 0;
            if (idxStd !== -1) {
              const s = String(row[idxStd] || '').replace(/[^0-9]/g, '').padStart(4, '0');
              timeVal = parseInt(s) || 0;
            }
            let shift = 'NIGHT';
            if (timeVal >= 701 && timeVal <= 1500) shift = 'EARLY';
            else if (timeVal >= 1501 && timeVal <= 2300) shift = 'LATE';

            delayCols.forEach((g: any) => {
              const code = cleanStr(row[g.codeIdx]);
              const time = parseDelayTime(row[g.timeIdx]);
              if (!code || time < 15) return;
              
              const matched = matchDelayCode(code, delayCodes);
              
              if (matched) {
                results.push({
                  date: dateStr, dateIso, month: monthIdx, monthName: MONTH_NAMES[monthIdx],
                  shift, flight: row[idxFlight],
                  depPort: idxDepPort !== -1 ? row[idxDepPort] : '',
                  arrPort: idxArrPort !== -1 ? row[idxArrPort] : '',
                  std: idxStd !== -1 ? row[idxStd] : '',
                  atd: idxAtd !== -1 ? row[idxAtd] : '',
                  delayCode: code, delayTimeVal: time, desc: matched.desc,
                  chief: findChief(dateIso, shift),
                  remark: idxRemark !== -1 ? String(row[idxRemark] || '') : '',
                });
              }
            });
          }
          resolve(results);
        } catch { resolve([]); }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // ===================== COMPUTED METRICS =====================
  const hasData = data.length > 0;
  const totalMins = useMemo(() => data.reduce((s, d) => s + d.delayTimeVal, 0), [data]);
  const avgMins = hasData ? Math.round(totalMins / data.length) : 0;

  // Monthly breakdown
  const monthlyStats = useMemo(() => {
    const m: Record<number, { count: number; mins: number; flights: Set<string> }> = {};
    for (let i = 0; i < 12; i++) m[i] = { count: 0, mins: 0, flights: new Set() };
    data.forEach(d => { m[d.month].count++; m[d.month].mins += d.delayTimeVal; m[d.month].flights.add(d.flight); });
    return m;
  }, [data]);

  // Shift breakdown
  const shiftStats = useMemo(() => {
    const s: Record<string, { count: number; mins: number }> = { EARLY: { count: 0, mins: 0 }, LATE: { count: 0, mins: 0 }, NIGHT: { count: 0, mins: 0 } };
    data.forEach(d => { if (s[d.shift]) { s[d.shift].count++; s[d.shift].mins += d.delayTimeVal; } });
    return s;
  }, [data]);

  // Code breakdown
  const codeStats = useMemo(() => {
    const c: Record<string, { code: string; desc: string; count: number; mins: number }> = {};
    data.forEach(d => {
      if (!c[d.delayCode]) c[d.delayCode] = { code: d.delayCode, desc: d.desc, count: 0, mins: 0 };
      c[d.delayCode].count++; c[d.delayCode].mins += d.delayTimeVal;
    });
    return Object.values(c).sort((a, b) => b.mins - a.mins);
  }, [data]);

  // Chief breakdown
  const chiefStats = useMemo(() => {
    const c: Record<string, { chief: string; count: number; mins: number }> = {};
    data.forEach(d => {
      const ch = d.chief || 'DİĞER GECİKMELER';
      if (!c[ch]) c[ch] = { chief: ch, count: 0, mins: 0 };
      c[ch].count++; c[ch].mins += d.delayTimeVal;
    });
    return Object.values(c).sort((a, b) => b.mins - a.mins);
  }, [data]);

  // Chief monthly breakdown (amir başına aylık detay)
  const chiefMonthlyDetail = useMemo(() => {
    const result: Record<string, { months: Record<number, { count: number; mins: number; flights: YearlyRecord[] }> }> = {};
    data.forEach(d => {
      const ch = d.chief || 'DİĞER GECİKMELER';
      if (!result[ch]) {
        result[ch] = { months: {} };
        for (let i = 0; i < 12; i++) result[ch].months[i] = { count: 0, mins: 0, flights: [] };
      }
      result[ch].months[d.month].count++;
      result[ch].months[d.month].mins += d.delayTimeVal;
      result[ch].months[d.month].flights.push(d);
    });
    return result;
  }, [data]);

  // Monthly chart data
  const monthlyBarData = {
    labels: MONTH_NAMES,
    datasets: [
      { label: 'Gecikme (dk)', data: MONTH_NAMES.map((_, i) => monthlyStats[i].mins), backgroundColor: '#ef4444', borderRadius: 4 },
      { label: 'Adet', data: MONTH_NAMES.map((_, i) => monthlyStats[i].count), backgroundColor: '#3b82f6', borderRadius: 4 },
    ]
  };

  // Shift monthly trend
  const shiftMonthlyData = {
    labels: MONTH_NAMES,
    datasets: ['EARLY', 'LATE', 'NIGHT'].map(s => ({
      label: s, borderColor: SHIFT_COLORS[s], backgroundColor: SHIFT_COLORS[s],
      data: MONTH_NAMES.map((_, i) => data.filter(d => d.month === i && d.shift === s).reduce((sum, d) => sum + d.delayTimeVal, 0)),
      tension: 0.4, fill: false, pointRadius: 3,
    }))
  };

  // Code pareto
  const codeParetoData = {
    labels: codeStats.map(c => c.code),
    datasets: [{
      label: 'Toplam Dk', data: codeStats.map(c => c.mins),
      backgroundColor: codeStats.map((_, i) => CODE_COLORS[i % CODE_COLORS.length]), borderRadius: 4,
    }]
  };

  // Chief pie
  const chiefPieData = {
    labels: chiefStats.filter(c => c.chief !== 'DİĞER GECİKMELER').map(c => c.chief),
    datasets: [{ data: chiefStats.filter(c => c.chief !== 'DİĞER GECİKMELER').map(c => c.mins), backgroundColor: CODE_COLORS, borderWidth: 2, borderColor: '#fff' }]
  };

  // ===================== EXCEL EXPORT =====================
  const exportYearlyExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    
    // Watermark
    let watermarkId: number | null = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 1200; canvas.height = 900;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(600, 450); ctx.rotate(-Math.PI / 8);
        ctx.fillStyle = 'rgba(213, 43, 30, 0.07)';
        ctx.font = 'italic 900 160px "Times New Roman"';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('PEGASUS', 0, 0);
        const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
        watermarkId = workbook.addImage({ base64: b64, extension: 'png' });
      }
    }

    const border: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF808080' } }, left: { style: 'thin', color: { argb: 'FF808080' } },
      bottom: { style: 'thin', color: { argb: 'FF808080' } }, right: { style: 'thin', color: { argb: 'FF808080' } }
    };

    // Sheet 1: All Data
    const ws1 = workbook.addWorksheet('Tüm Veriler');
    if (watermarkId !== null) ws1.addBackgroundImage(watermarkId);
    ws1.addRow([]);
    const t1 = ws1.addRow(['YILLIK EKİP GECİKME ANALİZİ - KIRILIM RAPORU']);
    t1.font = { size: 16, bold: true, color: { argb: 'FFD52B1E' } };
    ws1.addRow([]);
    const h1 = ['TARİH','VARDİYA','AMİR','UÇUŞ','KALKIŞ','VARIŞ','STD','ATD','KOD','SÜRE (dk)','AÇIKLAMA'];
    const hr1 = ws1.addRow(h1);
    hr1.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = border; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
    data.forEach((r, i) => {
      const dr = ws1.addRow([r.date, r.shift, r.chief || 'DİĞER GECİKMELER', r.flight, r.depPort, r.arrPort, r.std, r.atd, r.delayCode, r.delayTimeVal, r.desc]);
      dr.eachCell(c => { c.border = border; c.font = { name: 'Calibri', size: 11 }; if (i % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; });
    });
    [12,12,20,12,8,8,8,8,10,12,30].forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

    // Sheet 2: Monthly Summary
    const ws2 = workbook.addWorksheet('Aylık Özet');
    if (watermarkId !== null) ws2.addBackgroundImage(watermarkId);
    ws2.addRow([]);
    const t2 = ws2.addRow(['AYLIK KIRILIM ÖZETİ']);
    t2.font = { size: 14, bold: true, color: { argb: 'FFD52B1E' } };
    ws2.addRow([]);
    const h2 = ['AY', 'GECİKME ADETİ', 'TOPLAM DK', 'ORT. DK'];
    const hr2 = ws2.addRow(h2);
    hr2.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = border; c.alignment = { horizontal: 'center' }; });
    MONTH_NAMES.forEach((m, i) => {
      const ms = monthlyStats[i];
      const dr = ws2.addRow([m, ms.count, ms.mins, ms.count > 0 ? Math.round(ms.mins / ms.count) : 0]);
      dr.eachCell(c => { c.border = border; if (i % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; });
    });
    const totalRow = ws2.addRow(['TOPLAM', data.length, totalMins, avgMins]);
    totalRow.eachCell(c => { c.border = border; c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }; });

    // Sheet 3: Shift Summary
    const ws3 = workbook.addWorksheet('Vardiya Özet');
    if (watermarkId !== null) ws3.addBackgroundImage(watermarkId);
    ws3.addRow([]);
    const t3 = ws3.addRow(['VARDİYA KIRILIMI']);
    t3.font = { size: 14, bold: true, color: { argb: 'FFD52B1E' } };
    ws3.addRow([]);
    const h3 = ['VARDİYA', 'GECİKME ADETİ', 'TOPLAM DK', 'ORT. DK', 'YÜZDE %'];
    const hr3 = ws3.addRow(h3);
    hr3.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = border; c.alignment = { horizontal: 'center' }; });
    ['EARLY','LATE','NIGHT'].forEach((s, i) => {
      const ss = shiftStats[s];
      const pct = data.length > 0 ? ((ss.count / data.length) * 100).toFixed(1) : '0';
      const dr = ws3.addRow([s, ss.count, ss.mins, ss.count > 0 ? Math.round(ss.mins / ss.count) : 0, pct + '%']);
      dr.eachCell(c => { c.border = border; if (i % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; });
    });

    // Sheet 4: Code Summary
    const ws4 = workbook.addWorksheet('Gecikme Kodu Özet');
    if (watermarkId !== null) ws4.addBackgroundImage(watermarkId);
    ws4.addRow([]);
    const t4 = ws4.addRow(['GECİKME KODU KIRILIMI']);
    t4.font = { size: 14, bold: true, color: { argb: 'FFD52B1E' } };
    ws4.addRow([]);
    const h4 = ['KOD', 'AÇIKLAMA', 'ADET', 'TOPLAM DK', 'YÜZDE %'];
    const hr4 = ws4.addRow(h4);
    hr4.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = border; c.alignment = { horizontal: 'center' }; });
    codeStats.forEach((cs, i) => {
      const pct = totalMins > 0 ? ((cs.mins / totalMins) * 100).toFixed(1) : '0';
      const dr = ws4.addRow([cs.code, cs.desc, cs.count, cs.mins, pct + '%']);
      dr.eachCell(c => { c.border = border; if (i % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; });
    });
    ws4.getColumn(2).width = 35;

    // Sheet 5: Chief Summary
    const ws5 = workbook.addWorksheet('Amir Özet');
    if (watermarkId !== null) ws5.addBackgroundImage(watermarkId);
    ws5.addRow([]);
    const t5 = ws5.addRow(['AMİR KIRILIMI']);
    t5.font = { size: 14, bold: true, color: { argb: 'FFD52B1E' } };
    ws5.addRow([]);
    const h5 = ['AMİR', 'GECİKME ADETİ', 'TOPLAM DK', 'ORT. DK', 'YÜZDE %'];
    const hr5 = ws5.addRow(h5);
    hr5.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = border; c.alignment = { horizontal: 'center' }; });
    chiefStats.forEach((cs, i) => {
      const pct = totalMins > 0 ? ((cs.mins / totalMins) * 100).toFixed(1) : '0';
      const dr = ws5.addRow([cs.chief, cs.count, cs.mins, cs.count > 0 ? Math.round(cs.mins / cs.count) : 0, pct + '%']);
      dr.eachCell(c => { c.border = border; if (i % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; });
    });
    ws5.getColumn(1).width = 25;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Yillik_Kirilim_Analizi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ===================== RENDER =====================
  const tabBtnClass = (active: boolean) => `px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${active ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`;

  return (
    <div className="absolute inset-0 flex flex-col transition-opacity duration-300 z-10 w-full h-full">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shrink-0 shadow-sm z-20 w-full">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600"><BarChart3 className="w-5 h-5" /></div>
          Yıllık Kırılım Analizi
          {totalFileCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{totalFileCount} dosya</span>}
        </h2>
        <div className="flex items-center gap-2">
          <input type="file" id="scheduleInput" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleScheduleUpload} />
          <label htmlFor="scheduleInput" className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1.5 border shadow-sm ${scheduleFile ? 'bg-green-50 text-green-700 border-green-300' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
            <Users className="w-3.5 h-3.5" /> {scheduleFile ? `✓ ${scheduleFile.name}` : 'Çalışma Programı'}
          </label>
          <div className="h-6 w-px bg-slate-200" />
          <button onClick={() => setShowUploadPanel(!showUploadPanel)} className="bg-white border text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            {showUploadPanel ? 'Panelı Gizle' : 'Dosya Yükle'}
          </button>
          <button disabled={totalFileCount === 0 || isProcessing} onClick={processAllFiles}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} /> İŞLE
          </button>
          <button disabled={!hasData} onClick={exportYearlyExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> EXCEL
          </button>
          {totalFileCount > 0 && (
            <button onClick={clearAllFiles} className="text-red-400 hover:text-red-600 p-2 transition" title="Tümünü Temizle">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden p-4 gap-3 bg-slate-50 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center"><RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" /><span className="font-bold text-slate-800 tracking-wider">VERİLER İŞLENİYOR...</span></div>
          </div>
        )}

        {/* MONTHLY FILE UPLOAD GRID */}
        {showUploadPanel && (
          <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-4 shrink-0 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aylık Dosya Yükleme (Her ay için ayrı Excel yükleyebilirsiniz)</span>
              <span className="text-[10px] text-slate-400">{totalFileCount} / 12 ay</span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {MONTH_NAMES.map((mName, mIdx) => {
                const mFiles = monthlyFiles[mIdx] || [];
                const hasFiles = mFiles.length > 0;
                return (
                  <div key={mIdx} className={`relative rounded-lg border-2 p-2 transition-all ${hasFiles ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-[10px] font-black ${hasFiles ? 'text-green-700' : 'text-slate-500'}`}>{mName}</span>
                      {hasFiles && <span className="text-[9px] bg-green-200 text-green-800 px-1 rounded font-bold">{mFiles.length}</span>}
                    </div>
                    {hasFiles ? (
                      <div className="space-y-0.5">
                        {mFiles.map((f, fi) => (
                          <div key={fi} className="flex items-center gap-1 text-[9px] text-green-700 bg-green-100 rounded px-1 py-0.5">
                            <span className="truncate flex-1" title={f.name}>{f.name.length > 12 ? f.name.slice(0, 12) + '...' : f.name}</span>
                            <button onClick={() => removeMonthFile(mIdx, fi)} className="text-red-400 hover:text-red-600 shrink-0"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <label className="block text-center text-[9px] text-green-600 hover:text-green-800 cursor-pointer font-bold mt-0.5">+ Ekle
                          <input type="file" accept=".xls,.xlsx,.csv" className="hidden" multiple onChange={(e) => handleMonthFileUpload(mIdx, e)} />
                        </label>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-10 cursor-pointer group">
                        <Upload className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" />
                        <span className="text-[9px] text-slate-400 group-hover:text-blue-600 font-medium mt-0.5">Seçin</span>
                        <input type="file" accept=".xls,.xlsx,.csv" className="hidden" multiple onChange={(e) => handleMonthFileUpload(mIdx, e)} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest">TOPLAM GECİKME</span>
            <span className="text-3xl font-black text-slate-800 mt-1">{data.length}</span>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 mt-1">Kayıt</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest">TOPLAM SÜRE</span>
            <span className="text-3xl font-black text-red-600 mt-1">{totalMins}</span>
            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 mt-1">Dakika</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest">ORTALAMA</span>
            <span className="text-3xl font-black text-amber-600 mt-1">{avgMins}</span>
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 mt-1">dk/gecikme</span>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-slate-400 tracking-widest">AKTİF AY</span>
            <span className="text-3xl font-black text-emerald-600 mt-1">{Object.values(monthlyStats).filter(m => m.count > 0).length}</span>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mt-1">/ 12 Ay</span>
          </div>
        </div>

        {/* VIEW TABS */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setActiveView('monthly')} className={tabBtnClass(activeView === 'monthly')}><CalendarDays className="w-3.5 h-3.5 inline mr-1" />Aylık Kırılım</button>
          <button onClick={() => setActiveView('shift')} className={tabBtnClass(activeView === 'shift')}><Clock className="w-3.5 h-3.5 inline mr-1" />Vardiya</button>
          <button onClick={() => setActiveView('code')} className={tabBtnClass(activeView === 'code')}><AlertTriangle className="w-3.5 h-3.5 inline mr-1" />Gecikme Kodu</button>
          <button onClick={() => setActiveView('chief')} className={tabBtnClass(activeView === 'chief')}><Users className="w-3.5 h-3.5 inline mr-1" />Amir</button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-auto custom-scroll">
          {!hasData && (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-slate-400">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-500 mb-2">Yıllık Kırılım Analizi</h3>
                <p className="text-sm">Excel dosyalarınızı yükleyin ve İŞLE butonuna basın.</p>
                <p className="text-xs mt-2 text-purple-500 font-medium">💡 Çalışma programı yüklerseniz amirler otomatik eşleşir</p>
              </div>
            </div>
          )}

          {/* ===== MONTHLY VIEW ===== */}
          {hasData && activeView === 'monthly' && (
            <div className="flex flex-col gap-3">
              {/* Chart */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[240px]">
                <h3 className="text-[11px] font-bold text-slate-500 tracking-widest mb-2">AYLIK GECİKME TRENDİ</h3>
                <div className="h-[180px]">
                  <Bar data={monthlyBarData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 8, font: { size: 9 } } } }, scales: { y: { title: { display: true, text: 'Değer', font: { size: 9 } } } } }} />
                </div>
              </div>
              {/* Table */}
              <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                <table className="excel-table w-full text-[10px] text-center">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-black w-20">AY</th>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-bold">GECİKME ADETİ</th>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-bold">TOPLAM DK</th>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-bold">ORT. DK</th>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-bold">YÜZDE %</th>
                      <th className="bg-slate-200 text-slate-700 border-b border-slate-300 font-bold w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTH_NAMES.map((m, i) => {
                      const ms = monthlyStats[i];
                      const pct = totalMins > 0 ? ((ms.mins / totalMins) * 100).toFixed(1) : '0.0';
                      const monthFlights = data.filter(d => d.month === i);
                      return (
                        <tr key={m} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="font-bold text-indigo-700">{m}</td>
                          <td>{ms.count || '-'}</td>
                          <td className="font-bold text-rose-600">{ms.mins || '-'}</td>
                          <td>{ms.count > 0 ? Math.round(ms.mins / ms.count) : '-'}</td>
                          <td>
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, parseFloat(pct))}%` }} /></div>
                              <span className="text-[9px]">{pct}%</span>
                            </div>
                          </td>
                          <td>
                            {ms.count > 0 && (
                              <button onClick={() => setExpandedMonth(expandedMonth === i ? null : i)} className="text-slate-400 hover:text-slate-700">
                                {expandedMonth === i ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-200 font-bold text-slate-800 border-t-2 border-slate-400">
                    <tr>
                      <td className="p-2">TOPLAM</td><td className="p-2">{data.length}</td>
                      <td className="p-2 text-rose-700">{totalMins}</td><td className="p-2">{avgMins}</td>
                      <td className="p-2">100%</td><td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Expanded month detail */}
              {expandedMonth !== null && (
                <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-3 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-indigo-700 mb-2">{MONTH_NAMES[expandedMonth]} - Detay ({data.filter(d => d.month === expandedMonth).length} kayıt)</h4>
                  <div className="overflow-auto max-h-[250px]">
                    <table className="excel-table w-full text-[10px]">
                      <thead className="sticky top-0"><tr>
                        <th className="bg-indigo-100 text-indigo-800 border-b">TARİH</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">VARDİYA</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">AMİR</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">UÇUŞ</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">KALKIŞ</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">VARIŞ</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">KOD</th>
                        <th className="bg-indigo-100 text-indigo-800 border-b">DAKİKA</th>
                      </tr></thead>
                      <tbody>
                        {data.filter(d => d.month === expandedMonth).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 border-b border-slate-100">
                            <td className="font-mono text-slate-600">{r.date}</td>
                            <td><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.shift === 'EARLY' ? 'bg-amber-100 text-amber-800' : r.shift === 'LATE' ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'}`}>{r.shift}</span></td>
                            <td className="text-slate-700 font-medium">{r.chief || '-'}</td>
                            <td className="font-bold text-slate-800">{r.flight}</td>
                            <td className="text-slate-600 tracking-wider">{r.depPort}</td>
                            <td className="text-slate-600 tracking-wider">{r.arrPort}</td>
                            <td><span className="bg-red-50 text-red-700 px-1.5 py-0.5 border border-red-200 rounded font-bold text-[10px]">{r.delayCode}</span></td>
                            <td className="font-black text-rose-600">{r.delayTimeVal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== SHIFT VIEW ===== */}
          {hasData && activeView === 'shift' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                {['EARLY','LATE','NIGHT'].map(s => {
                  const ss = shiftStats[s];
                  const pct = data.length > 0 ? ((ss.count / data.length) * 100).toFixed(1) : '0';
                  return (
                    <div key={s} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                      <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: SHIFT_COLORS[s] + '20' }}>
                        <Clock className="w-5 h-5" style={{ color: SHIFT_COLORS[s] }} />
                      </div>
                      <h4 className="font-black text-sm" style={{ color: SHIFT_COLORS[s] }}>{s}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{s === 'EARLY' ? '07:01-15:00' : s === 'LATE' ? '15:01-23:00' : '23:01-07:00'} UTC</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div><span className="text-xl font-black text-slate-800">{ss.count}</span><span className="block text-[9px] text-slate-400">Adet</span></div>
                        <div><span className="text-xl font-black text-rose-600">{ss.mins}</span><span className="block text-[9px] text-slate-400">Dakika</span></div>
                        <div><span className="text-xl font-black text-slate-600">{pct}%</span><span className="block text-[9px] text-slate-400">Oran</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[260px]">
                <h3 className="text-[11px] font-bold text-slate-500 tracking-widest mb-2">VARDİYA BAZLI AYLIK TREND</h3>
                <div className="h-[200px]"><Line data={shiftMonthlyData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 8, font: { size: 9 } } } }, scales: { y: { title: { display: true, text: 'Dakika', font: { size: 9 } } } } }} /></div>
              </div>
            </div>
          )}

          {/* ===== CODE VIEW ===== */}
          {hasData && activeView === 'code' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[280px]">
                  <h3 className="text-[11px] font-bold text-slate-500 tracking-widest mb-2">GECİKME KODU DAĞILIMI (dk)</h3>
                  <div className="h-[220px]"><Bar data={codeParetoData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9, weight: 'bold' } } }, y: { title: { display: true, text: 'Dakika', font: { size: 9 } } } } }} /></div>
                </div>
                <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                  <div className="bg-slate-100/50 px-3 py-2 border-b border-slate-200"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Gecikme Kodu Detay</span></div>
                  <div className="overflow-auto max-h-[240px]">
                    <table className="excel-table w-full text-[10px] text-center">
                      <thead className="sticky top-0"><tr>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">KOD</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">AÇIKLAMA</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">ADET</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">DK</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">%</th>
                      </tr></thead>
                      <tbody>
                        {codeStats.map((cs, i) => (
                          <tr key={cs.code} className="hover:bg-slate-50 border-b border-slate-100">
                            <td><span className="bg-red-50 text-red-700 px-1.5 py-0.5 border border-red-200 rounded font-bold">{cs.code}</span></td>
                            <td className="text-left text-slate-600 font-medium max-w-[200px] truncate" title={cs.desc}>{cs.desc}</td>
                            <td className="font-bold">{cs.count}</td>
                            <td className="font-black text-rose-600">{cs.mins}</td>
                            <td className="text-slate-500">{totalMins > 0 ? ((cs.mins / totalMins) * 100).toFixed(1) : '0'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== CHIEF VIEW ===== */}
          {hasData && activeView === 'chief' && (
            <div className="flex flex-col gap-3 overflow-auto">
              {/* Özet: Pie + Performans Tablosu */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[280px]">
                  <h3 className="text-[11px] font-bold text-slate-500 tracking-widest mb-2">AMİR DAĞILIMI</h3>
                  <div className="h-[220px]">
                    {chiefStats.filter(c => c.chief !== 'DİĞER GECİKMELER').length > 0 ? (
                      <Pie data={chiefPieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9 } } } } }} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">Çalışma programı yükleyin</div>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                  <div className="bg-slate-100/50 px-3 py-2 border-b border-slate-200"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Amir Performans Özeti</span></div>
                  <div className="overflow-auto max-h-[240px]">
                    <table className="excel-table w-full text-[10px] text-center">
                      <thead className="sticky top-0"><tr>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">AMİR</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">ADET</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">TOPLAM DK</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">ORT. DK</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">%</th>
                      </tr></thead>
                      <tbody>
                        {chiefStats.map(cs => (
                          <tr key={cs.chief} className="hover:bg-slate-50 border-b border-slate-100">
                            <td className={`font-bold text-left pl-2 ${cs.chief === 'DİĞER GECİKMELER' ? 'text-slate-400 italic' : 'text-slate-800'}`}>{cs.chief}</td>
                            <td>{cs.count}</td>
                            <td className="font-black text-rose-600">{cs.mins}</td>
                            <td>{cs.count > 0 ? Math.round(cs.mins / cs.count) : '-'}</td>
                            <td className="text-slate-500">{totalMins > 0 ? ((cs.mins / totalMins) * 100).toFixed(1) : '0'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Aylık Amir Detay Kırılımı */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">Amir Bazlı Aylık Kırılım</span>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-[10px] text-center">
                    <thead>
                      <tr>
                        <th className="bg-slate-100 text-slate-700 border-b border-r font-bold px-3 py-2 text-left sticky left-0 z-10">AMİR</th>
                        {MONTH_NAMES.map(m => (
                          <th key={m} className="bg-slate-100 text-slate-600 border-b font-bold px-1 py-2 min-w-[55px]" colSpan={2}>{m}</th>
                        ))}
                        <th className="bg-slate-800 text-white border-b font-bold px-2 py-2" colSpan={2}>TOPLAM</th>
                      </tr>
                      <tr>
                        <th className="bg-slate-50 border-b border-r sticky left-0 z-10"></th>
                        {MONTH_NAMES.map(m => (
                          <React.Fragment key={m + '_sub'}>
                            <th className="bg-slate-50 border-b text-[8px] text-slate-400 font-medium px-1">Adet</th>
                            <th className="bg-slate-50 border-b text-[8px] text-slate-400 font-medium px-1">Dk</th>
                          </React.Fragment>
                        ))}
                        <th className="bg-slate-700 text-white border-b text-[8px] font-medium px-1">Adet</th>
                        <th className="bg-slate-700 text-white border-b text-[8px] font-medium px-1">Dk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chiefStats.filter(cs => cs.chief !== 'DİĞER GECİKMELER').map((cs, idx) => {
                        const detail = chiefMonthlyDetail[cs.chief];
                        if (!detail) return null;
                        return (
                          <tr key={cs.chief} className={`border-b border-slate-100 hover:bg-blue-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                            <td className="font-bold text-left pl-3 pr-2 py-1.5 border-r text-slate-800 whitespace-nowrap sticky left-0 z-10 bg-inherit">{cs.chief}</td>
                            {MONTH_NAMES.map((_, mi) => {
                              const md = detail.months[mi];
                              return (
                                <React.Fragment key={mi}>
                                  <td className={`py-1 ${md.count > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'}`}>{md.count || '-'}</td>
                                  <td className={`py-1 ${md.mins > 0 ? 'text-rose-600 font-bold' : 'text-slate-300'}`}>{md.mins || '-'}</td>
                                </React.Fragment>
                              );
                            })}
                            <td className="py-1 font-black text-slate-900 bg-slate-100">{cs.count}</td>
                            <td className="py-1 font-black text-rose-700 bg-slate-100">{cs.mins}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Her amir için detay kartları */}
              {chiefStats.filter(cs => cs.chief !== 'DİĞER GECİKMELER').map(cs => {
                const detail = chiefMonthlyDetail[cs.chief];
                if (!detail) return null;
                const activeMonths = Object.entries(detail.months).filter(([_, v]) => v.count > 0);
                return (
                  <div key={cs.chief} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-2 flex justify-between items-center">
                      <span className="text-white font-bold text-xs">{cs.chief}</span>
                      <div className="flex gap-3 text-[10px] text-blue-200">
                        <span>{cs.count} gecikme</span>
                        <span className="font-bold text-white">{cs.mins} dk</span>
                        <span>ort. {Math.round(cs.mins / cs.count)} dk</span>
                      </div>
                    </div>
                    <div className="p-3">
                      {activeMonths.length === 0 ? (
                        <div className="text-xs text-slate-400 italic text-center py-2">Bu amir için gecikme kaydı yok</div>
                      ) : (
                        <div className="space-y-2">
                          {activeMonths.map(([mIdx, mData]) => (
                            <div key={mIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-slate-50 px-3 py-1 flex justify-between items-center border-b border-slate-200">
                                <span className="text-[10px] font-bold text-slate-700">{MONTH_NAMES[parseInt(mIdx)]}</span>
                                <div className="flex gap-3 text-[9px] text-slate-500">
                                  <span>{mData.count} uçuş</span>
                                  <span className="font-bold text-rose-600">{mData.mins} dk</span>
                                </div>
                              </div>
                              <table className="w-full text-[9px]">
                                <thead>
                                  <tr className="bg-slate-100/50">
                                    <th className="text-left pl-2 py-1 text-slate-500">TARİH</th>
                                    <th className="text-slate-500 py-1">VARDİYA</th>
                                    <th className="text-slate-500 py-1">UÇUŞ</th>
                                    <th className="text-slate-500 py-1">KALKIŞ</th>
                                    <th className="text-slate-500 py-1">VARIŞ</th>
                                    <th className="text-slate-500 py-1">STD</th>
                                    <th className="text-slate-500 py-1">ATD</th>
                                    <th className="text-slate-500 py-1">KOD</th>
                                    <th className="text-slate-500 py-1">SÜRE</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mData.flights.sort((a, b) => a.date.localeCompare(b.date)).map((f, fi) => (
                                    <tr key={fi} className={`border-t border-slate-100 ${fi % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                                      <td className="pl-2 py-0.5 text-slate-700">{f.date}</td>
                                      <td className="text-center"><span className={`px-1 rounded text-white text-[8px] font-bold ${f.shift === 'EARLY' ? 'bg-amber-500' : f.shift === 'LATE' ? 'bg-cyan-600' : 'bg-indigo-600'}`}>{f.shift.charAt(0)}</span></td>
                                      <td className="text-center font-medium text-slate-800">{f.flight}</td>
                                      <td className="text-center text-slate-600">{f.depPort}</td>
                                      <td className="text-center text-slate-600">{f.arrPort}</td>
                                      <td className="text-center text-slate-500">{f.std}</td>
                                      <td className="text-center text-slate-500">{f.atd}</td>
                                      <td className="text-center"><span className="bg-red-100 text-red-700 px-1 rounded font-bold text-[8px]">{f.delayCode}</span></td>
                                      <td className="text-center font-black text-rose-600">{f.delayTimeVal}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {chiefStats.some(c => c.chief === 'DİĞER GECİKMELER') && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong>{chiefStats.find(c => c.chief === 'DİĞER GECİKMELER')?.count || 0} gecikme</strong> amir eşleştirilemedi. Çalışma programını ve Ayarlar'daki şef isimlerini kontrol edin.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
