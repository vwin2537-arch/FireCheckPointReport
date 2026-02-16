// =============================================================================
// Fire Incident Service - ระบบบันทึกข้อมูลเหตุไฟป่า (JSON Storage)
// =============================================================================

const FIRE_INCIDENTS_FOLDER_NAME = 'FireIncidents';

/**
 * สร้างโฟลเดอร์สำหรับเก็บข้อมูลเหตุไฟป่า (ถ้ายังไม่มี)
 */
function getOrCreateFireIncidentsFolder() {
    const root = DriveApp.getFolderById(FOLDER_ID); // ใช้ FOLDER_ID เดียวกับรูปภาพ
    const folders = root.getFoldersByName(FIRE_INCIDENTS_FOLDER_NAME);
    if (folders.hasNext()) {
        return folders.next();
    } else {
        return root.createFolder(FIRE_INCIDENTS_FOLDER_NAME);
    }
}

/**
 * API: บันทึกเหตุไฟป่า
 */
function saveFireIncident(data) {
    try {
        const parentFolder = getOrCreateFireIncidentsFolder();

        // สร้างชื่อไฟล์ตาม ID (Timestamp)
        const fileName = `incident_${data.id}.json`;

        // บันทึกเนื้อหา JSON
        const file = parentFolder.createFile(fileName, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);

        // ถ้ามีรูปภาพ (Base64) ให้บันทึกเป็นไฟล์รูปแยกต่างหาก (Optional) เพื่อไม่ให้ JSON ใหญ่เกิน
        // แต่เพื่อความง่ายในเวอร์ชั่นแรก จะเก็บรวมใน JSON ไปก่อน

        return { success: true, message: 'บันทึกเหตุไฟป่าสำเร็จ' };
    } catch (e) {
        return { success: false, message: 'Error saving incident: ' + e.toString() };
    }
}

/**
 * API: ดึงข้อมูลเหตุไฟป่าทั้งหมด
 */
function getFireIncidents() {
    try {
        const folder = getOrCreateFireIncidentsFolder();
        const files = folder.getFiles();
        const incidents = [];

        while (files.hasNext()) {
            const file = files.next();
            if (file.getName().startsWith('incident_') && file.getName().endsWith('.json')) {
                const content = file.getBlob().getDataAsString();
                incidents.push(JSON.parse(content));
            }
        }

        // เรียงลำดับจากใหม่ไปเก่า
        incidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return incidents;
    } catch (e) {
        Logger.log('Error fetching incidents: ' + e);
        return [];
    }
}

// =============================================================================
// อัปเดตฟังก์ชัน doPost/doGet เดิมให้รองรับ Action นี้
// =============================================================================
/*
  Copy โค้ดส่วนนี้ไปแปะเพิ่มในฟังก์ชัน doPost(e) ของไฟล์หลัก (Code.gs)
  
  if (data.action === 'saveFireIncident') {
      const result = saveFireIncident(data.payload);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
*/

/*
  Copy โค้ดส่วนนี้ไปแปะเพิ่มในฟังก์ชัน doGet(e) ของไฟล์หลัก (Code.gs)
  
  if (e.parameter.action === 'getFireIncidents') {
      const data = getFireIncidents();
      return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
*/
