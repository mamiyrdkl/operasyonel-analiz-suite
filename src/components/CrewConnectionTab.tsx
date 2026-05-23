'use client';
import { useState, useRef, useMemo } from 'react';
import { Upload, Link2, ShieldAlert, AlertTriangle, CheckCircle2, Clock, Plane, Timer } from 'lucide-react';

type TabView = 'connection' | 'fdp' | 'mesai';

/* ── Generic row from Excel ── */
interface GRow { [key: string]: unknown; }

/* ── Normalize a header string for fuzzy matching ── */
function norm(s: unknown): string {
  return String(s ?? '').replace(/[\s_\-\.\/\(\)]+/g, '').toUpperCase();
}

/* ── Try to find a column index by fuzzy-matching a set of aliases ── */
function findCol(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const n = norm(headers[i]);
    for (const a of aliases) { if (n === a || n.includes(a)) return i; }
  }
  return -1;
}

/* ── Convert ANY time representation to minutes ── */
function timeToMin(v: unknown): number {
  if (v === undefined || v === null || v === '') return NaN;
  if (typeof v === 'number') {
    if (v > 0 && v < 1) return Math.round(v * 1440);          // Excel serial
    if (v >= 100 && v <= 2359) return Math.floor(v/100)*60 + v%100; // HHmm
    if (v > 2359) return Math.round((v % 1) * 1440);           // date+time serial
    return v; // already minutes?
  }
  const s = String(v).trim();
  const parts = s.split(':');
  if (parts.length >= 2) return parseInt(parts[0])*60 + parseInt(parts[1]);
  const num = parseInt(s);
  if (!isNaN(num) && num >= 100 && num <= 2359) return Math.floor(num/100)*60 + num%100;
  return NaN;
}

/* ── Column alias definitions ── */
const ALIASES: Record<string, string[]> = {
  flight:  ['FLIGHTNO','FLT','FLIGHT','FLIGHTNUMBER','UCUS','UCUSNO','FLTNO','FLTNUMBER','SEFER'],
  dep:     ['DEP','DEPARTURE','FROM','DEPPORT','KALKIS','ORIGIN','DEPARTUREPORT','DEPARTUREIATA'],
  arr:     ['ARR','ARRIVAL','TO','ARRPORT','VARIS','DEST','DESTINATION','ARRIVALPORT','ARRIVALIATA'],
  std:     ['STD','SCHEDTIMEDEP','SCHEDULEDDEPARTURE','SCHEDDEP','PLANKALKS','PLANKALKIS'],
  sta:     ['STA','SCHEDTIMEARR','SCHEDULEDARRIVAL','SCHEDARR','PLANVARIS'],
  atd:     ['ATD','ACTUALTIMEDEP','ACTUALDEPARTURE','ACTDEP','GERCEKKALKS','GERCEKKALKIS'],
  ata:     ['ATA','ACTUALTIMEARR','ACTUALARRIVAL','ACTARR','GERCEKVARIS'],
  maxfdp:  ['MAXFDP','FDPMAX','MAXIMUMFDP','MAXFLIGHTDUTYPERIOD'],
  planfdp: ['PLANNEDFDP','FDPPLANNED','PLANFDP','PFDP'],
  duty:    ['DUTYTIME','DUTY','MESAI','GOREV','WORKHOURS','DUTYPERIOD','GOREVS'],
  crew:    ['CREWID','CREW','EKIPID','EKIP','CREWNAME','EKIPAD','PILOTID','NAME','ISIM','PERSONEL'],
  report:  ['REPORTTIME','REPORT','REPORTIN','CHECKIN','GIRIS','BASLANGIC'],
  debrief: ['DEBRIEFING','DEBRIEF','CHECKOUT','CIKIS','BITIS','RELEASETIIME','RELEASE'],
};

