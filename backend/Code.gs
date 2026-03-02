// =============================================================================
// ระบบเฝ้าระวังไฟป่า - Backend หลัก (Google Apps Script)
// อุทยานแห่งชาติเอราวัณ
// =============================================================================

// -----------------------------------------------------------------------------
// ตั้งค่า: ใช้ Properties Service แทน Hardcode (ปลอดภัยกว่า)
// -----------------------------------------------------------------------------
// วิธีตั้งค่า: ไปที่ Project Settings > Script Properties > Add Property
// - FOLDER_ID: รหัสโฟลเดอร์ Google Drive
// - CHANNEL_ACCESS_TOKEN: LINE Bot Token
// - GROUP_ID: LINE Group ID

function getConfig(key) {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key);
}

// Fallback สำหรับการทดสอบ (ลบเมื่อใช้งานจริง)
const FOLDER_ID = getConfig('FOLDER_ID') || '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ';
const CHANNEL_ACCESS_TOKEN = getConfig('CHANNEL_ACCESS_TOKEN') || '';
const GROUP_ID = getConfig('GROUP_ID') || '';
const TOTAL_WATCH_POINTS = 20;
const SHEET_ID = getConfig('SHEET_ID') || '1TzZ0wtwvEMNKIUVCxtSujpYxBJZgClcWhmBedm_FVoQ';
const SHEET_NAME = 'ชีต1';

// =============================================================================
// API ENDPOINTS: doPost (รับข้อมูล) และ doGet (ส่งข้อมูล)
// =============================================================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // === Action: บันทึกเหตุไฟป่า ===
    if (data.action === 'saveFireIncident') {
      const result = saveFireIncident(data.payload);
      return jsonResponse(result);
    }

    // === Action: สร้างประกาศ ===
    if (data.action === 'createAnnouncement') {
      const result = createAnnouncement(data.payload);
      return jsonResponse(result);
    }

    // === Action: แก้ไขประกาศ ===
    if (data.action === 'updateAnnouncement') {
      const result = updateAnnouncement(data.payload);
      return jsonResponse(result);
    }

    // === Action: ลบประกาศ ===
    if (data.action === 'deleteAnnouncement') {
      const result = deleteAnnouncement(data.id);
      return jsonResponse(result);
    }

    // === Default: บันทึกรายงานประจำวัน (เดิม) ===
    const result = saveReport(data);
    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({ success: false, message: 'Error: ' + error.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const date = e.parameter.date;

    // === Action: ดึงข้อมูลเหตุไฟป่า ===
    if (action === 'getFireIncidents') {
      const data = getFireIncidents();
      return jsonResponse(data);
    }

    // === Action: ดึงประกาศ ===
    if (action === 'getAnnouncements') {
      const data = getAnnouncements();
      return jsonResponse(data);
    }

    // === Action: ดึงสถิติเหตุไฟป่า ===
    if (action === 'getFireStats') {
      const data = getFireIncidentStats();
      return jsonResponse(data);
    }

    // === Action: สรุปคะแนนการมีส่วนร่วม (อ่านจาก Sheet เร็วมาก) ===
    if (action === 'getParticipationSummary') {
      const data = getParticipationSummary();
      return jsonResponse(data);
    }

    // === Action: ดึงข้อมูลรายงานทั้งหมด ===
    if (action === 'getAllReports') {
      const data = getAllReports();
      return jsonResponse(data);
    }

    // === Action: ดึงข้อมูลทุกจุดเฝ้าระวัง (รวมจุดที่ไม่มีรายงาน) ===
    if (action === 'getAllPoints') {
      const data = getAllPointsWithReports();
      return jsonResponse(data);
    }

    // === Default: ดึงข้อมูล Dashboard (เดิม) ===
    if (date) {
      const cacheKey = 'dashboard_' + date;
      const cache = CacheService.getScriptCache();
      const cached = cache.get(cacheKey);

      if (cached) {
        return jsonResponse(JSON.parse(cached));
      }

      const reports = getDashboardData(date);
      cache.put(cacheKey, JSON.stringify(reports), 600); // Cache 10 นาที
      return jsonResponse(reports);
    }

    return jsonResponse({ error: 'Missing parameters' });

  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// REPORT SERVICE: บันทึกรายงานประจำวัน
// =============================================================================

function saveReport(data) {
  const parentFolder = DriveApp.getFolderById(data.parentFolderId || FOLDER_ID);

  // สร้างโครงสร้างโฟลเดอร์: วันที่ > จุดเฝ้าระวัง > กะ
  const dateFolder = getOrCreateFolder(parentFolder, data.date);
  const pointFolder = getOrCreateFolder(dateFolder, data.pointName);
  const shiftFolder = getOrCreateFolder(pointFolder, data.shift);

  // บันทึกรูปภาพ
  let savedCount = 0;
  if (data.images && data.images.length > 0) {
    data.images.forEach((base64Image, index) => {
      try {
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(base64Image.split(',')[1]),
          'image/jpeg',
          `image_${index + 1}_${Date.now()}.jpg`
        );
        shiftFolder.createFile(imageBlob);
        savedCount++;
      } catch (e) {
        Logger.log('Error saving image: ' + e);
      }
    });
  }

  // บันทึกหมายเหตุ (ถ้ามี)
  if (data.notes && data.notes.trim()) {
    const notesFile = shiftFolder.createFile(
      'notes.txt',
      `วันที่: ${data.date}\nจุด: ${data.pointName}\nกะ: ${data.shift}\n\nหมายเหตุ:\n${data.notes}`,
      MimeType.PLAIN_TEXT
    );
  }

  // บันทึก Log ลง Sheet (พร้อม notes และ folderUrl)
  const now = new Date();
  const shiftFolderUrl = shiftFolder.getUrl();
  logReportToSheet(data.date, data.pointName, data.shift, now.toISOString(), data.notes || '', shiftFolderUrl);

  // ล้าง Cache เมื่อมีข้อมูลใหม่
  CacheService.getScriptCache().remove('dashboard_' + data.date);
  CacheService.getScriptCache().remove('all_reports_sheet');

  return {
    success: true,
    message: `บันทึก ${savedCount} รูปภาพเรียบร้อยแล้ว`,
    savedCount: savedCount
  };
}

// บันทึก Log รายงานลง Google Sheet (ใช้โครงสร้าง column เดิม)
// A: วันที่-เวลาที่ส่ง | B: วันที่รายงาน | C: ชื่อจุด | D: ช่วงเวลา | E: หมายเหตุ | F: ลิงก์โฟลเดอร์
function logReportToSheet(date, pointName, shift, timestamp, notes, folderUrl) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);

    // สร้าง Sheet ใหม่ถ้ายังไม่มี
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['วันที่-เวลาที่ส่ง', 'วันที่รายงาน', 'ชื่อจุดเฝ้าระวัง', 'ช่วงเวลา', 'หมายเหตุ/ข้อสังเกต', 'ลิงก์โฟลเดอร์รูป']);
      sheet.setFrozenRows(1);
    }

    // A=timestamp ที่ส่ง, B=วันที่รายงาน, C=ชื่อจุด, D=กะ, E=หมายเหตุ, F=ลิงก์
    const sendTime = new Date(timestamp);
    const sendTimeStr = Utilities.formatDate(sendTime, Session.getScriptTimeZone(), 'd/M/yyyy, HH:mm:ss');
    sheet.appendRow([sendTimeStr, date, pointName, shift, notes || '', folderUrl || '']);
  } catch (e) {
    Logger.log('Error logging to sheet: ' + e);
  }
}

