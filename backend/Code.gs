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

  // ล้าง Cache เมื่อมีข้อมูลใหม่
  CacheService.getScriptCache().remove('dashboard_' + data.date);

  return {
    success: true,
    message: `บันทึก ${savedCount} รูปภาพเรียบร้อยแล้ว`,
    savedCount: savedCount
  };
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
