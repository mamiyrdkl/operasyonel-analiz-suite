import * as XLSX from 'xlsx';

export const HEADER_ALIASES = {
    flight: ["FLIGHT NO", "UCUS NO", "UÇUŞ NO", "SEFER NO", "FLIGHT", "SEFER", "SEFER SAYISI", "UÇUŞ", "FLİGHT", "FLİGHT NO", "UCUS", "UÇUŞ", "FLT", "FLT NO", "SEFER NO.", "UÇUŞ NO.", "F.NO"],
    depPort: ["DEP PORT", "DEP", "KALKIS", "KALKIŞ", "ORIGIN", "NEREDEN", "DEP.", "ORİGİN", "NEREDEN"],
    arrPort: ["ARR PORT", "ARR", "VARIS", "VARIŞ", "DEST", "NEREYE", "ARR."],
    std: ["STD", "PLANLANAN KALKIS", "PLANLANAN KALKIŞ", "SCHED DEP", "STD LOCAL", "STD (LOCAL)", "SAAT", "TİME", "TIME", "SÜRE", "SURE", "S.T.D.", "STD.", "SCHED"],
    atd: ["ATD", "GERCEKLESEN KALKIS", "GERÇEKLEŞEN KALKIŞ", "ACTUAL DEP", "ATD LOCAL"],
    sta: ["STA", "PLANLANAN VARIS", "PLANLANAN VARIŞ"],
    ata: ["ATA", "GERCEKLESEN VARIS", "GERÇEKLEŞEN VARIŞ"],
    dateLong: ["STD LONG", "STD DATE", "TARIH", "TARİH", "FLIGHT DATE", "SEFER TARİHİ", "DATE", "GUN", "GÜN", "TARİH (LOCAL)", "TARİH", "FLIGHT DATE"],
    dateUtc: ["DEP TIME UTC", "STD (UTC)", "STD UTC"],
    dateLocal: ["DEP TIME LOCAL", "STD (LOCAL)", "STD LOCAL"],
    remark: ["CREW TRACKING REMARK", "REMARK", "ACIKLAMA", "AÇIKLAMA", "NOTE", "NOT"]
};

export function cleanStr(s: any): string {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleUpperCase('tr-TR');
}

export function findColumnIndex(row: any[], possibleNames: string[]): number {
    const upperRow = row.map(x => cleanStr(x));
    
    // 1. Exact strict match
    for (const name of possibleNames) {
        const idx = upperRow.indexOf(name);
        if (idx !== -1) return idx;
    }
    
    // 2. Partial match fallback (Flexible AI-like detection)
    for (const name of possibleNames) {
        const idx = upperRow.findIndex(cell => cell.includes(name));
        if (idx !== -1) return idx;
    }
    
    return -1;
}

export function parseFlightDate(value: any, isLocal: boolean): Date | null {
    if (!value) return null;
    let dateObj: Date | null = null;

    if (typeof value === 'number') {
        const adjustment = isLocal ? -0.125 : 0;
        dateObj = new Date(Date.UTC(1899, 11, 30) + (value + adjustment) * 86400000);
    } else if (typeof value === 'string') {
        const dmy = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
        if (dmy) {
            const d = parseInt(dmy[1], 10);
            const m = parseInt(dmy[2], 10) - 1;
            let y = parseInt(dmy[3], 10);
            
            // Re-map 2-digit years
            if (y < 100) y += 2000;

            const timeMatch = value.match(/(\d{1,2}):(\d{1,2})/);
            if (timeMatch && isLocal) {
                const h = parseInt(timeMatch[1], 10);
                if (h < 3) {
                    const tempDate = new Date(Date.UTC(y, m, d)); 
                    tempDate.setUTCDate(tempDate.getUTCDate() - 1); 
                    dateObj = tempDate;
                } else { 
                     dateObj = new Date(Date.UTC(y, m, d)); 
                }
            } else { 
                 dateObj = new Date(Date.UTC(y, m, d)); 
            }
        }
    }
    return (dateObj && !isNaN(dateObj.getTime())) ? dateObj : null;
}

export function extractDelayColumns(headerRow: any[]) {
    const delayCols: { codeIdx: number; timeIdx: number }[] = [];
    
    headerRow.forEach((cell, idx) => {
        const c = cleanStr(cell);
        if (c.includes("DELAY CODE") || c.includes("GECIKME KODU") || c.includes("GECİKME KODU") || (c.includes("CODE") && (c.includes("DLY") || c.includes("GEC"))) || c.includes("CODE") || c.includes("KOD")) {
            const suffix = c.replace(/[^0-9]/g, '');
            let tCol = -1;
            
            tCol = headerRow.findIndex((hc, hIdx) => {
                if (hIdx === idx) return false; 
                const h = cleanStr(hc);
                const hSuffix = h.replace(/[^0-9]/g, '');
                const isTime = h.includes("TIME") || h.includes("TİME") || h.includes("SURE") || h.includes("SÜRE") || h.includes("DURATION");
                return isTime && (suffix === "" || hSuffix === suffix); 
            });

            if (tCol === -1) {
                const nextHeader = cleanStr(headerRow[idx + 1]);
                if (nextHeader && (nextHeader.includes("TIME") || nextHeader.includes("TİME") || nextHeader.includes("SURE") || nextHeader.includes("SÜRE") || nextHeader.includes("DK"))) {
                    tCol = idx + 1;
                }
            }

            if (tCol !== -1) {
                delayCols.push({ codeIdx: idx, timeIdx: tCol });
            }
        }
    });

    if (delayCols.length === 0) {
         const stdDelayGroups = [1, 2, 3, 4].map(n => ({ 
             c: [`DELAY CODE ${n}`, `GECIKME KODU ${n}`], 
             t: [`DL TIME ${n}`, `GECIKME SURESI ${n}`] 
         }));
         stdDelayGroups.forEach(g => {
             const ci = findColumnIndex(headerRow, g.c);
             const ti = findColumnIndex(headerRow, g.t);
             if (ci !== -1 && ti !== -1) delayCols.push({ codeIdx: ci, timeIdx: ti });
         });
    }
    
    return delayCols;
}