// อ่านรายงานทั้งหมดจาก Google Sheet (เร็วกว่า Drive traversal มาก)
function getAllReportsFromSheet() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('all_reports_sheet');
    if (cached) return JSON.parse(cached);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // แค่ header

    const reports = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // รองรับทั้ง format เก่า (6 col) และ format ใหม่
      // A=วันที่-เวลาส่ง, B=วันที่รายงาน, C=ชื่อจุด, D=กะ
      const sendTimeRaw = row[0];
      const dateRaw     = row[1];
      const pointName   = row[2];
      const shift       = row[3];

      if (!pointName || !shift) continue;

      // แปลง dateRaw เป็น string yyyy-MM-dd
      let dateStr = '';
      if (dateRaw instanceof Date) {
        dateStr = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        dateStr = String(dateRaw);
      }

      // แปลง sendTime เป็น ISO timestamp
      let timestamp = '';
      if (sendTimeRaw instanceof Date) {
        timestamp = sendTimeRaw.toISOString();
      } else if (sendTimeRaw) {
        // parse string เช่น "16/2/2026, 11:56:18"
        const parsed = new Date(String(sendTimeRaw));
        timestamp = isNaN(parsed) ? (dateStr + 'T08:00:00.000Z') : parsed.toISOString();
      } else {
        timestamp = dateStr + 'T08:00:00.000Z';
      }

      if (!dateStr) continue;
      reports.push({
        date: dateStr,
        pointName: String(pointName),
        shift: String(shift),
        timestamp: timestamp,
        reportTime: timestamp
      });
    }

    // เรียงล่าสุดก่อน
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Cache ไว้ 5 นาที
    cache.put('all_reports_sheet', JSON.stringify(reports), 300);
    return reports;
  } catch (e) {
    Logger.log('Error reading from sheet: ' + e);
    return [];
  }
}

