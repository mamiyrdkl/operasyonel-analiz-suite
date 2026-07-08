'use client';
import { useState, useMemo, useRef } from 'react';
import { BarChart3, FolderOpen, RefreshCw, FileSpreadsheet, CalendarDays, Users, AlertTriangle, Clock, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { HEADER_ALIASES, findColumnIndex, parseFlightDate, cleanStr, extractDelayColumns, parseDelayTime } from '@/lib/excelParser';
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

// ===================== COMPONENT =====================
export default function YearlyAnalysisTab() {
  const { delayCodes, chiefs } = useSettings();
  const [files, setFiles] = useState<File[]>([]);
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);
  const [chiefSchedule, setChiefSchedule] = useState<ChiefScheduleEntry[]>([]);
  const chiefScheduleRef = useRef<ChiefScheduleEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<YearlyRecord[]>([]);
  const [activeView, setActiveView] = useState<'monthly' | 'shift' | 'code' | 'chief'>('monthly');
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  // ===================== FILE HANDLERS =====================
  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) setFiles(prev => [...prev, ...selected]);
  };

  const handleScheduleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setScheduleFile(f);
      parseSchedule(f);
    }
  };

  // ===================== PARSE SCHEDULE (Pivot Format) =====================
  // Excel formatı: Satırlar = kişiler, Sütunlar = günler (1-31)
  // "Vardiya Sorumlusu" yazan satırlardaki isimler baz alınır
  // Hücrelerde: E=EARLY, L=LATE, N=NIGHT, O=DAY OFF
  const parseSchedule = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
        const allEntries: ChiefScheduleEntry[] = [];
        
        // Ayarlar'daki şef isimleri (büyük harf, normalize)
        const settingsChiefNames = chiefs.map(c => cleanStr(c));
        console.log('[Schedule] Ayarlardaki şefler:', settingsChiefNames);
        console.log('[Schedule] Sayfa sayısı:', wb.SheetNames.length, 'Sayfalar:', wb.SheetNames);

        // Her sayfayı (her ay) ayrı ayrı işle
        wb.SheetNames.forEach((sheetName, sheetIdx) => {
          const rawData: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
          if (!rawData || rawData.length === 0) return;

          // 1) Ay ve yılı tespit et
          let monthYear = detectMonthYear(sheetName, file.name, rawData);
          
          // Fallback: Sayfa sırası ay olarak kullan (0=Ocak, ...)
          if (!monthYear) {
            const currentYear = new Date().getFullYear();
            // Tek sayfalıysa dosya adından ay çıkarmayı dene, yoksa mevcut ayı kullan
            if (wb.SheetNames.length === 1) {
              monthYear = { month: new Date().getMonth(), year: currentYear };
            } else {
              monthYear = { month: sheetIdx % 12, year: currentYear };
            }
            console.log('[Schedule] Ay tespiti yapılamadı, fallback kullanıldı:', MONTH_NAMES[monthYear.month], monthYear.year);
          }
          
          const { month, year } = monthYear;
          console.log(`[Schedule] Sayfa "${sheetName}" → ${MONTH_NAMES[month]} ${year}`);

          // 2) Gün sütunlarını bul (1, 2, 3, ... 31 olan başlık satırı)
          let dayHeaderRowIdx = -1;
          let dayColMap: Record<number, number> = {};

          for (let r = 0; r < Math.min(30, rawData.length); r++) {
            const row = rawData[r];
            if (!row) continue;
            const numericCols: Record<number, number> = {};
            let numCount = 0;
            
            for (let c = 0; c < row.length; c++) {
              const val = Number(row[c]);
              if (!isNaN(val) && val >= 1 && val <= 31 && Number.isInteger(val)) {
                // Ardışık gün numaraları olmalı (1,2,3... sırasında)
                numericCols[val] = c;
                numCount++;
              }
            }
            // 5+ gün numarası yeterli (kısa aylar veya kısmi programlar)
            if (numCount >= 5) {
              dayHeaderRowIdx = r;
              dayColMap = numericCols;
              break;
            }
          }

          console.log(`[Schedule] Gün başlık satırı: ${dayHeaderRowIdx}, Gün sayısı: ${Object.keys(dayColMap).length}`);
          if (dayHeaderRowIdx === -1) return;

          // 3) "Vardiya Sorumlusu" yazan VEYA ayarlardaki şef isimlerinden birini içeren satırları bul
          for (let r = 0; r < rawData.length; r++) {
            const row = rawData[r];
            if (!row) continue;

            const rowTexts = row.map((c: any) => cleanStr(c));
            
            // "Vardiya Sorumlusu" kontrolü
            const hasVS = rowTexts.some((t: string) => 
              t.includes('VARDIYA SORUMLUSU') || t.includes('VARDİYA SORUMLUSU') || 
              t.includes('V.SORUMLUSU') || t.includes('V. SORUMLUSU') ||
              t.includes('VARDIYA SOR') || t.includes('VARDİYA SOR') ||
              t.includes('V.SOR') || t.includes('SHIFT SUPERVISOR')
            );

            // Şef ismi eşleştirme
            let chiefName = '';
            
            // Yöntem 1: Satırda ayarlardaki şef isimlerinden birini ara
            for (let c = 0; c < row.length; c++) {
              const cellVal = cleanStr(row[c]);
              if (cellVal.length < 3) continue;
              
              for (let si = 0; si < settingsChiefNames.length; si++) {
                const sc = settingsChiefNames[si];
                // İsmin parçaları eşleşiyor mu? (SERDAR → "SERDAR ERDOĞAN" satırında bulunur)
                if (cellVal === sc || cellVal.includes(sc) || sc.includes(cellVal)) {
                  chiefName = chiefs[si];
                  break;
                }
                // Soyisim eşleşmesi (en az 4 karakter)
                const nameParts = sc.split(/\s+/);
                const cellParts = cellVal.split(/\s+/);
                for (const cp of cellParts) {
                  if (cp.length >= 4 && nameParts.some(np => np === cp)) {
                    chiefName = chiefs[si];
                    break;
                  }
                }
                if (chiefName) break;
              }
              if (chiefName) break;
            }

            // Yöntem 2: "Vardiya Sorumlusu" metninin devamında isim ara
            if (!chiefName && hasVS) {
              for (let c = 0; c < row.length; c++) {
                const cellVal = cleanStr(row[c]);
                if (cellVal.includes('VARDIYA SORUMLU') || cellVal.includes('VARDİYA SORUMLU') || cellVal.includes('V.SOR')) {
                  // Etiketin devamı
                  const afterLabel = cellVal
                    .replace(/VARD[İI]YA\s*SORUMLUSU/g, '')
                    .replace(/V\.?\s*SORUMLUSU/g, '')
                    .replace(/V\.SOR\.?/g, '')
                    .replace(/SHIFT\s*SUPERVISOR/g, '')
                    .trim();
                  if (afterLabel.length > 3) chiefName = afterLabel;
                  // Sonraki hücre
                  if (!chiefName && c + 1 < row.length) {
                    const nextVal = String(row[c + 1] || '').trim();
                    if (nextVal.length > 3 && !/^[ELNO\d]+$/.test(nextVal)) chiefName = nextVal;
                  }
                  break;
                }
              }
            }

            // Eğer "Vardiya Sorumlusu" yoksa ama şef ismi varsa, E/L/N hücreleri de içeriyorsa kabul et
            if (chiefName && !hasVS) {
              const shiftLetterCount = rowTexts.filter((t: string) => t === 'E' || t === 'L' || t === 'N' || t === 'O').length;
              if (shiftLetterCount < 3) continue; // Yeterli vardiya harfi yoksa bu satır program satırı değil
            }

            // Vardiya Sorumlusu satırı ama isim bulunamadıysa atla
            if (!chiefName) continue;

            console.log(`[Schedule] Satır ${r}: Şef="${chiefName}", VS=${hasVS}`);

            // 4) Her gün sütunundan E/L/N/O harfini oku
            let shiftCount = 0;
            for (const [dayStr, colIdx] of Object.entries(dayColMap)) {
              const dayNum = parseInt(dayStr);
              const rawCellVal = String(row[colIdx] || '').trim().toUpperCase();
              const cellVal = rawCellVal.replace(/\s+/g, '');
              
              let shift = '';
              if (cellVal === 'E') shift = 'EARLY';
              else if (cellVal === 'L') shift = 'LATE';
              else if (cellVal === 'N') shift = 'NIGHT';
              // O, OFF, İ, vs. = Day off / izin, atla
              
              if (shift) {
                const dateObj = new Date(Date.UTC(year, month, dayNum));
                if (dateObj.getUTCMonth() === month && dateObj.getUTCDate() === dayNum) {
                  const dateIso = dateObj.toISOString().split('T')[0];
                  allEntries.push({ date: dateIso, shift, chief: chiefName });
                  shiftCount++;
                }
              }
            }
            console.log(`[Schedule]   → ${shiftCount} vardiya kaydı eklendi`);
          }
        });

        chiefScheduleRef.current = allEntries;
        setChiefSchedule(allEntries);
        console.log(`[Schedule] TOPLAM: ${allEntries.length} kayıt`);
        
        if (allEntries.length > 0) {
          const uniqueChiefs = [...new Set(allEntries.map(e => e.chief))];
          const monthsFound = [...new Set(allEntries.map(e => e.date.substring(0, 7)))].sort();
          alert(`✓ Çalışma programı yüklendi!\n\n${allEntries.length} vardiya kaydı bulundu.\nAmirler: ${uniqueChiefs.join(', ')}\nAylar: ${monthsFound.join(', ')}`);
        } else {
          alert('Çalışma programında eşleşme bulunamadı.\n\nKontrol edin:\n• "Vardiya Sorumlusu" yazıyor mu?\n• Gün numaraları (1-31) sütun başlığı olarak var mı?\n• E/L/N harfleri vardiya hücrelerinde var mı?\n• Ayarlar\'daki şef isimleri doğru mu?\n\nDetay için tarayıcı konsoluna bakın (F12).');
        }
      } catch (err) { 
        console.error('[Schedule] HATA:', err);
        alert('Çalışma programı okunamadı. Hata: ' + (err as Error).message); 
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Ay ve yıl tespiti: Sayfa adı, dosya adı veya içerikten
  const detectMonthYear = (sheetName: string, fileName: string, rawData: any[][]): { month: number; year: number } | null => {
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
      // "OCAK 2026" veya "2026 OCAK" veya "01.2026" gibi
      for (const [name, idx] of Object.entries(turkishMonths)) {
        if (upper.includes(name)) {
          const yearMatch = upper.match(/(20\d{2})/);
          if (yearMatch) return { month: idx, year: parseInt(yearMatch[1]) };
          // Yıl yoksa mevcut yıl
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
    if (result) return result;

    // 2. Dosya adından
    result = tryParse(fileName);
    if (result) return result;

    // 3. İlk 10 satırdan
    for (let r = 0; r < Math.min(10, rawData.length); r++) {
      const row = rawData[r];
      if (!row) continue;
      for (const cell of row) {
        if (cell) {
          result = tryParse(String(cell));
          if (result) return result;
        }
      }
    }

    return null;
  };

  // ===================== FIND CHIEF FROM SCHEDULE =====================
  const findChiefDebugCount = useRef(0);
  const findChief = (dateIso: string, shift: string): string => {
    const schedule = chiefScheduleRef.current;
    if (schedule.length === 0) return '';
    
    // 1. Tam eşleşme: tarih + vardiya
    const exactMatch = schedule.find(e => e.date === dateIso && e.shift === shift);
    if (exactMatch) return exactMatch.chief;
    
    // 2. Gün + vardiya eşleşmesi (ay/yıl farklı olsa bile)
    const day = dateIso.split('-')[2]; // "25" from "2025-05-25"
    const dayShiftMatch = schedule.find(e => e.date.endsWith('-' + day) && e.shift === shift);
    if (dayShiftMatch) return dayShiftMatch.chief;
    
    // 3. Sadece gün eşleşmesi (vardiya da farklıysa)
    const dayOnlyMatch = schedule.find(e => e.date.endsWith('-' + day) && e.shift !== 'OFF');
    if (dayOnlyMatch) {
      // Aynı güne birden fazla vardiya olabilir, ilkini döndür
      return dayOnlyMatch.chief;
    }

    // Debug log (ilk 5 eşleşmeyen)
    if (findChiefDebugCount.current < 5) {
      findChiefDebugCount.current++;
      console.log(`[FindChief] Eşleşmedi: flight_date=${dateIso}, flight_shift=${shift}`);
      console.log(`[FindChief] Schedule sample:`, schedule.slice(0, 5).map(e => `${e.date} | ${e.shift} | ${e.chief}`));
    }
    return '';
  };

  // ===================== PROCESS ALL FILES =====================
  const processAllFiles = async () => {
    if (files.length === 0 || delayCodes.length === 0) {
      alert(delayCodes.length === 0 ? 'Lütfen Ayarlar\'dan gecikme kodlarını tanımlayın!' : 'Lütfen en az 1 dosya yükleyin!');
      return;
    }
    setIsProcessing(true);
    const allRecords: YearlyRecord[] = [];

    for (const file of files) {
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
              const matched = delayCodes.find(c => c.code === code);
              if (matched && time >= 15) {
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
      const ch = d.chief || 'ATANMAMIŞ';
      if (!c[ch]) c[ch] = { chief: ch, count: 0, mins: 0 };
      c[ch].count++; c[ch].mins += d.delayTimeVal;
    });
    return Object.values(c).sort((a, b) => b.mins - a.mins);
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
    labels: chiefStats.filter(c => c.chief !== 'ATANMAMIŞ').map(c => c.chief),
    datasets: [{ data: chiefStats.filter(c => c.chief !== 'ATANMAMIŞ').map(c => c.mins), backgroundColor: CODE_COLORS, borderWidth: 2, borderColor: '#fff' }]
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
      const dr = ws1.addRow([r.date, r.shift, r.chief || 'ATANMAMIŞ', r.flight, r.depPort, r.arrPort, r.std, r.atd, r.delayCode, r.delayTimeVal, r.desc]);
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
        </h2>
        <div className="flex items-center gap-2">
          {/* Schedule Upload */}
          <input type="file" id="scheduleInput" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleScheduleUpload} />
          <label htmlFor="scheduleInput" className={`px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1.5 border shadow-sm ${scheduleFile ? 'bg-green-50 text-green-700 border-green-300' : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'}`}>
            <Users className="w-3.5 h-3.5" /> {scheduleFile ? `✓ ${scheduleFile.name}` : 'Çalışma Programı'}
          </label>

          <div className="h-6 w-px bg-slate-200" />

          {/* File upload */}
          <input type="file" id="yearlyFileInput" accept=".xls,.xlsx,.csv" className="hidden" multiple onChange={handleFilesUpload} />
          <label htmlFor="yearlyFileInput" className="bg-white border text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition shadow-sm flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            {files.length > 0 ? `${files.length} dosya seçili` : 'Excel Dosyaları'}
          </label>

          <button disabled={files.length === 0 || isProcessing} onClick={processAllFiles}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} /> İŞLE
          </button>

          <button disabled={!hasData} onClick={exportYearlyExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> EXCEL
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden p-4 gap-3 bg-slate-50 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center"><RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" /><span className="font-bold text-slate-800 tracking-wider">VERİLER İŞLENİYOR...</span></div>
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
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 h-[300px]">
                  <h3 className="text-[11px] font-bold text-slate-500 tracking-widest mb-2">AMİR DAĞILIMI</h3>
                  <div className="h-[240px]">
                    {chiefStats.filter(c => c.chief !== 'ATANMAMIŞ').length > 0 ? (
                      <Pie data={chiefPieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9 } } } } }} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">Çalışma programı yükleyin</div>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border-2 border-slate-300 overflow-hidden shadow-sm">
                  <div className="bg-slate-100/50 px-3 py-2 border-b border-slate-200"><span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Amir Performans Tablosu</span></div>
                  <div className="overflow-auto max-h-[260px]">
                    <table className="excel-table w-full text-[10px] text-center">
                      <thead className="sticky top-0"><tr>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">AMİR</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">ADET</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">TOPLAM DK</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">ORT. DK</th>
                        <th className="bg-slate-200 text-slate-700 border-b font-bold">%</th>
                      </tr></thead>
                      <tbody>
                        {chiefStats.map((cs, i) => (
                          <tr key={cs.chief} className="hover:bg-slate-50 border-b border-slate-100">
                            <td className={`font-bold text-left pl-2 ${cs.chief === 'ATANMAMIŞ' ? 'text-slate-400 italic' : 'text-slate-800'}`}>{cs.chief}</td>
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
              {chiefStats.some(c => c.chief === 'ATANMAMIŞ') && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 text-xs text-purple-700 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span><strong>İpucu:</strong> Çalışma programı yüklerseniz amirler tarih ve vardiyaya göre otomatik eşleşir. (TARİH / VARDİYA / AMİR sütunları içeren Excel dosyası)</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
