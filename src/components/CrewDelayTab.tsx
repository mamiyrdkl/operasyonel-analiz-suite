'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import {
  FlightRecord,
  ShiftSummary,
  OverallStats,
  getShift,
  isCrewDelayCode,
  calculateDelayMinutes,
  calculateOverallStats,
  calculateShiftSummaries,
  matchColumn,
  getDelayCodeColor,
  CREW_DELAY_CODE_DESCRIPTIONS,
  getShiftLabel,
  getShiftTimeRange,
} from '@/lib/crewDelayUtils';
import { exportCrewDelayWithLogo } from '@/lib/excelExport';
import {
  Upload,
  Plane,
  Clock,
  Users,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  Filter,
  Download,
  UserCog,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  FileSpreadsheet,
  Timer,
  Activity,
} from 'lucide-react';

// ========== TYPE DEFINITIONS ==========
type TabView = 'dashboard' | 'table' | 'shifts';
type ShiftFilter = 'ALL' | 'EARLY' | 'LATE' | 'NIGHT';

interface ColumnMapping {
  [excelCol: string]: string | null; // mapped field name
}

export default function CrewDelayTab() {
  // ========== STATE ==========
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [activeView, setActiveView] = useState<TabView>('dashboard');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [supervisors, setSupervisors] = useState<Record<string, string>>({
    EARLY: '',
    LATE: '',
    NIGHT: '',
  });
  const [editingSupervisor, setEditingSupervisor] = useState<string | null>(null);
  const [showColumnMapper, setShowColumnMapper] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [expandedDelayCode, setExpandedDelayCode] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========== COMPUTED DATA ==========
  const crewDelayFlights = useMemo(() => {
    return flights.filter(f => f.isCrewDelay && f.delayMinutes >= 15);
  }, [flights]);

  const filteredFlights = useMemo(() => {
    let result = crewDelayFlights;

    if (shiftFilter !== 'ALL') {
      result = result.filter(f => f.shift === shiftFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(f =>
        f.flightNumber.toLowerCase().includes(term) ||
        f.departureAirport.toLowerCase().includes(term) ||
        f.arrivalAirport.toLowerCase().includes(term) ||
        f.delayCode.toLowerCase().includes(term) ||
        f.delayDescription.toLowerCase().includes(term) ||
        f.registration.toLowerCase().includes(term)
      );
    }

    if (sortColumn) {
      const getFieldValue = (record: FlightRecord, field: string): string | number => {
        switch (field) {
          case 'flightNumber': return record.flightNumber;
          case 'date': return record.date;
          case 'departureAirport': return record.departureAirport;
          case 'arrivalAirport': return record.arrivalAirport;
          case 'std': return record.std;
          case 'atd': return record.atd;
          case 'delayMinutes': return record.delayMinutes;
          case 'delayCode': return record.delayCode;
          case 'delayDescription': return record.delayDescription;
          case 'shift': return record.shift;
          case 'crewComment': return record.crewComment;
          default: return '';
        }
      };
      result = [...result].sort((a, b) => {
        const aVal = getFieldValue(a, sortColumn);
        const bVal = getFieldValue(b, sortColumn);
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal || '');
        const bStr = String(bVal || '');
        return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [crewDelayFlights, shiftFilter, searchTerm, sortColumn, sortDirection]);

  const overallStats: OverallStats = useMemo(() => calculateOverallStats(flights), [flights]);

  const shiftSummaries: ShiftSummary[] = useMemo(
    () => calculateShiftSummaries(flights, supervisors),
    [flights, supervisors]
  );

  // Delay code breakdown
  const delayCodeBreakdown = useMemo(() => {
    const map: Record<string, { count: number; totalMinutes: number; flights: FlightRecord[] }> = {};
    crewDelayFlights.forEach(f => {
      const code = f.delayCode || 'N/A';
      if (!map[code]) map[code] = { count: 0, totalMinutes: 0, flights: [] };
      map[code].count++;
      map[code].totalMinutes += f.delayMinutes;
      map[code].flights.push(f);
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [crewDelayFlights]);

  // ========== HANDLERS ==========
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  const handleCommentChange = useCallback((id: number, comment: string) => {
    setFlights(prev => prev.map(f => (f.id === id ? { ...f, crewComment: comment } : f)));
  }, []);

  const handleSupervisorSave = (shift: string, value: string) => {
    setSupervisors(prev => ({ ...prev, [shift]: value }));
    setEditingSupervisor(null);
  };

  // ========== FILE HANDLING ==========
  const handleFile = async (file: File) => {
    setFileName(file.name);

    // Dynamic import xlsx
    const XLSX = (await import('xlsx')).default;
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    if (jsonData.length < 2) return;

    const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
    const rows = jsonData.slice(1).filter((row: string[]) => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''));

    // Auto-map columns
    const autoMapping: ColumnMapping = {};
    headers.forEach(h => {
      const match = matchColumn(h);
      if (match) autoMapping[h] = match;
    });

    setExcelHeaders(headers);
    setExcelRows(rows as string[][]);
    setColumnMapping(autoMapping);

    // Check if we have enough auto-mapped columns
    const mappedFields = new Set(Object.values(autoMapping).filter(Boolean));
    const requiredFields = ['flightNumber', 'delayCode'];
    const hasRequired = requiredFields.every(f => mappedFields.has(f));

    if (hasRequired) {
      processData(headers, rows as string[][], autoMapping);
    } else {
      setShowColumnMapper(true);
    }
  };

  const processData = (headers: string[], rows: string[][], mapping: ColumnMapping) => {
    const getFieldValue = (row: string[], field: string): string => {
      const colIndex = headers.findIndex(h => mapping[h] === field);
      if (colIndex === -1) return '';
      return String(row[colIndex] || '').trim();
    };

    const processed: FlightRecord[] = rows.map((row, idx) => {
      const delayCode = getFieldValue(row, 'delayCode');
      const std = getFieldValue(row, 'std');
      const atd = getFieldValue(row, 'atd');

      let delayMin = 0;
      const rawDelay = getFieldValue(row, 'delayMinutes');
      if (rawDelay) {
        delayMin = parseInt(rawDelay, 10) || 0;
      } else if (std && atd) {
        delayMin = calculateDelayMinutes(std, atd);
      }

      // Tarihi formatla
      let dateStr = getFieldValue(row, 'date');
      if (dateStr) {
        // Excel serial number kontrolü
        const num = Number(dateStr);
        if (!isNaN(num) && num > 40000 && num < 60000) {
          const excelDate = new Date((num - 25569) * 86400 * 1000);
          dateStr = excelDate.toISOString().split('T')[0];
        }
      }

      const isCrewDelay = isCrewDelayCode(delayCode);
      const shift = getShift(std || atd);

      return {
        id: idx + 1,
        flightNumber: getFieldValue(row, 'flightNumber'),
        date: dateStr,
        departureAirport: getFieldValue(row, 'departureAirport'),
        arrivalAirport: getFieldValue(row, 'arrivalAirport'),
        std,
        atd,
        delayMinutes: delayMin,
        delayCode,
        delaySubcode: getFieldValue(row, 'delaySubcode'),
        delayDescription: getFieldValue(row, 'delayDescription'),
        isCrewDelay,
        shift,
        shiftSupervisor: '',
        crewComment: '',
        acType: getFieldValue(row, 'acType'),
        registration: getFieldValue(row, 'registration'),
      };
    });

    setFlights(processed);
    setIsLoaded(true);
    setShowColumnMapper(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ========== EXPORT ==========
  const handleExport = async () => {
    await exportCrewDelayWithLogo(filteredFlights, supervisors);
  };

  // ========== RENDER HELPERS ==========
  const StatCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    color,
    trend,
  }: {
    icon: React.ElementType;
    title: string;
    value: string | number;
    subtitle?: string;
    color: string;
    trend?: 'up' | 'down' | 'neutral';
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${color} opacity-5 -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
        {trend && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            trend === 'down' ? 'bg-green-100 text-green-700' : trend === 'up' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {trend === 'down' ? '↓ İyi' : trend === 'up' ? '↑ Dikkat' : '—'}
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
      <div className="text-xs text-slate-500 font-medium mt-1">{title}</div>
      {subtitle && <div className="text-[10px] text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
  );

  // ========== UPLOAD SCREEN ==========
  if (!isLoaded) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-auto custom-scroll">
        {/* Column Mapper Modal */}
        {showColumnMapper && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800">📋 Sütun Eşleştirme</h3>
                <button onClick={() => setShowColumnMapper(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Excel dosyanızdaki sütunları doğru alanlarla eşleştirin. Zorunlu alanlar <span className="text-red-500">*</span> ile işaretlidir.
              </p>
              <div className="space-y-3">
                {excelHeaders.map(header => (
                  <div key={header} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-700 w-40 truncate" title={header}>
                      {header}
                    </span>
                    <span className="text-slate-300">→</span>
                    <select
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      value={columnMapping[header] || ''}
                      onChange={e => setColumnMapping(prev => ({ ...prev, [header]: e.target.value || null }))}
                    >
                      <option value="">— Eşleştirilmedi —</option>
                      <option value="flightNumber">Uçuş Numarası *</option>
                      <option value="date">Tarih</option>
                      <option value="departureAirport">Kalkış Havalimanı</option>
                      <option value="arrivalAirport">Varış Havalimanı</option>
                      <option value="std">STD (Planlanan Kalkış UTC)</option>
                      <option value="atd">ATD (Gerçek Kalkış UTC)</option>
                      <option value="delayMinutes">Gecikme (Dakika)</option>
                      <option value="delayCode">Gecikme Kodu *</option>
                      <option value="delaySubcode">Gecikme Alt Kodu</option>
                      <option value="delayDescription">Gecikme Açıklaması</option>
                      <option value="acType">Uçak Tipi</option>
                      <option value="registration">Uçak Tescil</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowColumnMapper(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={() => processData(excelHeaders, excelRows, columnMapping)}
                  className="px-6 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg shadow-red-600/25"
                >
                  Verileri Yükle
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="text-center max-w-lg w-full">
          <div className="mb-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center shadow-xl shadow-red-600/30 mb-6">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Ekip Gecikme Analizi</h2>
            <p className="text-sm text-slate-500">
              Uçuş gecikme verilerinizi yükleyin, ekip kaynaklı gecikmeleri analiz edin
            </p>
          </div>

          <div
            className={`upload-box rounded-2xl p-12 text-center transition-all cursor-pointer ${
              isDragging ? 'active border-red-500 bg-red-50 scale-[1.02]' : 'border-slate-300 hover:border-red-400'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? 'text-red-500' : 'text-slate-400'}`} />
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {isDragging ? 'Dosyayı bırakın...' : 'Excel dosyanızı sürükleyin veya tıklayın'}
            </p>
            <p className="text-xs text-slate-400">.xlsx, .xls, .csv formatları desteklenir</p>
          </div>

          <div className="mt-8 bg-slate-50 rounded-xl p-5 border border-slate-200 text-left">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              📌 Beklenen Excel Sütunları
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span>Uçuş Numarası <span className="text-red-400">*</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                <span>Gecikme Kodu <span className="text-red-400">*</span></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                <span>STD / ATD (UTC)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                <span>Gecikme Süresi (dk)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                <span>Tarih</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                <span>Kalkış / Varış Havalimanı</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              * Zorunlu alanlar. Sütun isimleri otomatik eşleştirilir, eşleşmezse manuel seçim yapabilirsiniz.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========== MAIN ANALYSIS SCREEN ==========
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* HEADER BAR */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800">Ekip Gecikme Analizi</h1>
              <p className="text-[10px] text-slate-400">{fileName} • {flights.length} uçuş yüklendi</p>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 ml-4">
            {([
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'table', label: 'Gecikme Tablosu', icon: FileSpreadsheet },
              { key: 'shifts', label: 'Vardiya Analizi', icon: Clock },
            ] as { key: TabView; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeView === tab.key
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Raporu İndir
          </button>
          <button
            onClick={() => { setIsLoaded(false); setFlights([]); setFileName(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Yeni Dosya
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-auto custom-scroll p-6">
        {/* ===== DASHBOARD VIEW ===== */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Activity}
                title="OTP (On-Time Performance)"
                value={`%${overallStats.otp.toFixed(1)}`}
                subtitle={`${flights.filter(f => f.delayMinutes < 15).length} / ${overallStats.totalFlights} uçuş zamanında`}
                color="bg-emerald-500"
                trend={overallStats.otp >= 80 ? 'down' : 'up'}
              />
              <StatCard
                icon={Users}
                title="Ekip Kaynaklı Gecikme"
                value={overallStats.crewDelayedFlights}
                subtitle={`Toplam ${overallStats.totalDelayedFlights} gecikmeden`}
                color="bg-red-500"
                trend={overallStats.crewDelayPercentage > 10 ? 'up' : 'down'}
              />
              <StatCard
                icon={TrendingDown}
                title="Ekip Gecikme Oranı"
                value={`%${overallStats.crewDelayPercentage.toFixed(1)}`}
                subtitle="Genel gecikmelere etkisi"
                color="bg-amber-500"
                trend={overallStats.crewDelayPercentage > 15 ? 'up' : 'neutral'}
              />
              <StatCard
                icon={Timer}
                title="Ort. Ekip Gecikme Süresi"
                value={`${overallStats.avgCrewDelayMinutes.toFixed(0)} dk`}
                subtitle={`Toplam ${overallStats.totalCrewDelayMinutes} dakika kayıp`}
                color="bg-blue-500"
              />
            </div>

            {/* Two-column layout: Delay Code Breakdown + Shift Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Delay Code Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Gecikme Kodu Dağılımı
                </h3>
                <div className="space-y-2">
                  {delayCodeBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Ekip kaynaklı gecikme bulunamadı</p>
                  ) : (
                    delayCodeBreakdown.map(([code, data]) => {
                      const pct = crewDelayFlights.length > 0 ? (data.count / crewDelayFlights.length) * 100 : 0;
                      const desc = CREW_DELAY_CODE_DESCRIPTIONS[code] || code;
                      return (
                        <div key={code}>
                          <button
                            onClick={() => setExpandedDelayCode(expandedDelayCode === code ? null : code)}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${getDelayCodeColor(code)} min-w-[40px] text-center`}>
                                {code}
                              </span>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-medium text-slate-700">{desc}</span>
                                  <span className="text-xs font-bold text-slate-800">{data.count} uçuş</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-400 min-w-[45px] text-right">{pct.toFixed(1)}%</span>
                              {expandedDelayCode === code ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </div>
                          </button>
                          {expandedDelayCode === code && (
                            <div className="mt-2 ml-12 bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs">
                              <div className="grid grid-cols-3 gap-2 mb-2 text-slate-500 font-medium">
                                <span>Toplam Süre: <span className="text-slate-800 font-bold">{data.totalMinutes} dk</span></span>
                                <span>Ortalama: <span className="text-slate-800 font-bold">{(data.totalMinutes / data.count).toFixed(0)} dk</span></span>
                                <span>Oran: <span className="text-red-600 font-bold">%{pct.toFixed(1)}</span></span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Shift Summary Cards */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Vardiya Bazlı Özet
                </h3>
                <div className="space-y-3">
                  {shiftSummaries.map(s => (
                    <div key={s.shift} className={`rounded-xl p-4 border ${
                      s.shift === 'EARLY' ? 'bg-amber-50 border-amber-200' :
                      s.shift === 'LATE' ? 'bg-orange-50 border-orange-200' :
                      'bg-indigo-50 border-indigo-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-800">{s.shiftLabel}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{s.timeRange}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center">
                        <div>
                          <div className="text-lg font-black text-slate-800">{s.totalFlights}</div>
                          <div className="text-[10px] text-slate-500">Toplam Uçuş</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-red-600">{s.crewDelayedFlights}</div>
                          <div className="text-[10px] text-slate-500">Ekip Gecikme</div>
                        </div>
                        <div>
                          <div className={`text-lg font-black ${s.otp >= 80 ? 'text-emerald-600' : 'text-red-600'}`}>
                            %{s.otp.toFixed(1)}
                          </div>
                          <div className="text-[10px] text-slate-500">OTP</div>
                        </div>
                        <div>
                          <div className="text-lg font-black text-slate-800">{s.avgCrewDelayMinutes.toFixed(0)}dk</div>
                          <div className="text-[10px] text-slate-500">Ort. Gecikme</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60">
                        <UserCog className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] text-slate-500">Şef:</span>
                        {editingSupervisor === s.shift ? (
                          <input
                            autoFocus
                            className="text-xs border border-slate-300 rounded px-2 py-0.5 flex-1 outline-none focus:ring-1 focus:ring-red-400"
                            defaultValue={s.supervisor !== 'Atanmadı' ? s.supervisor : ''}
                            onBlur={e => handleSupervisorSave(s.shift, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSupervisorSave(s.shift, (e.target as HTMLInputElement).value); }}
                            placeholder="Vardiya şefi adı..."
                          />
                        ) : (
                          <button
                            onClick={() => setEditingSupervisor(s.shift)}
                            className={`text-xs font-medium ${
                              s.supervisor === 'Atanmadı' ? 'text-slate-400 italic' : 'text-slate-700'
                            } hover:text-red-600 transition-colors`}
                          >
                            {s.supervisor}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CREW TRACKING REMARKS Section */}
            {crewDelayFlights.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquarePlus className="w-4 h-4 text-emerald-500" />
                    CREW TRACKING REMARKS
                  </h3>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                    {crewDelayFlights.length} gecikme
                  </span>
                </div>
                <div className="overflow-auto custom-scroll max-h-[400px]">
                  <table className="excel-table w-full">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="pg-th-analysis text-left">Uçuş</th>
                        <th className="pg-th-analysis text-left">Tarih</th>
                        <th className="pg-th-analysis text-left">Rota</th>
                        <th className="pg-th-analysis text-left">Gecikme</th>
                        <th className="pg-th-analysis text-left">Kod</th>
                        <th className="pg-th-analysis text-left">DELAY CODE REMARKS</th>
                        <th className="pg-th-analysis text-left" style={{ minWidth: '250px' }}>CREW TRACKING REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crewDelayFlights.map(f => (
                        <tr key={f.id}>
                          <td className="font-mono font-bold text-slate-800 text-xs">{f.flightNumber}</td>
                          <td className="text-xs">{f.date}</td>
                          <td className="text-xs font-mono">{f.departureAirport}→{f.arrivalAirport}</td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              f.delayMinutes >= 60 ? 'bg-red-100 text-red-700' :
                              f.delayMinutes >= 30 ? 'bg-amber-100 text-amber-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {f.delayMinutes}dk
                            </span>
                          </td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${getDelayCodeColor(f.delayCode)}`}>
                              {f.delayCode}
                            </span>
                          </td>
                          <td className="text-xs max-w-[180px] truncate" title={CREW_DELAY_CODE_DESCRIPTIONS[f.delayCode] || f.delayDescription || '—'}>
                            <span className="text-slate-400 italic">{CREW_DELAY_CODE_DESCRIPTIONS[f.delayCode] || f.delayDescription || '—'}</span>
                          </td>
                          <td style={{ minWidth: '250px' }}>
                            <div className="flex items-center gap-1">
                              <MessageSquarePlus className="w-3 h-3 text-slate-300 shrink-0" />
                              <input
                                type="text"
                                className="cell-input text-xs w-full"
                                placeholder="Crew tracking remark yazın..."
                                value={f.crewComment}
                                onChange={e => handleCommentChange(f.id, e.target.value)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== TABLE VIEW ===== */}
        {activeView === 'table' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Uçuş, havalimanı, gecikme kodu ara..."
                  className="flex-1 text-sm border-none outline-none bg-transparent placeholder-slate-400"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="hover:bg-slate-100 rounded p-1">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                {(['ALL', 'EARLY', 'LATE', 'NIGHT'] as ShiftFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setShiftFilter(s)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                      shiftFilter === s
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {s === 'ALL' ? 'Tümü' : s === 'EARLY' ? '🌅 Early' : s === 'LATE' ? '🌇 Late' : '🌙 Night'}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <span className="text-xs font-medium text-slate-500">
                {filteredFlights.length} gecikme
              </span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-auto custom-scroll max-h-[calc(100vh-280px)]">
                <table className="excel-table">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      {[
                        { key: 'flightNumber', label: 'Uçuş' },
                        { key: 'date', label: 'Tarih' },
                        { key: 'departureAirport', label: 'Kalkış' },
                        { key: 'arrivalAirport', label: 'Varış' },
                        { key: 'std', label: 'STD (UTC)' },
                        { key: 'atd', label: 'ATD (UTC)' },
                        { key: 'delayMinutes', label: 'Gecikme (dk)' },
                        { key: 'delayCode', label: 'Gecikme Kodu' },
                        { key: 'delayDescription', label: 'DELAY CODE REMARKS' },
                        { key: 'shift', label: 'Vardiya' },
                        { key: 'crewComment', label: 'CREW TRACKING REMARKS' },
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="cursor-pointer hover:bg-slate-200 select-none pg-th-analysis"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {sortColumn === col.key && (
                              <span className="text-red-500">
                                {sortDirection === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFlights.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-sm text-slate-400">
                          <Plane className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          Filtrelere uygun ekip kaynaklı gecikme bulunamadı
                        </td>
                      </tr>
                    ) : (
                      filteredFlights.map(f => (
                        <tr key={f.id}>
                          <td className="font-mono font-bold text-slate-800">{f.flightNumber}</td>
                          <td>{f.date}</td>
                          <td className="font-mono">{f.departureAirport}</td>
                          <td className="font-mono">{f.arrivalAirport}</td>
                          <td className="font-mono">{f.std}</td>
                          <td className="font-mono">{f.atd}</td>
                          <td>
                            <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                              f.delayMinutes >= 60 ? 'bg-red-100 text-red-700' :
                              f.delayMinutes >= 30 ? 'bg-amber-100 text-amber-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {f.delayMinutes} dk
                            </span>
                          </td>
                          <td>
                            <span className={`px-2 py-0.5 rounded border text-xs font-mono font-bold ${getDelayCodeColor(f.delayCode)}`}>
                              {f.delayCode}
                            </span>
                          </td>
                          <td className="text-xs max-w-[200px] truncate" title={CREW_DELAY_CODE_DESCRIPTIONS[f.delayCode] || f.delayDescription || '—'}>
                            <span className="text-slate-500 italic">{CREW_DELAY_CODE_DESCRIPTIONS[f.delayCode] || f.delayDescription || '—'}</span>
                          </td>
                          <td>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.shift === 'EARLY' ? 'bg-amber-100 text-amber-800' :
                              f.shift === 'LATE' ? 'bg-orange-100 text-orange-800' :
                              'bg-indigo-100 text-indigo-800'
                            }`}>
                              {f.shift === 'EARLY' ? '🌅 EARLY' : f.shift === 'LATE' ? '🌇 LATE' : '🌙 NIGHT'}
                            </span>
                          </td>
                          <td className="min-w-[200px]">
                            <div className="flex items-center gap-1">
                              <MessageSquarePlus className="w-3 h-3 text-slate-300 shrink-0" />
                              <input
                                type="text"
                                className="cell-input text-xs"
                                placeholder="Crew tracking remark..."
                                value={f.crewComment}
                                onChange={e => handleCommentChange(f.id, e.target.value)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== SHIFT ANALYSIS VIEW ===== */}
        {activeView === 'shifts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {shiftSummaries.map(s => {
                const shiftFlights = crewDelayFlights.filter(f => f.shift === s.shift);
                return (
                  <div key={s.shift} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Shift Header */}
                    <div className={`p-5 ${
                      s.shift === 'EARLY' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                      s.shift === 'LATE' ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      'bg-gradient-to-r from-indigo-600 to-purple-600'
                    } text-white`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-black">{getShiftLabel(s.shift)}</h3>
                        <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded">{getShiftTimeRange(s.shift)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                          <div className="text-2xl font-black">{s.totalFlights}</div>
                          <div className="text-[10px] opacity-80">Toplam Uçuş</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
                          <div className="text-2xl font-black">{s.crewDelayedFlights}</div>
                          <div className="text-[10px] opacity-80">Ekip Gecikme</div>
                        </div>
                      </div>
                    </div>

                    {/* Shift Body */}
                    <div className="p-5 space-y-4">
                      {/* OTP Gauge */}
                      <div className="text-center">
                        <div className="relative inline-flex items-center justify-center">
                          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                            <circle
                              cx="50" cy="50" r="40" fill="none"
                              stroke={s.otp >= 80 ? '#10b981' : s.otp >= 60 ? '#f59e0b' : '#ef4444'}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray={`${s.otp * 2.51} 251`}
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <span className="absolute text-lg font-black text-slate-800">%{s.otp.toFixed(0)}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">OTP</div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Toplam Gecikme</span>
                          <span className="font-bold text-slate-800">{s.totalCrewDelayMinutes} dk</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Ortalama Gecikme</span>
                          <span className="font-bold text-slate-800">{s.avgCrewDelayMinutes.toFixed(0)} dk</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Geciken Uçuş (≥15dk)</span>
                          <span className="font-bold text-red-600">{s.delayedFlights}</span>
                        </div>
                      </div>

                      {/* Supervisor */}
                      <div className="border-t border-slate-200 pt-3">
                        <div className="flex items-center gap-2">
                          <UserCog className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">Vardiya Şefi:</span>
                          {editingSupervisor === s.shift ? (
                            <input
                              autoFocus
                              className="text-xs border border-slate-300 rounded px-2 py-1 flex-1 outline-none focus:ring-2 focus:ring-red-400"
                              defaultValue={s.supervisor !== 'Atanmadı' ? s.supervisor : ''}
                              onBlur={e => handleSupervisorSave(s.shift, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSupervisorSave(s.shift, (e.target as HTMLInputElement).value); }}
                              placeholder="İsim girin..."
                            />
                          ) : (
                            <button
                              onClick={() => setEditingSupervisor(s.shift)}
                              className={`text-xs font-medium px-2 py-0.5 rounded ${
                                s.supervisor === 'Atanmadı'
                                  ? 'text-slate-400 italic bg-slate-50 border border-dashed border-slate-300'
                                  : 'text-slate-700 bg-slate-100'
                              } hover:border-red-400 transition-all`}
                            >
                              {s.supervisor}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mini flight list */}
                      {shiftFlights.length > 0 && (
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Son Gecikmeler
                          </p>
                          <div className="space-y-1 max-h-32 overflow-auto custom-scroll">
                            {shiftFlights.slice(0, 5).map(f => (
                              <div key={f.id} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1.5">
                                <span className="font-mono font-bold text-slate-700">{f.flightNumber}</span>
                                <span className="text-slate-400">{f.departureAirport}→{f.arrivalAirport}</span>
                                <span className={`font-bold px-1.5 rounded ${
                                  f.delayMinutes >= 60 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {f.delayMinutes}dk
                                </span>
                              </div>
                            ))}
                            {shiftFlights.length > 5 && (
                              <p className="text-[10px] text-slate-400 text-center pt-1">
                                +{shiftFlights.length - 5} gecikme daha...
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