// Migrate ข้อมูลเก่าจาก Drive → Sheet แบบ batch ทีละวัน (resume ได้ถ้า timeout)
// รันซ้ำได้เรื่อยๆ จนกว่า log จะบอกว่า "Backfill complete"
function backfillSheetFromDrive() {
  const props = PropertiesService.getScriptProperties();
  const MAX_MS = 4.5 * 60 * 1000; // หยุดก่อน timeout ที่ 4.5 นาที
  const startTime = Date.now();

  const parentFolder = DriveApp.getFolderById(FOLDER_ID);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['วันที่', 'จุดเฝ้าระวัง', 'กะ', 'timestamp']);
    sheet.setFrozenRows(1);
  }

  // โหลด existing keys จาก Sheet เพื่อกัน duplicate
  // Sheet structure: A=วันที่-เวลาส่ง, B=วันที่รายงาน, C=ชื่อจุด, D=กะ
  const existing = sheet.getDataRange().getValues();
  const existingKeys = new Set();
  for (let i = 1; i < existing.length; i++) {
    const dateRaw = existing[i][1]; // col B = วันที่รายงาน
    let dateStr = '';
    if (dateRaw instanceof Date) {
      dateStr = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      dateStr = String(dateRaw).substring(0, 10); // ตัดให้เหลือแค่ yyyy-MM-dd
    }
    const pointName = String(existing[i][2]); // col C
    const shift     = String(existing[i][3]); // col D
    existingKeys.add(`${dateStr}_${pointName}_${shift}`);
  }

  // ดึงรายการวันที่ทั้งหมดจาก Drive
  const dateFolderIter = parentFolder.getFolders();
  const allDates = [];
  while (dateFolderIter.hasNext()) {
    const f = dateFolderIter.next();
    if (f.getName().match(/^\d{4}-\d{2}-\d{2}$/)) {
      allDates.push(f.getName());
    }
  }
  allDates.sort(); // เรียงน้อยไปมาก

  // resume: อ่านว่าทำถึงวันไหนแล้ว
  const lastDone = props.getProperty('backfill_last_date') || '';
  const startIndex = lastDone ? allDates.indexOf(lastDone) + 1 : 0;

  if (startIndex >= allDates.length) {
    Logger.log('Backfill complete! All dates processed.');
    props.deleteProperty('backfill_last_date');
    CacheService.getScriptCache().remove('all_reports_sheet');
    return;
  }

  Logger.log(`Resuming from index ${startIndex} / ${allDates.length} (date: ${allDates[startIndex]})`);

  let addedCount = 0;
  let processedDates = 0;

  for (let i = startIndex; i < allDates.length; i++) {
    // หยุดถ้าใกล้ timeout
    if (Date.now() - startTime > MAX_MS) {
      props.setProperty('backfill_last_date', allDates[i - 1]);
      Logger.log(`Paused at date ${allDates[i - 1]} to avoid timeout. Added ${addedCount} rows. Run again to continue.`);
      CacheService.getScriptCache().remove('all_reports_sheet');
      return;
    }

    const date = allDates[i];
    const dateFolders = parentFolder.getFoldersByName(date);
    if (!dateFolders.hasNext()) continue;
    const dateFolder = dateFolders.next();

    const pointIter = dateFolder.getFolders();
    while (pointIter.hasNext()) {
      const pointFolder = pointIter.next();
      const pointName = pointFolder.getName();
      const shiftIter = pointFolder.getFolders();
      while (shiftIter.hasNext()) {
        const shiftFolder = shiftIter.next();
        const shiftName = shiftFolder.getName();
        if (!shiftFolder.getFiles().hasNext()) continue;

        const key = `${date}_${pointName}_${shiftName}`;
        if (existingKeys.has(key)) continue;

        // พยายามอ่านเวลาและหมายเหตุจาก notes.txt
        let sendTime = new Date(date + 'T08:00:00');
        let notes = '';
        const notesIter = shiftFolder.getFilesByName('notes.txt');
        if (notesIter.hasNext()) {
          const content = notesIter.next().getBlob().getDataAsString();
          const m = content.match(/(\d{1,2}:\d{2})/);
          if (m) {
            const [h, min] = m[1].split(':').map(Number);
            sendTime = new Date(date);
            sendTime.setHours(h, min);
          }
          // ดึงหมายเหตุจาก notes.txt
          const notesMatch = content.match(/หมายเหตุ:\n([\s\S]*)/);
          if (notesMatch) {
            notes = notesMatch[1].trim();
          }
        }

        // เขียน 6 col เหมือน logReportToSheet: A=sendTime, B=date, C=point, D=shift, E=notes, F=folderUrl
        const sendTimeStr = Utilities.formatDate(sendTime, Session.getScriptTimeZone(), 'd/M/yyyy, HH:mm:ss');
        const folderUrl = shiftFolder.getUrl();
        sheet.appendRow([sendTimeStr, date, pointName, shiftName, notes, folderUrl]);
        existingKeys.add(key);
        addedCount++;
      }
    }
    processedDates++;
  }

  Logger.log(`Backfill complete! Processed ${processedDates} dates, added ${addedCount} rows.`);
  props.deleteProperty('backfill_last_date');
  CacheService.getScriptCache().remove('all_reports_sheet');
}

