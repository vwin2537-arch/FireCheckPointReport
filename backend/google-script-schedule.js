// -----------------------------------------------------------------------------
// ตั้งค่า: ใส่ข้อมูลของท่านตรงนี้
// -----------------------------------------------------------------------------
const CHANNEL_ACCESS_TOKEN = 'ใส่_Channel_Access_Token_ที่นี่';
const GROUP_ID = 'ใส่_Group_ID_ที่นี่'; // รันฟังก์ชัน getGroupId เพื่อหาค่านี้
const FOLDER_ID = '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ'; // โฟลเดอร์ที่เก็บรูป

// -----------------------------------------------------------------------------
// ฟังก์ชันหลัก: ส่งสรุปรายกะ (Trigger เวลา 10:00, 14:00, 18:00)
// -----------------------------------------------------------------------------
function sendShiftSummary() {
    const now = new Date();
    const hour = now.getHours();
    let shiftName = '';

    if (hour < 12) shiftName = 'ภาคเช้า';
    else if (hour < 16) shiftName = 'ภาคบ่าย';
    else shiftName = 'ภาคเย็น';

    const todayStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    const reportData = getReportsForDate(todayStr, shiftName);

    const message = createFlexMessage(shiftName, todayStr, reportData);
    pushLineMessage(message);
}

// -----------------------------------------------------------------------------
// ฟังก์ชันหาข้อมูลรายงานจากโฟลเดอร์ Google Drive
// -----------------------------------------------------------------------------
function getReportsForDate(dateStr, shift) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const folders = folder.getFolders();
    let completedPoints = [];
    let totalPoints = 0; // สมมติว่านับจากโฟลเดอร์ทั้งหมดที่มีอยู่จริง

    // ในที่นี้เราจะนับ "โฟลเดอร์จุดเฝ้าระวัง"
    // โครงสร้าง: จุดตรวจ > วันที่ > กะ > ไฟล์รูป

    while (folders.hasNext()) {
        const pointFolder = folders.next();
        totalPoints++;
        const pointName = pointFolder.getName();

        // ลองหาโฟลเดอร์วันที่
        const dateIter = pointFolder.getFoldersByName(dateStr);
        if (dateIter.hasNext()) {
            const dateFolder = dateIter.next();
            // ลองหาโฟลเดอร์กะ
            const shiftIter = dateFolder.getFoldersByName(shift);
            if (shiftIter.hasNext()) {
                const shiftFolder = shiftIter.next();
                // เช็คว่ามีรูปไหม
                if (shiftFolder.getFiles().hasNext()) {
                    completedPoints.push(pointName);
                }
            }
        }
    }

    return {
        accepted: completedPoints,
        missing: totalPoints - completedPoints.length,
        total: totalPoints
    };
}

// -----------------------------------------------------------------------------
// สร้างข้อความสวยงาม (Flex Message)
// -----------------------------------------------------------------------------
function createFlexMessage(shift, date, data) {
    const percent = Math.round((data.accepted.length / data.total) * 100);
    const color = percent === 100 ? '#10b981' : (percent > 50 ? '#f59e0b' : '#ef4444');

    return {
        "type": "flex",
        "altText": `สรุปสถานะ ${shift}`,
        "contents": {
            "type": "bubble",
            "size": "giga",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🔥 รายงานสรุปไฟป่า",
                        "weight": "bold",
                        "color": "#1db446",
                        "size": "sm"
                    },
                    {
                        "type": "text",
                        "text": `สรุปผล ${shift}`,
                        "weight": "bold",
                        "size": "xl",
                        "margin": "md"
                    },
                    {
                        "type": "text",
                        "text": date,
                        "size": "xs",
                        "color": "#aaaaaa",
                        "wrap": true
                    },
                    {
                        "type": "separator",
                        "margin": "xxl"
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "xxl",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": "ส่งแล้ว",
                                        "size": "sm",
                                        "color": "#555555",
                                        "flex": 0
                                    },
                                    {
                                        "type": "text",
                                        "text": `${data.accepted.length} จุด`,
                                        "size": "sm",
                                        "color": "#111111",
                                        "align": "end"
                                    }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": "ยังไม่ส่ง",
                                        "size": "sm",
                                        "color": "#555555",
                                        "flex": 0
                                    },
                                    {
                                        "type": "text",
                                        "text": `${data.missing} จุด`,
                                        "size": "sm",
                                        "color": "#ff0000",
                                        "align": "end",
                                        "weight": "bold"
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        "type": "separator",
                        "margin": "xxl"
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "margin": "md",
                        "contents": [
                            {
                                "type": "text",
                                "text": "ความคืบหน้า",
                                "size": "xs",
                                "color": "#aaaaaa",
                                "flex": 0
                            },
                            {
                                "type": "text",
                                "text": `${percent}%`,
                                "color": color,
                                "size": "xs",
                                "align": "end"
                            }
                        ]
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "backgroundColor": "#e0e0e0",
                                "height": "6px",
                                "cornerRadius": "20px",
                                "contents": [
                                    {
                                        "type": "box",
                                        "layout": "vertical",
                                        "backgroundColor": color,
                                        "width": `${percent}%`,
                                        "height": "6px",
                                        "cornerRadius": "20px"
                                    }
                                ]
                            }
                        ],
                        "margin": "sm"
                    }
                ]
            }
        }
    };
}

// -----------------------------------------------------------------------------
// ยิง API ไปที่ LINE
// -----------------------------------------------------------------------------
function pushLineMessage(flexMessage) {
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
        to: GROUP_ID,
        messages: [flexMessage]
    };

    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        payload: JSON.stringify(payload)
    };

    try {
        UrlFetchApp.fetch(url, options);
    } catch (e) {
        Logger.log('Error sending line message: ' + e);
    }
}
