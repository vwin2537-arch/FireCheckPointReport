// -----------------------------------------------------------------------------
// วิธีหา GROUP ID (สำหรับ Messaging API)
// -----------------------------------------------------------------------------
// 1. นำโค้ดนี้ไปวางใน Google Apps Script (ไฟล์ใหม่)
// 2. กด Deploy -> New Deployment -> เลือก Type เป็น "Web app"
//    - Execute as: Me
//    - Who has access: Anyone
// 3. ก๊อปปี้ URL ที่ได้ (Web App URL)
// 4. เอาไปใส่ใน LINE Developers Console > Messaging API > Webhook URL
// 5. กดเปิด "Use Webhook"
// 6. ลองพิมพ์ข้อความอะไรก็ได้ลงในกลุ่มไลน์ที่มีบอทอยู่
// 7. กลับมาดูที่ Google Sheet (หรือ Log) โค้ดนี้จะบันทึก Group ID ให้ครับ

function doPost(e) {
    const data = JSON.parse(e.postData.contents);
    const event = data.events[0];

    if (event.type === 'message') {
        const source = event.source;
        let id = '';
        let type = '';

        if (source.type === 'group') {
            id = source.groupId;
            type = 'Group ID';
        } else if (source.type === 'room') {
            id = source.roomId;
            type = 'Room ID';
        } else {
            id = source.userId;
            type = 'User ID';
        }

        // บันทึกลง Log (กดดูที่เมนู Executions ใน GAS)
        console.log(`TYPE: ${type}`);
        console.log(`ID: ${id}`);

        // (Optional) ถ้าอยากให้บอทตอบกลับบอก ID เลย ให้ Uncomment บรรทัดล่างนี้
        // replyMessage(event.replyToken, `ID ของกลุ่มนี้คือ: ${id}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันตอบกลับ (ถ้าต้องการใช้)
function replyMessage(replyToken, text) {
    const CHANNEL_ACCESS_TOKEN = 'ใส่_Token_ชั่วคราวตรงนี้ถ้าจะเทส';
    const url = 'https://api.line.me/v2/bot/message/reply';
    UrlFetchApp.fetch(url, {
        'headers': {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
        },
        'method': 'post',
        'payload': JSON.stringify({
            'replyToken': replyToken,
            'messages': [{
                'type': 'text',
                'text': text,
            }],
        }),
    });
}