export default function CrewConnectionTab() {
  const [allRows, setAllRows] = useState<unknown[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<Record<string, number>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [activeView, setActiveView] = useState<TabView>('connection');
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Helper to get cell value ── */
  const cell = (rowIdx: number, key: string): unknown => {
    const ci = colMap[key];
    if (ci === undefined || !allRows[rowIdx]) return undefined;
    return allRows[rowIdx][ci];
  };
  const cellStr = (ri: number, k: string) => String(cell(ri,k) ?? '').trim();

  /* ── Connection Analysis ── */
  const connections = useMemo(() => {
    if (colMap.arr === undefined || colMap.dep === undefined) return [];
    const result: {id:number; airport:string; f1:string; f2:string; plan:number; actual:number}[] = [];
    for (let i = 0; i < allRows.length - 1; i++) {
      const arrVal = cellStr(i, 'arr');
      const depVal = cellStr(i+1, 'dep');
      if (arrVal && arrVal === depVal) {
        const plan = timeToMin(cell(i+1,'std')) - timeToMin(cell(i,'sta'));
        const actual = timeToMin(cell(i+1,'atd')) - timeToMin(cell(i,'ata'));
        result.push({
          id: i, airport: arrVal,
          f1: cellStr(i,'flight') || '-', f2: cellStr(i+1,'flight') || '-',
          plan: isNaN(plan)?0:plan, actual: isNaN(actual)?0:actual,
        });
      }
    }
    return result;
  }, [allRows, colMap]);

  /* ── FDP Risk ── */
  const fdpRows = useMemo(() => {
    if (colMap.maxfdp === undefined && colMap.planfdp === undefined) return [];
    return allRows.filter((_,i) => {
      const m = parseFloat(String(cell(i,'maxfdp'))); 
      const p = parseFloat(String(cell(i,'planfdp')));
      return !isNaN(m) || !isNaN(p);
    }).map((_,idx) => {
      const m = parseFloat(String(cell(idx,'maxfdp'))) || 0;
      const p = parseFloat(String(cell(idx,'planfdp'))) || 0;
      return { id:idx, flight:cellStr(idx,'flight')||'-', max:m, planned:p, rem:m-p, risk:m-p<60 };
    });
  }, [allRows, colMap]);

  /* ── Mesai (Duty/Work Hours) Analysis ── */
  const mesaiRows = useMemo(() => {
    // Try to calculate duty from report→debrief, or use explicit duty column
    const hasDuty = colMap.duty !== undefined;
    const hasReport = colMap.report !== undefined && colMap.debrief !== undefined;
    if (!hasDuty && !hasReport) return [];
    
    return allRows.map((_, i) => {
      const crew = cellStr(i, 'crew') || cellStr(i, 'flight') || `Satır ${i+1}`;
      const flight = cellStr(i, 'flight') || '-';
      let dutyMin = 0;
      
      if (hasDuty) {
        const raw = cell(i, 'duty');
        const parsed = timeToMin(raw);
        dutyMin = isNaN(parsed) ? (parseFloat(String(raw))||0) : parsed;
      } else if (hasReport) {
        const rpt = timeToMin(cell(i, 'report'));
        const dbr = timeToMin(cell(i, 'debrief'));
        dutyMin = (!isNaN(rpt) && !isNaN(dbr)) ? dbr - rpt : 0;
        if (dutyMin < 0) dutyMin += 1440; // midnight crossing
      }
      
      const hours = Math.floor(dutyMin / 60);
      const mins = Math.round(dutyMin % 60);
      const isLong = dutyMin > 720; // >12 saat
      
      return { id:i, crew, flight, dutyMin, display:`${hours}s ${mins}dk`, isLong };
    }).filter(r => r.dutyMin > 0);
  }, [allRows, colMap]);

  /* ── Excel file handler — reads ANY Excel ── */
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatusMsg('İşleniyor...');
    try {
      const XLSX = (await import('xlsx')).default;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Find header row: scan first 30 rows, pick the one with most alias matches
      let bestRow = 0, bestMap: Record<string,number> = {}, bestScore = 0;
      for (let r = 0; r < Math.min(30, raw.length); r++) {
        const row = raw[r];
        if (!row || !Array.isArray(row) || row.length < 2) continue;
        const hdr = row.map(c => String(c ?? ''));
        const tempMap: Record<string,number> = {};
        let score = 0;
        for (const [key, aliases] of Object.entries(ALIASES)) {
          const idx = findCol(hdr, aliases);
          if (idx !== -1) { tempMap[key] = idx; score++; }
        }
        if (score > bestScore) { bestScore = score; bestRow = r; bestMap = tempMap; }
      }

      // Even if no aliases matched, use row 0 as header and show raw data
      const headerRowIdx = bestScore >= 1 ? bestRow : 0;
      const hdrRow = (raw[headerRowIdx] || []).map(c => String(c ?? ''));
      const dataRows = raw.slice(headerRowIdx + 1).filter(r => Array.isArray(r) && r.some(c => c !== ''));

      setHeaders(hdrRow);
      setColMap(bestMap);
      setAllRows(dataRows);
      setIsLoaded(true);

      const matched = Object.keys(bestMap);
      setStatusMsg(`${dataRows.length} satır okundu. Eşleşen: ${matched.length > 0 ? matched.join(', ') : 'Otomatik eşleşme yok — ham veri gösteriliyor'}`);
    } catch (err) {
      console.error(err);
      setStatusMsg('Hata: Dosya okunamadı. ' + String(err));
    }
  };

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); };

  // ===== UPLOAD SCREEN =====
  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto custom-scroll">
        <div className="text-center max-w-lg w-full">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-600/30 mb-6">
              <Link2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Ekip Bağlantı Takip</h2>
            <p className="text-sm text-slate-500">Bağlantı analizi, FDP risk ve mesai takibi</p>
          </div>
          <div
            className={`upload-box rounded-2xl p-12 text-center transition-all cursor-pointer ${isDragging ? 'active border-cyan-500 bg-cyan-50 scale-[1.02]' : 'border-slate-300 hover:border-cyan-400'}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); }} />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-cyan-500' : 'text-slate-400'}`} />
            <p className="text-sm font-semibold text-slate-700 mb-1">{isDragging ? 'Dosyayı bırakın...' : 'Excel dosyanızı sürükleyin veya tıklayın'}</p>
            <p className="text-xs text-slate-400">Her türlü Excel formatı desteklenir</p>
          </div>
          {statusMsg && <p className="mt-4 text-sm text-red-500 font-medium">{statusMsg}</p>}
        </div>
      </div>
    );
  }

  // ===== STATS =====
  const connStats = { total: connections.length, tight: connections.filter(c=>c.actual<30&&c.actual>=0).length, missed: connections.filter(c=>c.actual<0).length };
  const fdpStats = { total: fdpRows.length, risk: fdpRows.filter(r=>r.risk).length };
  const mesaiStats = { total: mesaiRows.length, long: mesaiRows.filter(r=>r.isLong).length };

  // ===== MAIN SCREEN =====
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Ekip Bağlantı Takip</h1>
              <p className="text-[10px] text-slate-400">{fileName} • {allRows.length} satır</p>
            </div>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-0.5 ml-4">
            {([['connection','Bağlantı',Link2],['fdp','FDP Risk',ShieldAlert],['mesai','Mesai',Timer]] as const).map(([key,label,Icon]) => (
              <button key={key} onClick={()=>setActiveView(key as TabView)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeView===key?'bg-white text-cyan-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={()=>{setIsLoaded(false);setAllRows([]);setFileName('');setStatusMsg('');}} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
          <Upload className="w-3.5 h-3.5" /> Yeni Dosya
        </button>
      </div>

      {/* STATUS */}
      {statusMsg && <div className="bg-blue-50 border-b border-blue-200 px-6 py-1.5 text-xs text-blue-700">{statusMsg}</div>}

      {/* CONTENT */}
      <div className="flex-1 overflow-auto custom-scroll p-6">
        {/* ===== CONNECTION ===== */}
        {activeView === 'connection' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <KPI icon={Link2} color="cyan" label="Toplam Bağlantı" value={connStats.total} />
              <KPI icon={Clock} color="amber" label="Sıkı (<30dk)" value={connStats.tight} />
              <KPI icon={AlertTriangle} color="red" label="Kaçırılan" value={connStats.missed} />
            </div>
            {connections.length === 0 ? (
              <EmptyState icon={Plane} msg="Bağlantı verisi bulunamadı. Excel'de Dep/Arr sütunları olmalı." />
            ) : (
              <DataTable headers={['Bağlantı','Uçuş 1','Uçuş 2','Planlanan','Gerçekleşen','Durum']}
                rows={connections.map(c => {
                  const missed = c.actual<0, tight = c.actual>=0&&c.actual<30;
                  return { key:c.id, cls: missed?'bg-red-50':tight?'bg-amber-50':'',
                    cells: [c.airport, c.f1, c.f2, `${c.plan} dk`, `${c.actual} dk`,
                      <Badge key="s" type={missed?'red':tight?'amber':'green'} text={missed?'KAÇIRILDI':tight?'SIKI':'NORMAL'} />
                  ]};
                })} />
            )}
          </div>
        )}

        {/* ===== FDP ===== */}
        {activeView === 'fdp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <KPI icon={CheckCircle2} color="emerald" label="Toplam Kayıt" value={fdpStats.total} />
              <KPI icon={ShieldAlert} color="red" label="Riskli FDP (<60dk)" value={fdpStats.risk} />
            </div>
            {fdpRows.length === 0 ? (
              <EmptyState icon={ShieldAlert} msg="FDP verisi bulunamadı. Excel'de MaxFDP/PlannedFDP sütunları olmalı." />
            ) : (
              <DataTable headers={['Uçuş','Max FDP','Planlanan','Kalan','Durum']}
                rows={fdpRows.map(r => ({
                  key:r.id, cls:r.risk?'bg-red-50':'',
                  cells: [r.flight, `${r.max}`, `${r.planned}`, `${r.rem} dk`,
                    <Badge key="s" type={r.risk?'red':'green'} text={r.risk?'RİSKLİ':'GÜVENLİ'} />
                ]}))} />
            )}
          </div>
        )}

        {/* ===== MESAİ ===== */}
        {activeView === 'mesai' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <KPI icon={Timer} color="cyan" label="Toplam Kayıt" value={mesaiStats.total} />
              <KPI icon={AlertTriangle} color="red" label="Uzun Mesai (>12s)" value={mesaiStats.long} />
            </div>
            {mesaiRows.length === 0 ? (
              <EmptyState icon={Timer} msg="Mesai verisi bulunamadı. Excel'de DutyTime/Report/Debrief sütunları olmalı." />
            ) : (
              <DataTable headers={['Ekip/Personel','Uçuş','Mesai Süresi','Durum']}
                rows={mesaiRows.map(r => ({
                  key:r.id, cls:r.isLong?'bg-red-50':'',
                  cells: [r.crew, r.flight, r.display,
                    <Badge key="s" type={r.isLong?'red':'green'} text={r.isLong?'UZUN MESAİ':'NORMAL'} />
                ]}))} />
            )}
          </div>
        )}

        {/* ===== RAW DATA FALLBACK ===== */}
        {connections.length===0 && fdpRows.length===0 && mesaiRows.length===0 && allRows.length>0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3">📊 Ham Veri ({allRows.length} satır)</h3>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-auto custom-scroll max-h-[calc(100vh-300px)]">
                <table className="excel-table w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr>{headers.map((h,i) => <th key={i} className="pg-th-analysis text-center">{h||`Col ${i+1}`}</th>)}</tr>
                  </thead>
                  <tbody>
                    {allRows.slice(0,500).map((row,ri) => (
                      <tr key={ri}>{headers.map((_,ci) => <td key={ci} className="text-xs text-center">{String((row as unknown[])[ci] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Reusable sub-components ── */
function KPI({icon:Icon,color,label,value}:{icon:React.ElementType;color:string;label:string;value:number}) {
  const colors: Record<string,string> = {cyan:'bg-cyan-100 text-cyan-600',amber:'bg-amber-100 text-amber-600',red:'bg-red-100 text-red-600',emerald:'bg-emerald-100 text-emerald-600'};
  const valColors: Record<string,string> = {cyan:'text-slate-800',amber:'text-amber-600',red:'text-red-600',emerald:'text-slate-800'};
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]||colors.cyan}`}><Icon className="w-5 h-5" /></div>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className={`text-3xl font-black ${valColors[color]||'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function Badge({type,text}:{type:'red'|'amber'|'green';text:string}) {
  const cls = type==='red'?'bg-red-100 text-red-700':type==='amber'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700';
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cls}`}>{text}</span>;
}

function EmptyState({icon:Icon,msg}:{icon:React.ElementType;msg:string}) {
  return <div className="bg-white rounded-xl border border-slate-200 p-12 text-center"><Icon className="w-8 h-8 mx-auto mb-2 text-slate-300" /><p className="text-sm text-slate-400">{msg}</p></div>;
}

function DataTable({headers,rows}:{headers:string[];rows:{key:number;cls:string;cells:React.ReactNode[]}[]}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-auto custom-scroll max-h-[calc(100vh-340px)]">
        <table className="excel-table w-full">
          <thead className="sticky top-0 z-10"><tr>{headers.map(h=><th key={h} className="pg-th-analysis text-center">{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=><tr key={r.key} className={r.cls}>{r.cells.map((c,i)=><td key={i} className="text-xs text-center font-medium">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