// สรุปคะแนนการมีส่วนร่วมจาก Sheet (เร็วมาก ไม่ต้องวน Drive)
// เกณฑ์: แต่ละรายงาน = 10 คะแนน, ครบ 3 กะ/วัน = โบนัส 5 คะแนน
function getParticipationSummary() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('participation_summary');
    if (cached) return JSON.parse(cached);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return { points: [], totalReports: 0 };

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { points: [], totalReports: 0 };

    // นับจำนวนรายงานต่อจุด + ต่อกะ + ต่อวัน
    const pointStats = {}; // { pointName: { total, shifts: {}, dates: Set } }

    for (let i = 1; i < data.length; i++) {
      const dateRaw = data[i][1]; // col B
      const pointName = String(data[i][2] || '').trim(); // col C
      const shift = String(data[i][3] || '').trim(); // col D

      if (!pointName || !shift) continue;

      let dateStr = '';
      if (dateRaw instanceof Date) {
        dateStr = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        dateStr = String(dateRaw).substring(0, 10);
      }

      if (!pointStats[pointName]) {
        pointStats[pointName] = { total: 0, shifts: {}, dates: {}, fullDays: 0 };
      }
      pointStats[pointName].total++;

      // นับรายงานต่อกะ
      if (!pointStats[pointName].shifts[shift]) pointStats[pointName].shifts[shift] = 0;
      pointStats[pointName].shifts[shift]++;

      // นับกะต่อวัน เพื่อหาวันที่ครบ 3 กะ
      if (!pointStats[pointName].dates[dateStr]) pointStats[pointName].dates[dateStr] = new Set();
      pointStats[pointName].dates[dateStr].add(shift);
    }

    // คำนวณคะแนน + จัดเรียง
    const SCORE_PER_REPORT = 10;
    const FULL_DAY_BONUS = 5; // ครบ 3 กะในวันเดียว

    const points = [];
    for (let pn in pointStats) {
      const s = pointStats[pn];
      // นับวันที่ครบ 3 กะ
      let fullDays = 0;
      for (let d in s.dates) {
        if (s.dates[d].size >= 3) fullDays++;
      }
      s.fullDays = fullDays;

      const totalScore = (s.total * SCORE_PER_REPORT) + (fullDays * FULL_DAY_BONUS);
      const totalDays = Object.keys(s.dates).length;

      points.push({
        pointName: pn,
        totalReports: s.total,
        totalScore: totalScore,
        totalDays: totalDays,
        fullDays: fullDays,
        shifts: s.shifts
      });
    }

    // เรียงคะแนนจากมากไปน้อย
    points.sort((a, b) => b.totalScore - a.totalScore);

    // เพิ่มอันดับ
    points.forEach((p, i) => p.rank = i + 1);

    const result = {
      points: points,
      totalReports: data.length - 1,
      generatedAt: new Date().toISOString()
    };

    // Cache 5 นาที
    cache.put('participation_summary', JSON.stringify(result), 300);
    return result;
  } catch (e) {
    Logger.log('Error getParticipationSummary: ' + e);
    return { points: [], totalReports: 0, error: e.toString() };
  }
}

// รีเซ็ต progress ของ backfill (ถ้าต้องการเริ่มใหม่ทั้งหมด)
function resetBackfillProgress() {
  PropertiesService.getScriptProperties().deleteProperty('backfill_last_date');
  Logger.log('Backfill progress reset.');
}

// ลบ row ซ้ำออกจาก Sheet โดยเก็บ row ที่มี col A (timestamp ที่ส่ง) ไว้ก่อน
// ใช้ key = col B (วันที่) + col C (จุด) + col D (กะ)
function cleanupDuplicateRows() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { Logger.log('Sheet not found'); return; }

  const data = sheet.getDataRange().getValues();
  const seen = new Map(); // key -> row index (1-based) ที่จะเก็บไว้
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const dateRaw = data[i][1];
    let dateStr = '';
    if (dateRaw instanceof Date) {
      dateStr = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      dateStr = String(dateRaw).substring(0, 10);
    }
    const key = `${dateStr}_${data[i][2]}_${data[i][3]}`;
    if (!key || key === '__') continue;

    if (seen.has(key)) {
      // เก็บ row ที่มี col A (timestamp) ไว้ ลบ row ที่ไม่มี
      const prevRowIdx = seen.get(key);
      const prevHasTimestamp = data[prevRowIdx - 1][0] && String(data[prevRowIdx - 1][0]).trim() !== '';
      const currHasTimestamp = data[i][0] && String(data[i][0]).trim() !== '';

      if (prevHasTimestamp && !currHasTimestamp) {
        rowsToDelete.push(i + 1); // ลบ current (i+1 เพราะ 1-based)
      } else {
        rowsToDelete.push(prevRowIdx); // ลบ previous
        seen.set(key, i + 1);
      }
    } else {
      seen.set(key, i + 1);
    }
  }

  // ลบจากล่างขึ้นบนเพื่อไม่ให้ index เลื่อน
  rowsToDelete.sort((a, b) => b - a);
  rowsToDelete.forEach(r => sheet.deleteRow(r));

  Logger.log(`cleanupDuplicateRows: ลบ ${rowsToDelete.length} row ซ้ำ`);
  CacheService.getScriptCache().remove('all_reports_sheet');
}

// ตรวจสอบสถานะข้อมูล: Drive มีถึงวันไหน, Sheet มีถึงวันไหน, ช่องว่างอยู่ตรงไหน
function checkDataStatus() {
  // === ตรวจสอบ Drive ===
  const parentFolder = DriveApp.getFolderById(FOLDER_ID);
  const driveDates = [];
  const iter = parentFolder.getFolders();
  while (iter.hasNext()) {
    const f = iter.next();
    if (f.getName().match(/^\d{4}-\d{2}-\d{2}$/)) {
      driveDates.push(f.getName());
    }
  }
  driveDates.sort();

  // === ตรวจสอบ Sheet ===
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const sheetDates = new Set();
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const dateRaw = data[i][1]; // col B = วันที่รายงาน
      if (!dateRaw) continue;
      let d = '';
      if (dateRaw instanceof Date) {
        d = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        d = String(dateRaw).substring(0, 10);
      }
      if (d.match(/^\d{4}-\d{2}-\d{2}$/)) sheetDates.add(d);
    }
  }

  // === หาวันที่อยู่ใน Drive แต่ไม่อยู่ใน Sheet ===
  const missingInSheet = driveDates.filter(d => !sheetDates.has(d));

  Logger.log('=== DATA STATUS ===');
  Logger.log(`Drive: ${driveDates.length} วัน (${driveDates[0]} ถึง ${driveDates[driveDates.length - 1]})`);
  Logger.log(`Sheet: ${sheetDates.size} วัน (ล่าสุด: ${[...sheetDates].sort().pop()})`);
  Logger.log(`ขาดใน Sheet: ${missingInSheet.length} วัน`);
  if (missingInSheet.length > 0) {
    Logger.log('วันที่ขาด: ' + missingInSheet.join(', '));
  } else {
    Logger.log('Sheet ครบถ้วนกับ Drive แล้ว!');
  }
}

