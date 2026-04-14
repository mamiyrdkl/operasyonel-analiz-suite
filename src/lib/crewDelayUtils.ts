// Crew Delay Analysis Utilities
// Vardiya, OTP ve gecikme hesaplama fonksiyonları

export interface FlightRecord {
  id: number;
  flightNumber: string;
  date: string;
  departureAirport: string;
  arrivalAirport: string;
  std: string;           // Scheduled Time of Departure (UTC) - HH:MM
  atd: string;           // Actual Time of Departure (UTC) - HH:MM
  delayMinutes: number;  // Gecikme süresi (dakika)
  delayCode: string;     // IATA gecikme kodu
  delaySubcode: string;  // Alt kod
  delayDescription: string; // Gecikme açıklaması
  isCrewDelay: boolean;  // Ekip kaynaklı mı?
  shift: 'EARLY' | 'LATE' | 'NIGHT'; // Vardiya
  shiftSupervisor: string; // Vardiya şefi
  crewComment: string;   // Ekip tahsis açıklaması
  acType: string;        // Uçak tipi
  registration: string;  // Uçak tescil
}

export interface ShiftSummary {
  shift: 'EARLY' | 'LATE' | 'NIGHT';
  shiftLabel: string;
  timeRange: string;
  totalFlights: number;
  delayedFlights: number;
  crewDelayedFlights: number;
  totalCrewDelayMinutes: number;
  avgCrewDelayMinutes: number;
  otp: number;
  supervisor: string;
}

export interface OverallStats {
  totalFlights: number;
  totalDelayedFlights: number;
  crewDelayedFlights: number;
  totalDelayMinutes: number;
  totalCrewDelayMinutes: number;
  otp: number;
  crewDelayPercentage: number; // Ekip gecikmelerinin toplam gecikmelere oranı
  avgCrewDelayMinutes: number;
}

// IATA Crew-related delay codes (6x serisi - ekip kaynaklı gecikmeler)
// 61: Flight Deck Crew (Pilot)
// 62: Cabin Crew shortage/late
// 63: Crew booking error
// 64: Crew training
// 65: Crew special request / Crew absence
// 66: Late crew (other reasons)
// 67: Crew legality (legal rest requirements)
export const CREW_DELAY_CODES = ['61', '62', '63', '64', '65', '66', '67', '68', '69'];

export const CREW_DELAY_CODE_DESCRIPTIONS: Record<string, string> = {
  '61': 'Kokpit Ekibi - Kaptan/F.O. Eksik veya Geç',
  '62': 'Kabin Ekibi - Eksik veya Geç',
  '63': 'Ekip Planlama Hatası',
  '64': 'Ekip Eğitim',
  '65': 'Ekip Devamsızlık / Özel Talep',
  '66': 'Ekip Geç Kalma (Diğer)',
  '67': 'Ekip Legalite (Yasal Dinlenme)',
  '68': 'Ekip Sağlık / Revir',
  '69': 'Ekip - Diğer Sebepler',
};

/**
 * UTC saatine göre vardiya belirler
 * Early:  07:01 - 15:00 UTC
 * Late:   15:01 - 23:00 UTC
 * Night:  23:01 - 07:00 UTC
 */
export function getShift(timeStr: string): 'EARLY' | 'LATE' | 'NIGHT' {
  if (!timeStr) return 'NIGHT';
  
  const parts = timeStr.replace(/[^\d:]/g, '').split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || '0', 10);
  const totalMinutes = hours * 60 + minutes;

  // Early: 07:01 (421) - 15:00 (900)
  if (totalMinutes >= 421 && totalMinutes <= 900) return 'EARLY';
  // Late: 15:01 (901) - 23:00 (1380)
  if (totalMinutes >= 901 && totalMinutes <= 1380) return 'LATE';
  // Night: 23:01 (1381) - 07:00 (420) (gece yarısı geçişi)
  return 'NIGHT';
}

export function getShiftLabel(shift: 'EARLY' | 'LATE' | 'NIGHT'): string {
  switch (shift) {
    case 'EARLY': return '🌅 Early Vardiya';
    case 'LATE': return '🌇 Late Vardiya';
    case 'NIGHT': return '🌙 Night Vardiya';
  }
}

export function getShiftTimeRange(shift: 'EARLY' | 'LATE' | 'NIGHT'): string {
  switch (shift) {
    case 'EARLY': return '07:01 - 15:00 UTC';
    case 'LATE': return '15:01 - 23:00 UTC';
    case 'NIGHT': return '23:01 - 07:00 UTC';
  }
}

export function isCrewDelayCode(code: string): boolean {
  if (!code) return false;
  const normalized = code.toString().trim();
  return CREW_DELAY_CODES.includes(normalized) || normalized.startsWith('6');
}

/**
 * Gecikme dakikası hesapla (STD ve ATD arasındaki fark)
 */
export function calculateDelayMinutes(std: string, atd: string): number {
  if (!std || !atd) return 0;
  
  const parseTime = (t: string) => {
    const clean = t.replace(/[^\d:]/g, '');
    const parts = clean.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  };

  const stdMin = parseTime(std);
  let atdMin = parseTime(atd);

  // Gece yarısı geçişi kontrolü (atd < std ise ertesi gün)
  if (atdMin < stdMin - 120) { // 2 saatten fazla erken ise gece yarısı geçişi
    atdMin += 1440; // 24 saat ekle
  }

  const diff = atdMin - stdMin;
  return diff > 0 ? diff : 0;
}

