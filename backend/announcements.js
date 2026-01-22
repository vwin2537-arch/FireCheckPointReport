// -----------------------------------------------------------------------------
// ระบบประกาศ (Announcements) - เพิ่มฟังก์ชันนี้ใน Google Apps Script
// -----------------------------------------------------------------------------
// วิธีใช้:
// 1. สร้าง Google Sheet ใหม่ชื่อ "Announcements"
// 2. ใส่หัวคอลัมน์: Date | Title | Content | Type
// 3. Type = "info", "warning", หรือ "event"
// 4. ก๊อปปี้ Sheet ID ไปใส่ด้านล่าง

const ANNOUNCEMENT_SHEET_ID = 'ใส่_Sheet_ID_ที่นี่';

function getAnnouncements() {
    try {
        const sheet = SpreadsheetApp.openById(ANNOUNCEMENT_SHEET_ID).getActiveSheet();
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const rows = data.slice(1);

        // Filter only recent announcements (last 7 days)
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const announcements = rows
            .filter(row => new Date(row[0]) >= weekAgo)
            .map(row => ({
                date: Utilities.formatDate(new Date(row[0]), 'Asia/Bangkok', 'dd/MM/yyyy'),
                title: row[1],
                content: row[2],
                type: row[3] || 'info'
            }))
            .slice(0, 3); // Max 3 announcements

        return announcements;
    } catch (e) {
        console.error('Error fetching announcements:', e);
        return [];
    }
}

// เพิ่มใน doGet เพื่อให้เรียกได้จากแอป
function doGet(e) {
    const action = e.parameter.action;

    if (action === 'announcements') {
        const announcements = getAnnouncements();
        return ContentService
            .createTextOutput(JSON.stringify(announcements))
            .setMimeType(ContentService.MimeType.JSON);
    }

    // ... existing doGet logic ...
}