function getDashboardData(date) {
  const parentFolder = DriveApp.getFolderById(FOLDER_ID);
  const reports = [];

  try {
    const dateFolders = parentFolder.getFoldersByName(date);
    if (!dateFolders.hasNext()) return reports;

    const dateFolder = dateFolders.next();
    const pointFolders = dateFolder.getFolders();

    while (pointFolders.hasNext()) {
      const pointFolder = pointFolders.next();
      const pointName = pointFolder.getName();
      const shiftFolders = pointFolder.getFolders();

      while (shiftFolders.hasNext()) {
        const shiftFolder = shiftFolders.next();
        const shiftName = shiftFolder.getName();

        // เช็คว่ามีไฟล์หรือไม่
        if (shiftFolder.getFiles().hasNext()) {
          reports.push({
            pointName: pointName,
            shift: shiftName,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  } catch (e) {
    Logger.log('Error getting dashboard data: ' + e);
  }

  return reports;
}

// ฟังก์ชันดึงข้อมูลรายงานทั้งหมด (อ่านจาก Sheet ก่อน, fallback ไป Drive)
function getAllReports() {
  const sheetReports = getAllReportsFromSheet();
  if (sheetReports.length > 0) return sheetReports;
  // fallback: อ่านจาก Drive (ช้า) ถ้า Sheet ว่าง
  return getAllReportsFromDrive();
}

// ฟังก์ชันดึงข้อมูลจาก Drive (เดิม - ใช้เป็น fallback)
function getAllReportsFromDrive() {
  const parentFolder = DriveApp.getFolderById(FOLDER_ID);
  const allReports = [];

  try {
    const dateFolders = parentFolder.getFolders();
    
    while (dateFolders.hasNext()) {
      const dateFolder = dateFolders.next();
      const date = dateFolder.getName();
      
      // ตรวจสอบว่าเป็นรูปแบบวันที่ (yyyy-MM-dd)
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
      
      const pointFolders = dateFolder.getFolders();
      
      while (pointFolders.hasNext()) {
        const pointFolder = pointFolders.next();
        const pointName = pointFolder.getName();
        
        const shiftFolders = pointFolder.getFolders();
        
        while (shiftFolders.hasNext()) {
          const shiftFolder = shiftFolders.next();
          const shiftName = shiftFolder.getName();
          
          // เช็คว่ามีไฟล์หรือไม่
          if (shiftFolder.getFiles().hasNext()) {
            // ดึงเวลาจากไฟล์ notes.txt ถ้ามี
            let reportTime = new Date(date + 'T00:00:00').toISOString();
            const notesFiles = shiftFolder.getFilesByName('notes.txt');
            
            if (notesFiles.hasNext()) {
              const notesFile = notesFiles.next();
              const content = notesFile.getBlob().getDataAsString();
              const timeMatch = content.match(/(\d{1,2}:\d{2})/);
              if (timeMatch) {
                const [hours, minutes] = timeMatch[1].split(':').map(Number);
                const reportDate = new Date(date);
                reportDate.setHours(hours, minutes);
                reportTime = reportDate.toISOString();
              }
            }
            
            allReports.push({
              pointName: pointName,
              shift: shiftName,
              date: date,
              timestamp: reportTime,
              reportTime: reportTime
            });
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Error getting all reports: ' + e);
  }

  // เรียงลำดับตามวันที่และเวลา
  return allReports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ฟังก์ชันดึงข้อมูลทุกจุดเฝ้าระวัง (รวมจุดที่ไม่มีรายงาน)
function getAllPointsWithReports() {
  return getAllReports();
}

// =============================================================================
// FIRE INCIDENT SERVICE: บันทึกเหตุไฟป่า
// =============================================================================
const FIRE_INCIDENTS_FOLDER_NAME = 'FireIncidents';

function getOrCreateFireIncidentsFolder() {
  const root = DriveApp.getFolderById(FOLDER_ID);
  const folders = root.getFoldersByName(FIRE_INCIDENTS_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return root.createFolder(FIRE_INCIDENTS_FOLDER_NAME);
}

function saveFireIncident(data) {
  try {
    const folder = getOrCreateFireIncidentsFolder();

    // สร้างชื่อไฟล์ตาม ID (Timestamp)
    const fileName = `incident_${data.id || Date.now()}.json`;

    // เพิ่ม metadata
    const incidentData = {
      ...data,
      savedAt: new Date().toISOString(),
      savedBy: 'system'
    };

    // ถ้ามีรูปภาพ Base64 ให้บันทึกแยกเป็นไฟล์
    if (data.images && data.images.length > 0) {
      const imageFolder = getOrCreateFolder(folder, `images_${data.id || Date.now()}`);
      const imageUrls = [];

      data.images.forEach((base64Image, index) => {
        try {
          const imageBlob = Utilities.newBlob(
            Utilities.base64Decode(base64Image.split(',')[1]),
            'image/jpeg',
            `incident_image_${index + 1}.jpg`
          );
          const file = imageFolder.createFile(imageBlob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          imageUrls.push(file.getUrl());
        } catch (e) {
          Logger.log('Error saving incident image: ' + e);
        }
      });

      // แทนที่ Base64 ด้วย URLs เพื่อลดขนาด JSON
      incidentData.imageUrls = imageUrls;
      delete incidentData.images;
    }

    // บันทึก JSON
    folder.createFile(fileName, JSON.stringify(incidentData, null, 2), MimeType.PLAIN_TEXT);

    // ส่งแจ้งเตือน LINE (ถ้าตั้งค่าไว้)
    if (CHANNEL_ACCESS_TOKEN && GROUP_ID) {
      sendFireIncidentNotification(incidentData);
    }

    return { success: true, message: 'บันทึกเหตุไฟป่าสำเร็จ', id: incidentData.id };

  } catch (e) {
    Logger.log('Error saving fire incident: ' + e);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function getFireIncidents() {
  try {
    const folder = getOrCreateFireIncidentsFolder();
    const files = folder.getFiles();
    const incidents = [];

    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      if (name.startsWith('incident_') && name.endsWith('.json')) {
        try {
          const content = file.getBlob().getDataAsString();
          incidents.push(JSON.parse(content));
        } catch (e) {
          Logger.log('Error parsing incident file: ' + name);
        }
      }
    }

    // เรียงลำดับจากใหม่ไปเก่า
    incidents.sort((a, b) => {
      const dateA = new Date(b.timestamp || b.savedAt || 0);
      const dateB = new Date(a.timestamp || a.savedAt || 0);
      return dateA - dateB;
    });

    return incidents;

  } catch (e) {
    Logger.log('Error fetching fire incidents: ' + e);
    return [];
  }
}

function getFireIncidentStats() {
  const incidents = getFireIncidents();

  if (incidents.length === 0) {
    return {
      totalIncidents: 0,
      avgResponseTime: 0,
      avgOperationTime: 0,
      totalDamageArea: 0,
      recentIncidents: []
    };
  }

  let totalResponseTime = 0;
  let totalOperationTime = 0;
  let totalDamageArea = 0;
  let validResponseCount = 0;
  let validOperationCount = 0;

  incidents.forEach(incident => {
    // คำนวณเวลาตอบสนอง (จากพบเจอถึงไปถึง)
    if (incident.foundTime && incident.reachedTime) {
      const found = new Date(incident.foundTime);
      const reached = new Date(incident.reachedTime);
      const diff = (reached - found) / (1000 * 60); // นาที
      if (diff > 0 && diff < 1440) { // ไม่เกิน 24 ชม
        totalResponseTime += diff;
        validResponseCount++;
      }
    }

    // คำนวณเวลาปฏิบัติงาน (จากไปถึงถึงดับสำเร็จ)
    if (incident.reachedTime && incident.extinguishedTime) {
      const reached = new Date(incident.reachedTime);
      const extinguished = new Date(incident.extinguishedTime);
      const diff = (extinguished - reached) / (1000 * 60); // นาที
      if (diff > 0 && diff < 1440) {
        totalOperationTime += diff;
        validOperationCount++;
      }
    }

    // คำนวณพื้นที่เสียหาย (ไร่)
    if (incident.damageArea) {
      const rai = parseFloat(incident.damageArea.rai) || 0;
      const ngan = (parseFloat(incident.damageArea.ngan) || 0) / 4;
      const wa = (parseFloat(incident.damageArea.wa) || 0) / 400;
      totalDamageArea += rai + ngan + wa;
    }
  });

  return {
    totalIncidents: incidents.length,
    avgResponseTime: validResponseCount > 0 ? Math.round(totalResponseTime / validResponseCount) : 0,
    avgOperationTime: validOperationCount > 0 ? Math.round(totalOperationTime / validOperationCount) : 0,
    totalDamageArea: Math.round(totalDamageArea * 100) / 100,
    recentIncidents: incidents.slice(0, 5).map(i => ({
      id: i.id,
      date: i.date,
      location: i.location,
      damageArea: i.damageArea,
      status: i.extinguishedTime ? 'ดับสำเร็จ' : 'กำลังดำเนินการ'
    }))
  };
}

// =============================================================================
// ANNOUNCEMENT SERVICE: ระบบประกาศ
// =============================================================================

const ANNOUNCEMENTS_FOLDER_NAME = 'Announcements';

function getOrCreateAnnouncementsFolder() {
  const root = DriveApp.getFolderById(FOLDER_ID);
  const folders = root.getFoldersByName(ANNOUNCEMENTS_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return root.createFolder(ANNOUNCEMENTS_FOLDER_NAME);
}

function createAnnouncement(data) {
  try {
    const folder = getOrCreateAnnouncementsFolder();

    const announcement = {
      id: data.id || 'ann_' + Date.now(),
      title: data.title,
      message: data.message,
      level: data.level || 'info', // info, warning, critical
      imageUrl: data.imageUrl || null,
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt || null,
      isActive: true
    };

    // ถ้ามีรูปภาพ Base64 ให้บันทึกแยก
    if (data.image && data.image.startsWith('data:image')) {
      try {
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(data.image.split(',')[1]),
          'image/jpeg',
          `announcement_${announcement.id}.jpg`
        );
        const imageFile = folder.createFile(imageBlob);
        imageFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        announcement.imageUrl = imageFile.getUrl();
      } catch (e) {
        Logger.log('Error saving announcement image: ' + e);
      }
    }

    const fileName = `${announcement.id}.json`;
    folder.createFile(fileName, JSON.stringify(announcement, null, 2), MimeType.PLAIN_TEXT);

    return { success: true, message: 'สร้างประกาศสำเร็จ', id: announcement.id };

  } catch (e) {
    Logger.log('Error creating announcement: ' + e);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function getAnnouncements() {
  try {
    const folder = getOrCreateAnnouncementsFolder();
    const files = folder.getFiles();
    const announcements = [];
    const now = new Date();

    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      if (name.endsWith('.json')) {
        try {
          const content = file.getBlob().getDataAsString();
          const ann = JSON.parse(content);

          // กรองเฉพาะประกาศที่ยัง active และยังไม่หมดอายุ
          if (ann.isActive !== false) {
            if (!ann.expiresAt || new Date(ann.expiresAt) > now) {
              announcements.push(ann);
            }
          }
        } catch (e) {
          Logger.log('Error parsing announcement file: ' + name);
        }
      }
    }

    // เรียงลำดับ: critical > warning > info, แล้วตามวันที่
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    announcements.sort((a, b) => {
      const levelDiff = (levelOrder[a.level] || 2) - (levelOrder[b.level] || 2);
      if (levelDiff !== 0) return levelDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return announcements;

  } catch (e) {
    Logger.log('Error fetching announcements: ' + e);
    return [];
  }
}

function updateAnnouncement(data) {
  try {
    const folder = getOrCreateAnnouncementsFolder();
    const files = folder.getFilesByName(`${data.id}.json`);
    if (!files.hasNext()) {
      return { success: false, message: 'ไม่พบประกาศที่ต้องการแก้ไข' };
    }

    const file = files.next();
    let ann = {};
    try {
      const content = file.getBlob().getDataAsString();
      ann = JSON.parse(content);
    } catch (e) {}

    const updated = {
      id: ann.id || data.id,
      title: data.title !== undefined ? data.title : ann.title,
      message: data.message !== undefined ? data.message : ann.message,
      level: data.level !== undefined ? data.level : (ann.level || 'info'),
      imageUrl: ann.imageUrl || null,
      createdAt: ann.createdAt || new Date().toISOString(),
      expiresAt: data.expiresAt !== undefined ? data.expiresAt : (ann.expiresAt || null),
      isActive: data.isActive !== undefined ? data.isActive : (ann.isActive !== false)
    };

    if (data.image && typeof data.image === 'string' && data.image.startsWith('data:image')) {
      try {
        const imageBlob = Utilities.newBlob(
          Utilities.base64Decode(data.image.split(',')[1]),
          'image/jpeg',
          `announcement_${updated.id}.jpg`
        );
        const imageFile = folder.createFile(imageBlob);
        imageFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        updated.imageUrl = imageFile.getUrl();
      } catch (e) {
        Logger.log('Error saving updated announcement image: ' + e);
      }
    } else if (data.imageUrl !== undefined) {
      updated.imageUrl = data.imageUrl;
    }

    file.setContent(JSON.stringify(updated, null, 2));

    return { success: true, message: 'แก้ไขประกาศสำเร็จ', id: updated.id };

  } catch (e) {
    Logger.log('Error updating announcement: ' + e);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

function deleteAnnouncement(id) {
  try {
    const folder = getOrCreateAnnouncementsFolder();
    const files = folder.getFilesByName(`${id}.json`);

    if (files.hasNext()) {
      files.next().setTrashed(true);
      return { success: true, message: 'ลบประกาศสำเร็จ' };
    }

    return { success: false, message: 'ไม่พบประกาศที่ต้องการลบ' };

  } catch (e) {
    Logger.log('Error deleting announcement: ' + e);
    return { success: false, message: 'เกิดข้อผิดพลาด: ' + e.toString() };
  }
}

// =============================================================================
// LINE BOT NOTIFICATIONS
// =============================================================================

function sendFireIncidentNotification(incident) {
  if (!CHANNEL_ACCESS_TOKEN || !GROUP_ID) return;

  const message = {
    type: 'flex',
    altText: '🔥 แจ้งเหตุไฟป่า!',
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#dc2626',
        contents: [
          {
            type: 'text',
            text: '🔥 แจ้งเหตุไฟป่า!',
            color: '#ffffff',
            weight: 'bold',
            size: 'lg'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'วันที่:', size: 'sm', color: '#666666', flex: 2 },
              { type: 'text', text: incident.date || '-', size: 'sm', flex: 5 }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'พิกัด:', size: 'sm', color: '#666666', flex: 2 },
              { type: 'text', text: incident.location ? `${incident.location.lat}, ${incident.location.lng}` : '-', size: 'sm', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'พื้นที่:', size: 'sm', color: '#666666', flex: 2 },
              { type: 'text', text: incident.damageArea ? `${incident.damageArea.rai || 0} ไร่ ${incident.damageArea.ngan || 0} งาน ${incident.damageArea.wa || 0} ตร.วา` : '-', size: 'sm', flex: 5, wrap: true }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'เจ้าหน้าที่:', size: 'sm', color: '#666666', flex: 2 },
              { type: 'text', text: incident.staffCount ? `${incident.staffCount} คน` : '-', size: 'sm', flex: 5 }
            ]
          }
        ]
      }
    }
  };

  pushLineMessage(message);
}

function pushLineMessage(message) {
  if (!CHANNEL_ACCESS_TOKEN || !GROUP_ID) return;

  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: GROUP_ID,
    messages: [message]
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('Error sending LINE message: ' + e);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

// =============================================================================
// SETUP FUNCTIONS (รันครั้งเดียวเมื่อตั้งค่าครั้งแรก)
// =============================================================================

/**
 * ตั้งค่า Script Properties (รันครั้งเดียว)
 * ไปที่ Run > Run function > setupScriptProperties
 */
function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();

  // ตั้งค่าเหล่านี้ตามความเหมาะสม
  props.setProperties({
    'FOLDER_ID': '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ',
    'CHANNEL_ACCESS_TOKEN': '', // ใส่ LINE Channel Access Token
    'GROUP_ID': '' // ใส่ LINE Group ID
  });

  Logger.log('Script properties set successfully!');
}

/**
 * ตั้งค่า Triggers สำหรับการแจ้งเตือนอัตโนมัติ
 */
function setupTriggers() {
  // ลบ triggers เก่าทั้งหมด
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // ตั้ง triggers ใหม่
  ScriptApp.newTrigger('sendMorningNotification')
    .timeBased()
    .atHour(10)
    .everyDays(1)
    .inTimezone('Asia/Bangkok')
    .create();

  ScriptApp.newTrigger('sendAfternoonNotification')
    .timeBased()
    .atHour(14)
    .everyDays(1)
    .inTimezone('Asia/Bangkok')
    .create();

  ScriptApp.newTrigger('sendEveningNotification')
    .timeBased()
    .atHour(18)
    .everyDays(1)
    .inTimezone('Asia/Bangkok')
    .create();

  ScriptApp.newTrigger('sendDailySummary')
    .timeBased()
    .atHour(19)
    .everyDays(1)
    .inTimezone('Asia/Bangkok')
    .create();

  Logger.log('Triggers set successfully!');
}

// Trigger functions
function sendMorningNotification() {
  sendShiftNotification('ภาคเช้า');
}

function sendAfternoonNotification() {
  sendShiftNotification('ภาคกลางวัน');
}

function sendEveningNotification() {
  sendShiftNotification('ภาคเย็น');
}

function sendShiftNotification(shift) {
  if (!CHANNEL_ACCESS_TOKEN || !GROUP_ID) return;

  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const reports = getDashboardData(today);
  const completedShift = reports.filter(r => r.shift === shift);
  const percentage = Math.round((completedShift.length / TOTAL_WATCH_POINTS) * 100);

  const color = percentage === 100 ? '#10b981' : (percentage >= 70 ? '#f59e0b' : '#ef4444');

  const message = {
    type: 'flex',
    altText: `สรุปสถานะ ${shift}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `📊 สรุป ${shift}`, weight: 'bold', size: 'lg' },
          { type: 'text', text: today, size: 'sm', color: '#999999' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'ส่งแล้ว:', size: 'sm', flex: 3 },
              { type: 'text', text: `${completedShift.length}/${TOTAL_WATCH_POINTS} จุด`, size: 'sm', flex: 4, align: 'end' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ความครบถ้วน:', size: 'sm', flex: 3 },
              { type: 'text', text: `${percentage}%`, size: 'sm', flex: 4, align: 'end', color: color, weight: 'bold' }
            ]
          }
        ]
      }
    }
  };

  pushLineMessage(message);
}

function sendDailySummary() {
  if (!CHANNEL_ACCESS_TOKEN || !GROUP_ID) return;

  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const reports = getDashboardData(today);
  const totalRequired = TOTAL_WATCH_POINTS * 3; // 20 จุด x 3 กะ
  const percentage = Math.round((reports.length / totalRequired) * 100);

  const fireStats = getFireIncidentStats();

  const message = {
    type: 'flex',
    altText: '📋 สรุปประจำวัน',
    contents: {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1e40af',
        contents: [
          { type: 'text', text: '📋 สรุปประจำวัน', color: '#ffffff', weight: 'bold', size: 'lg' },
          { type: 'text', text: today, color: '#93c5fd', size: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '📊 รายงานประจำวัน', weight: 'bold', size: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ส่งครบ:', size: 'sm', flex: 3 },
              { type: 'text', text: `${reports.length}/${totalRequired} รายการ (${percentage}%)`, size: 'sm', flex: 5, align: 'end' }
            ]
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '🔥 สถิติเหตุไฟป่า', weight: 'bold', size: 'md', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'เหตุการณ์ทั้งหมด:', size: 'sm', flex: 4 },
              { type: 'text', text: `${fireStats.totalIncidents} ครั้ง`, size: 'sm', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'เวลาตอบสนองเฉลี่ย:', size: 'sm', flex: 4 },
              { type: 'text', text: `${fireStats.avgResponseTime} นาที`, size: 'sm', flex: 3, align: 'end' }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'พื้นที่เสียหายรวม:', size: 'sm', flex: 4 },
              { type: 'text', text: `${fireStats.totalDamageArea} ไร่`, size: 'sm', flex: 3, align: 'end' }
            ]
          }
        ]
      }
    }
  };

  pushLineMessage(message);
}