/**
 * OTP hesapla: (Zamanında + 14dk'ya kadar gecikenler) / Toplam × 100
 * Industry standardı: 15dk'nın altındaki gecikmeler "on-time" sayılır
 */
export function calculateOTP(flights: FlightRecord[]): number {
  if (flights.length === 0) return 0;
  const onTimeCount = flights.filter(f => f.delayMinutes < 15).length;
  return (onTimeCount / flights.length) * 100;
}

/**
 * Genel istatistikleri hesapla
 */
export function calculateOverallStats(flights: FlightRecord[]): OverallStats {
  const totalFlights = flights.length;
  const delayedFlights = flights.filter(f => f.delayMinutes >= 15);
  const crewDelayedFlights = flights.filter(f => f.isCrewDelay && f.delayMinutes >= 15);

  const totalDelayMinutes = delayedFlights.reduce((sum, f) => sum + f.delayMinutes, 0);
  const totalCrewDelayMinutes = crewDelayedFlights.reduce((sum, f) => sum + f.delayMinutes, 0);

  return {
    totalFlights,
    totalDelayedFlights: delayedFlights.length,
    crewDelayedFlights: crewDelayedFlights.length,
    totalDelayMinutes,
    totalCrewDelayMinutes,
    otp: calculateOTP(flights),
    crewDelayPercentage: delayedFlights.length > 0 
      ? (crewDelayedFlights.length / delayedFlights.length) * 100 
      : 0,
    avgCrewDelayMinutes: crewDelayedFlights.length > 0
      ? totalCrewDelayMinutes / crewDelayedFlights.length
      : 0,
  };
}

/**
 * Vardiya bazlı özet hesapla
 */
export function calculateShiftSummaries(
  flights: FlightRecord[], 
  supervisors: Record<string, string>
): ShiftSummary[] {
  const shifts: ('EARLY' | 'LATE' | 'NIGHT')[] = ['EARLY', 'LATE', 'NIGHT'];

  return shifts.map(shift => {
    const shiftFlights = flights.filter(f => f.shift === shift);
    const delayed = shiftFlights.filter(f => f.delayMinutes >= 15);
    const crewDelayed = shiftFlights.filter(f => f.isCrewDelay && f.delayMinutes >= 15);
    const totalCrewMin = crewDelayed.reduce((s, f) => s + f.delayMinutes, 0);

    return {
      shift,
      shiftLabel: getShiftLabel(shift),
      timeRange: getShiftTimeRange(shift),
      totalFlights: shiftFlights.length,
      delayedFlights: delayed.length,
      crewDelayedFlights: crewDelayed.length,
      totalCrewDelayMinutes: totalCrewMin,
      avgCrewDelayMinutes: crewDelayed.length > 0 ? totalCrewMin / crewDelayed.length : 0,
      otp: calculateOTP(shiftFlights),
      supervisor: supervisors[shift] || 'Atanmadı',
    };
  });
}

/**
 * Excel sütun eşleştirme yardımcı
 * Farklı Excel formatlarını destekler
 */
export const COLUMN_MAPPINGS: Record<string, string[]> = {
  flightNumber: ['flight', 'flight no', 'flight number', 'uçuş', 'ucus', 'flt', 'flt no', 'sefer', 'sefer no'],
  date: ['date', 'tarih', 'flight date', 'uçuş tarihi', 'ucus tarihi', 'dep date'],
  departureAirport: ['dep', 'departure', 'from', 'kalkış', 'kalkis', 'dep airport', 'origin', 'adep'],
  arrivalAirport: ['arr', 'arrival', 'to', 'varış', 'varis', 'arr airport', 'destination', 'ades'],
  std: ['std', 'scheduled', 'scheduled departure', 'planlanan', 'sobt'],
  atd: ['atd', 'actual', 'actual departure', 'gerçekleşen', 'aobt', 'actual off block'],
  delayMinutes: ['delay', 'delay min', 'delay minutes', 'gecikme', 'gecikme dk', 'gecikme dakika', 'delay time', 'del min'],
  delayCode: ['code', 'delay code', 'gecikme kodu', 'kod', 'iata code', 'delay reason code'],
  delaySubcode: ['subcode', 'sub code', 'sub', 'alt kod', 'delay sub code'],
  delayDescription: ['description', 'reason', 'açıklama', 'aciklama', 'gecikme açıklama', 'delay reason', 'delay desc'],
  acType: ['ac type', 'aircraft type', 'type', 'uçak tipi', 'ucak tipi', 'a/c type', 'actype'],
  registration: ['registration', 'reg', 'tail', 'tescil', 'a/c reg', 'tail number'],
};

export function matchColumn(header: string): string | null {
  const normalized = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
    if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
      return field;
    }
  }
  return null;
}

/**
 * Delay code'a göre renk sınıfı döndür
 */
export function getDelayCodeColor(code: string): string {
  if (!code) return '';
  const num = parseInt(code.toString().trim(), 10);
  if (num >= 61 && num <= 69) return 'bg-red-100 text-red-800 border-red-300';
  if (num >= 41 && num <= 49) return 'bg-amber-100 text-amber-800 border-amber-300'; // Teknik
  if (num >= 31 && num <= 39) return 'bg-blue-100 text-blue-800 border-blue-300';   // Yolcu/Bagaj
  if (num >= 81 && num <= 89) return 'bg-purple-100 text-purple-800 border-purple-300'; // ATC/Hava
  return 'bg-slate-100 text-slate-700 border-slate-300';
}
