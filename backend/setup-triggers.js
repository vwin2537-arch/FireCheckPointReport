// =============================================================================
// Setup Triggers - ตั้งค่า Time-based Triggers สำหรับ LINE Bot
// คัดลอกไฟล์นี้ไปใส่ใน Google Apps Script แล้วรัน setupAllTriggers()
// =============================================================================

/**
 * ตั้งค่า Triggers ทั้งหมด
 * รันฟังก์ชันนี้ครั้งเดียวเพื่อตั้งค่า
 */
function setupAllTriggers() {
    // ลบ Triggers เดิมก่อน
    deleteAllTriggers();

    // 10:00 - แจ้งเตือนภาคเช้า
    ScriptApp.newTrigger('sendMorningNotification')
        .timeBased()
        .atHour(10)
        .everyDays(1)
        .inTimezone('Asia/Bangkok')
        .create();
    Logger.log('✅ สร้าง Trigger ภาคเช้า (10:00) สำเร็จ');

    // 14:00 - แจ้งเตือนภาคกลางวัน
    ScriptApp.newTrigger('sendAfternoonNotification')
        .timeBased()
        .atHour(14)
        .everyDays(1)
        .inTimezone('Asia/Bangkok')
        .create();
    Logger.log('✅ สร้าง Trigger ภาคกลางวัน (14:00) สำเร็จ');

    // 18:00 - แจ้งเตือนภาคเย็น
    ScriptApp.newTrigger('sendEveningNotification')
        .timeBased()
        .atHour(18)
        .everyDays(1)
        .inTimezone('Asia/Bangkok')
        .create();
    Logger.log('✅ สร้าง Trigger ภาคเย็น (18:00) สำเร็จ');

    // 19:00 - สรุปรายวัน
    ScriptApp.newTrigger('sendDailySummary')
        .timeBased()
        .atHour(19)
        .everyDays(1)
        .inTimezone('Asia/Bangkok')
        .create();
    Logger.log('✅ สร้าง Trigger สรุปรายวัน (19:00) สำเร็จ');

    Logger.log('🎉 ตั้งค่า Triggers ทั้งหมดเรียบร้อย!');
}

/**
 * ลบ Triggers ทั้งหมด
 */
function deleteAllTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
        ScriptApp.deleteTrigger(trigger);
    });
    Logger.log('🗑️ ลบ Triggers เดิมทั้งหมดแล้ว');
}

/**
 * แสดงรายการ Triggers ที่มีอยู่
 */
function listAllTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    if (triggers.length === 0) {
        Logger.log('❌ ไม่มี Triggers ที่ตั้งค่าไว้');
        return;
    }

    Logger.log('📋 รายการ Triggers ที่ตั้งค่าไว้:');
    triggers.forEach((trigger, index) => {
        Logger.log(`${index + 1}. ${trigger.getHandlerFunction()} - ${trigger.getEventType()}`);
    });
}
