import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Generates an elegant, semi-transparent watermark to repeat on the background
function generatePegasusWatermarkBase64(): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  // Canvas width determines the tile density
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Leave the background purely transparent for Excel
  ctx.translate(600, 450); // move to center of tile
  ctx.rotate(-Math.PI / 8); // Rotate text elegantly (-22.5 degrees)
  
  ctx.fillStyle = 'rgba(213, 43, 30, 0.07)'; // 7% opacity Pegasus Red (Extremely soft for not obscuring text)
  ctx.font = 'italic 900 160px "Times New Roman", Times, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PEGASUS', 0, 0);
  
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

export const exportToExcelWithLogo = async (processedData: any[]) => {
  if (!processedData || processedData.length === 0) {
      alert("Dışa aktarılacak veri bulunamadı.");
      return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet1 = workbook.addWorksheet('Uçuş Verileri');
  const worksheet2 = workbook.addWorksheet('Analiz Özeti');

  // Generate Base64 Watermark 
  const base64Image = generatePegasusWatermarkBase64();
  let watermarkId: number | null = null;
  
  if (base64Image) {
      watermarkId = workbook.addImage({
          base64: base64Image,
          extension: 'png',
      });
  }

  // Set Background Watermarks
  if (watermarkId !== null) {
      worksheet1.addBackgroundImage(watermarkId);
      worksheet2.addBackgroundImage(watermarkId);
  }

  // Formal grid line style
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF808080' } },
    left: { style: 'thin', color: { argb: 'FF808080' } },
    bottom: { style: 'thin', color: { argb: 'FF808080' } },
    right: { style: 'thin', color: { argb: 'FF808080' } }
  };

  // ============================================
  // WORKSHEET 1: UÇUŞ LISTESİ (WATERMARK SUPPORTED)
  // ============================================
  
  worksheet1.addRow([]);
  const titleRow = worksheet1.addRow(["EKİP KAYNAKLI GECİKME ANALİZ RAPORU"]);
  titleRow.font = { size: 16, bold: true, color: { argb: 'FFD52B1E' } }; // Official Pegasus Red Headline
  worksheet1.addRow([]);

  const headers = ["TARİH", "VARDİYA", "AMİR", "UÇUŞ NO", "KALKIŞ", "VARIŞ", "STD", "ATD", "GECİKME KODU", "SÜRE (dk)", "AÇIKLAMA"];
  const headerRow = worksheet1.addRow(headers);
  
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; // Navy Blue Headline Background
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White letters
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  processedData.forEach((row, index) => {
    const dataRow = worksheet1.addRow([
      row.date, row.shift, row.chief || 'ATANMAMIŞ', row.flight, row.depPort, row.arrPort, row.std, row.atd, row.delayCode, row.delayTimeVal, row.remark
    ]);
    
    const isEven = index % 2 === 0;
    
    dataRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000'} };

        // We leave 'Even' rows completely transparent (no fill) so large Watermark is visible
        // We set 'Odd' rows to AliceBlue to keep the gorgeous Zebra Striping intact
        if (!isEven) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; // AliceBlue
        }

        if ([1, 2, 4, 7, 8, 9, 10].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
    });

    // Special formal coloring for Delay Code and Time
    const delayCell = dataRow.getCell(9);
    const delayTimeCell = dataRow.getCell(10);
    delayCell.font = { bold: true, color: { argb: 'FF990000' } }; 
    delayTimeCell.font = { bold: true, color: { argb: 'FF990000' } }; 
    
    // Add light red background for delays only on the tinted zebra lines to preserve watermark
    if (!isEven) {
       delayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } };
       delayTimeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } };
    }
  });

  worksheet1.columns = [
    { width: 14 }, { width: 14 }, { width: 25 }, { width: 14 },
    { width: 10 }, { width: 10 }, { width: 8 }, { width: 8 },
    { width: 18 }, { width: 14 }, { width: 45 }
  ];

  // ============================================
  // WORKSHEET 2: SUMMARY 
  // ============================================
  worksheet2.addRow([]);
  const w2Title = worksheet2.addRow(["EKİP NEDENLİ GECİKME ÖZETİ"]);
  w2Title.font = { size: 16, bold: true, color: { argb: 'FFD52B1E' } };
  worksheet2.addRow([]);

  // Calculate stats dynamically
  let totalMins = 0;
  const shiftTotals: Record<string, number> = { EARLY: 0, LATE: 0, NIGHT: 0 };
  const chiefTotals: Record<string, number> = {};

  processedData.forEach(d => {
      totalMins += d.delayTimeVal;
      if (shiftTotals[d.shift] !== undefined) shiftTotals[d.shift] += d.delayTimeVal;
      const chief = d.chief || "ATANMAMIŞ";
      chiefTotals[chief] = (chiefTotals[chief] || 0) + d.delayTimeVal;
  });

  const statHeader = worksheet2.addRow(["GENEL İSTATİSTİKLER"]);
  statHeader.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
  worksheet2.addRow(["Toplam Gecikmeli Uçuş (Adet):", new Set(processedData.map(d=>d.flight)).size]).eachCell(c => c.border = thinBorder);
  worksheet2.addRow(["Toplam Gecikme Süresi (Dk):", totalMins]).eachCell(c => { c.border = thinBorder; c.font = {bold: true, color: {argb:'FFC00000'}} });
  worksheet2.addRow([]);

  const shiftHeaderRow = worksheet2.addRow(["VARDİYA", "SÜRE (dk)"]);
  shiftHeaderRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF'} }; c.border = thinBorder; });
  
  Object.keys(shiftTotals).forEach((shift, index) => {
      worksheet2.addRow([shift, shiftTotals[shift]]).eachCell(c => { 
          c.border = thinBorder;
          if (index % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; 
      });
  });
  worksheet2.addRow([]);

  const chiefHeaderRow = worksheet2.addRow(["AMİR", "TOPLAM SÜRE (dk)"]);
  chiefHeaderRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF'} }; c.border = thinBorder; });
  
  const sortedChiefs = Object.entries(chiefTotals).sort((a,b)=>b[1]-a[1]);
  sortedChiefs.forEach(([chief, val], index) => {
      worksheet2.addRow([chief, val]).eachCell(c => { 
          c.border = thinBorder; c.font= {bold: true}; 
          if (index % 2 !== 0) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF5FB' } }; 
      });
  });

  worksheet2.columns = [{ width: 35 }, { width: 25 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  // Add unique timestamp so consecutive downloads dont override silently in some OSs
  saveAs(blob, `Pegasus_Raporu_${new Date().getTime().toString().slice(-6)}.xlsx`);
};
