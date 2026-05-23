'use client';

import { useState, useRef, useMemo } from 'react';
import { Upload, Link2, ShieldAlert, AlertTriangle, CheckCircle2, Clock, Plane } from 'lucide-react';

interface RawRow {
  FlightNo?: string;
  Dep?: string;
  Arr?: string;
  STD?: string | number;
  STA?: string | number;
  ATD?: string | number;
  ATA?: string | number;
  MaxFDP?: string | number;
  PlannedFDP?: string | number;
  [key: string]: unknown;
}

interface ConnectionRow {
  id: number;
  airport: string;
  flight1: string;
  flight2: string;
  plannedMin: number;
  actualMin: number;
}

interface FdpRow {
  id: number;
  flight: string;
  maxFdp: number;
  plannedFdp: number;
  remaining: number;
  isRisk: boolean;
}

type TabView = 'connection' | 'fdp';

// Normalize header text for matching
function norm(s: unknown): string {
  return String(s || '').replace(/[\s_\-\.\/]+/g, '').toUpperCase();
}

// Alias map: normalized patterns → canonical key
const HEADER_ALIASES: Record<string, string[]> = {
  FlightNo:   ['FLIGHTNO', 'FLT', 'FLIGHT', 'FLIGHTNUMBER', 'UCUS', 'UCUSNO', 'FLTNO'],
  Dep:        ['DEP', 'DEPARTURE', 'FROM', 'DEPPORT', 'KALKIS', 'ORIGIN', 'DEPARTUREIATA', 'DEPARTUREPORT'],
  Arr:        ['ARR', 'ARRIVAL', 'TO', 'ARRPORT', 'VARIS', 'DEST', 'DESTINATION', 'ARRIVALIATA', 'ARRIVALPORT'],
  STD:        ['STD', 'SCHEDTIMEDEP', 'SCHEDULEDDEPARTURE', 'SCHEDDEP', 'SCHEDULEDTIMEOFDEPARTURE'],
  STA:        ['STA', 'SCHEDTIMEARR', 'SCHEDULEDARRIVAL', 'SCHEDARR', 'SCHEDULEDTIMEOFARRIVAL'],
  ATD:        ['ATD', 'ACTUALTIMEDEP', 'ACTUALDEPARTURE', 'ACTDEP', 'ACTUALTIMEOFDEPARTURE'],
  ATA:        ['ATA', 'ACTUALTIMEARR', 'ACTUALARRIVAL', 'ACTARR', 'ACTUALTIMEOFARRIVAL'],
  MaxFDP:     ['MAXFDP', 'FDPMAX', 'MAXIMUMFDP', 'MAXFLIGHTDUTYPERIOD'],
  PlannedFDP: ['PLANNEDFDP', 'FDPPLANNED', 'PLANFDP', 'PFDP'],
};

function findCol(headerRow: unknown[], aliases: string[]): number {
  for (let i = 0; i < headerRow.length; i++) {
    const n = norm(headerRow[i]);
    if (aliases.includes(n)) return i;
  }
  return -1;
}

