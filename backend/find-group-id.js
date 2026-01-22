// =============================================================================
// วิธีหา GROUP ID - Version 3 (Push API Method)
// =============================================================================
// วิธีใหม่: แทนที่จะ Reply กลับในกลุ่มใหม่ จะใช้ Push API ส่ง Group ID ไปกลุ่มทดสอบแทน!
// =============================================================================

const CHANNEL_ACCESS_TOKEN = '0aukhwekDqlNNEE2/6vXSA0zU+zG1XnCGbwvWfeJfRyb7Ax8bFGtfGaLL9nxlGckV0aYXJglTceespVYuffxUMvcbnfLy4O2gtbXWlsyc2nXxAdDgTaf9IXZ0yLnYP/tezONF+9bDCiZnnJOGql0cQdB04t89/1O/w1cDnyilFU=';

// Group ID กลุ่มทดสอบ (ที่ใช้งานได้)
const TEST_GROUP_ID = 'C67a8652605c9755ea9c85e8e7cc0504b';

function doPost(e) {
    try {
        console.log('Received webhook');

        const data = JSON.parse(e.postData.contents);

        if (!data.events || data.events.length === 0) {
            console.log('No events');
            return ContentService.createTextOutput('OK');
        }

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

            console.log('TYPE: ' + type);
            console.log('ID: ' + id);

            // บันทึกลง Properties เพื่อดึงใช้ทีหลัง
            PropertiesService.getScriptProperties().setProperty('LAST_GROUP_ID', id);
            PropertiesService.getScriptProperties().setProperty('LAST_TYPE', type);

            // ส่ง Push ไปกลุ่มทดสอบแทน reply (เพราะ reply ไม่ทำงาน)
            pushToTestGroup('🔔 พบ ID ใหม่!\n\nType: ' + type + '\nID: ' + id);
        }

        return ContentService.createTextOutput('OK');

    } catch (error) {
        console.log('ERROR: ' + error.toString());
        pushToTestGroup('❌ Error: ' + error.toString());
        return ContentService.createTextOutput('Error');
    }
}

// ส่งข้อความไปกลุ่มทดสอบ
function pushToTestGroup(message) {
    const url = 'https://api.line.me/v2/bot/message/push';
    const options = {
        'method': 'post',
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        'payload': JSON.stringify({
            'to': TEST_GROUP_ID,
            'messages': [{
                'type': 'text',
                'text': message
            }]
        }),
        'muteHttpExceptions': true
    };

    UrlFetchApp.fetch(url, options);
}

// รันด้วยมือเพื่อดู Group ID ล่าสุดที่บันทึกไว้
function showLastGroupId() {
    const id = PropertiesService.getScriptProperties().getProperty('LAST_GROUP_ID');
    const type = PropertiesService.getScriptProperties().getProperty('LAST_TYPE');
    console.log('Last saved: ' + type + ' = ' + id);

    if (id) {
        pushToTestGroup('📋 Group ID ล่าสุดที่บันทึก:\n' + id);
    } else {
        console.log('No saved Group ID');
    }
}

// ทดสอบส่งข้อความไปกลุ่มทดสอบ
function testPush() {
    pushToTestGroup('✅ Test Push API - ทำงานปกติ!');
}