function timeToMinutes(timeStr: string | number | undefined): number {
  if (timeStr === undefined || timeStr === null || timeStr === '') return 0;
  // Excel serial format: 0.5 = 12:00
  if (typeof timeStr === 'number') {
    // If > 1, might be minutes already or HHmm like 1430
    if (timeStr > 0 && timeStr < 1) return Math.round(timeStr * 1440);
    if (timeStr >= 100 && timeStr <= 2359) {
      // HHmm format like 1430 → 14*60+30
      const h = Math.floor(timeStr / 100);
      const m = timeStr % 100;
      return h * 60 + m;
    }
    return Math.round((timeStr % 1) * 1440);
  }
  const s = String(timeStr).trim();
  // HH:MM or HH:MM:SS
  const parts = s.split(':');
  if (parts.length >= 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  // Pure numeric string like "1430"
  const num = parseInt(s);
  if (!isNaN(num) && num >= 100 && num <= 2359) {
    return Math.floor(num / 100) * 60 + (num % 100);
  }
  return 0;
}

export default function CrewConnectionTab() {
  const [rawData, setRawData] = useState<RawRow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [activeView, setActiveView] = useState<TabView>('connection');
  const [statusMsg, setStatusMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const connections = useMemo<ConnectionRow[]>(() => {
    const result: ConnectionRow[] = [];
    for (let i = 0; i < rawData.length - 1; i++) {
      if (rawData[i].Arr && rawData[i].Arr === rawData[i + 1].Dep) {
        const pS = timeToMinutes(rawData[i + 1].STD) - timeToMinutes(rawData[i].STA);
        const gS = timeToMinutes(rawData[i + 1].ATD) - timeToMinutes(rawData[i].ATA);
        result.push({
          id: i,
          airport: String(rawData[i].Arr || '-'),
          flight1: String(rawData[i].FlightNo || '-'),
          flight2: String(rawData[i + 1].FlightNo || '-'),
          plannedMin: pS,
          actualMin: gS,
        });
      }
    }
    return result;
  }, [rawData]);

  const fdpRows = useMemo<FdpRow[]>(() => {
    return rawData
      .filter(r => r.MaxFDP || r.PlannedFDP)
      .map((row, i) => {
        const max = parseFloat(String(row.MaxFDP)) || 0;
        const planned = parseFloat(String(row.PlannedFDP)) || 0;
        const remaining = max - planned;
        return {
          id: i,
          flight: String(row.FlightNo || '-'),
          maxFdp: max,
          plannedFdp: planned,
          remaining,
          isRisk: remaining < 60,
        };
      });
  }, [rawData]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setStatusMsg('İşleniyor...');
    try {
      const XLSX = (await import('xlsx')).default;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Find header row (first row with >= 3 recognized columns)
      let headerIdx = -1;
      let colMap: Record<string, number> = {};

      for (let r = 0; r < Math.min(20, allRows.length); r++) {
        const row = allRows[r];
        if (!row || !Array.isArray(row)) continue;
        const tempMap: Record<string, number> = {};
        let matchCount = 0;
        for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
          const idx = findCol(row, aliases);
          if (idx !== -1) {
            tempMap[canonical] = idx;
            matchCount++;
          }
        }
        if (matchCount >= 3 && matchCount > Object.keys(colMap).length) {
          headerIdx = r;
          colMap = tempMap;
        }
      }

      if (headerIdx === -1) {
        setStatusMsg('Başlık satırı bulunamadı! Excel sütunlarını kontrol edin.');
        return;
      }

      // Parse data rows
      const parsed: RawRow[] = [];
      for (let r = headerIdx + 1; r < allRows.length; r++) {
        const row = allRows[r];
        if (!row || !Array.isArray(row)) continue;

        const flight = colMap.FlightNo !== undefined ? row[colMap.FlightNo] : undefined;
        if (!flight) continue; // skip empty rows

        parsed.push({
          FlightNo: String(flight),
          Dep: colMap.Dep !== undefined ? String(row[colMap.Dep] || '') : '',
          Arr: colMap.Arr !== undefined ? String(row[colMap.Arr] || '') : '',
          STD: colMap.STD !== undefined ? row[colMap.STD] as string | number : undefined,
          STA: colMap.STA !== undefined ? row[colMap.STA] as string | number : undefined,
          ATD: colMap.ATD !== undefined ? row[colMap.ATD] as string | number : undefined,
          ATA: colMap.ATA !== undefined ? row[colMap.ATA] as string | number : undefined,
          MaxFDP: colMap.MaxFDP !== undefined ? row[colMap.MaxFDP] as string | number : undefined,
          PlannedFDP: colMap.PlannedFDP !== undefined ? row[colMap.PlannedFDP] as string | number : undefined,
        });
      }

      console.log('Column mapping:', colMap);
      console.log('Parsed rows:', parsed.length, 'Sample:', parsed[0]);

      setRawData(parsed);
      setIsLoaded(true);
      setStatusMsg(`${parsed.length} satır başarıyla işlendi. Eşleşen sütunlar: ${Object.keys(colMap).join(', ')}`);
    } catch (err) {
      console.error('Excel parse error:', err);
      setStatusMsg('Hata: Dosya okunamadı.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

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
            <p className="text-sm text-slate-500">
              Uçuş bağlantı sürelerini ve FDP risk analizini görüntüleyin
            </p>
          </div>

          <div
            className={`upload-box rounded-2xl p-12 text-center transition-all cursor-pointer ${
              isDragging ? 'active border-cyan-500 bg-cyan-50 scale-[1.02]' : 'border-slate-300 hover:border-cyan-400'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? 'text-cyan-500' : 'text-slate-400'}`} />
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {isDragging ? 'Dosyayı bırakın...' : 'Excel dosyanızı sürükleyin veya tıklayın'}
            </p>
            <p className="text-xs text-slate-400">.xlsx, .xls, .csv formatları desteklenir</p>
          </div>

          <div className="mt-8 bg-slate-50 rounded-xl p-5 border border-slate-200 text-left">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">📌 Beklenen Sütunlar</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              {['FlightNo', 'Dep / Arr', 'STD / STA', 'ATD / ATA', 'MaxFDP', 'PlannedFDP'].map(col => (
                <div key={col} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                  <span>{col}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN SCREEN =====
  const connStats = {
    total: connections.length,
    tight: connections.filter(c => c.actualMin < 30).length,
    missed: connections.filter(c => c.actualMin < 0).length,
  };

  const fdpStats = {
    total: fdpRows.length,
    risk: fdpRows.filter(r => r.isRisk).length,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-lg flex items-center justify-center">
              <Link2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Ekip Bağlantı Takip</h1>
              <p className="text-[10px] text-slate-400">{fileName} • {rawData.length} satır yüklendi</p>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 ml-4">
            <button
              onClick={() => setActiveView('connection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'connection' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" /> Bağlantı Analizi
            </button>
            <button
              onClick={() => setActiveView('fdp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'fdp' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> FDP Risk Analizi
            </button>
          </div>
        </div>

        <button
          onClick={() => { setIsLoaded(false); setRawData([]); setFileName(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Yeni Dosya
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-auto custom-scroll p-6">
        {/* ===== CONNECTION VIEW ===== */}
        {activeView === 'connection' && (
          <div className="space-y-4">
            {/* KPI */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center"><Link2 className="w-5 h-5 text-cyan-600" /></div>
                  <span className="text-xs text-slate-500 font-medium">Toplam Bağlantı</span>
                </div>
                <div className="text-3xl font-black text-slate-800">{connStats.total}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
                  <span className="text-xs text-slate-500 font-medium">Sıkı Bağlantı (&lt;30dk)</span>
                </div>
                <div className="text-3xl font-black text-amber-600">{connStats.tight}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                  <span className="text-xs text-slate-500 font-medium">Kaçırılan Bağlantı</span>
                </div>
                <div className="text-3xl font-black text-red-600">{connStats.missed}</div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-auto custom-scroll max-h-[calc(100vh-340px)]">
                <table className="excel-table w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="pg-th-analysis text-center">Bağlantı Noktası</th>
                      <th className="pg-th-analysis text-center">Uçuş 1</th>
                      <th className="pg-th-analysis text-center">Uçuş 2</th>
                      <th className="pg-th-analysis text-center">Planlanan (dk)</th>
                      <th className="pg-th-analysis text-center">Gerçekleşen (dk)</th>
                      <th className="pg-th-analysis text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-sm text-slate-400">
                        <Plane className="w-8 h-8 mx-auto mb-2 text-slate-300" />Bağlantı bulunamadı
                      </td></tr>
                    ) : connections.map(c => {
                      const isMissed = c.actualMin < 0;
                      const isTight = c.actualMin >= 0 && c.actualMin < 30;
                      return (
                        <tr key={c.id} className={isMissed ? 'bg-red-50' : isTight ? 'bg-amber-50' : ''}>
                          <td className="font-bold text-slate-800 text-xs text-center">{c.airport}</td>
                          <td className="font-mono text-xs text-center">{c.flight1}</td>
                          <td className="font-mono text-xs text-center">{c.flight2}</td>
                          <td className="text-xs text-center font-medium">{c.plannedMin} dk</td>
                          <td className="text-xs text-center font-bold">{c.actualMin} dk</td>
                          <td className="text-center">
                            {isMissed ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">KAÇIRILDI</span>
                            ) : isTight ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">SIKI</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">NORMAL</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== FDP VIEW ===== */}
        {activeView === 'fdp' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                  <span className="text-xs text-slate-500 font-medium">Toplam Kayıt</span>
                </div>
                <div className="text-3xl font-black text-slate-800">{fdpStats.total}</div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
                  <span className="text-xs text-slate-500 font-medium">Riskli FDP (&lt;60dk kalan)</span>
                </div>
                <div className="text-3xl font-black text-red-600">{fdpStats.risk}</div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-auto custom-scroll max-h-[calc(100vh-340px)]">
                <table className="excel-table w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="pg-th-analysis text-center">Ekip ID / Uçuş</th>
                      <th className="pg-th-analysis text-center">Max FDP (dk)</th>
                      <th className="pg-th-analysis text-center">Planlanan FDP (dk)</th>
                      <th className="pg-th-analysis text-center">Kalan Süre (dk)</th>
                      <th className="pg-th-analysis text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fdpRows.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-sm text-slate-400">
                        <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-slate-300" />FDP verisi bulunamadı
                      </td></tr>
                    ) : fdpRows.map(r => (
                      <tr key={r.id} className={r.isRisk ? 'bg-red-50' : ''}>
                        <td className="font-mono text-xs text-center font-bold">{r.flight}</td>
                        <td className="text-xs text-center">{r.maxFdp}</td>
                        <td className="text-xs text-center">{r.plannedFdp}</td>
                        <td className="text-xs text-center font-black">{r.remaining}</td>
                        <td className="text-center">
                          {r.isRisk ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">RİSKLİ</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">GÜVENLİ</span>
                          )}
                        </td>
                      </tr>
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
