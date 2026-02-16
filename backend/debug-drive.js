function debugDriveStructure() {
    // 1. ระบุ ID โฟลเดอร์หลักให้ถูกต้อง
    const FOLDER_ID = '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ';

    // 2. กำหนดวันที่ที่ต้องการตรวจสอบ (ควรเป็นวันนี้ หรือวันที่มั่นใจว่ามีการส่ง)
    const today = new Date();
    // ลองทั้งสองรูปแบบเผื่อมีความคลาดเคลื่อน
    const dateStr = Utilities.formatDate(today, 'Asia/Bangkok', 'yyyy-MM-dd');

    Logger.log('=== START DEBUG ===');
    Logger.log('Date to check: ' + dateStr);

    try {
        const rootFolder = DriveApp.getFolderById(FOLDER_ID);
        Logger.log('Root Folder Name: ' + rootFolder.getName());

        const pointFolders = rootFolder.getFolders();
        let pointCount = 0;

        while (pointFolders.hasNext()) {
            const pf = pointFolders.next();
            const pfName = pf.getName();

            // LOG ทุกโฟลเดอร์ที่เจอเพื่อดูชื่อจริง
            Logger.log(`[Scan] Found Folder: "${pfName}"`);

            // กรองดูเฉพาะจุดเฝ้าระวัง
            if (pfName.includes('จุดเฝ้าระวัง') || pfName.includes('จุดที่')) {
                pointCount++;
                Logger.log(`[Point] Found: "${pfName}"`);

                // ดูข้างในว่ามีโฟลเดอร์วันที่ไหม
                const dateFolders = pf.getFolders();
                while (dateFolders.hasNext()) {
                    const df = dateFolders.next();
                    const dfName = df.getName();
                    Logger.log(`   -> Date Folder: "${dfName}"`);

                    if (dfName === dateStr) {
                        // ดูข้างในว่ามีกะไหม
                        const shiftFolders = df.getFolders();
                        while (shiftFolders.hasNext()) {
                            const sf = shiftFolders.next();
                            const sfName = sf.getName();
                            const fileCount = sf.getFiles().hasNext() ? 'Has Files' : 'Empty';
                            Logger.log(`      -> Shift: "${sfName}" [${fileCount}]`);
                        }
                    }
                }
            }
        }

        Logger.log(`Total Points Found: ${pointCount}`);

    } catch (e) {
        Logger.log('ERROR: ' + e.toString());
    }
    Logger.log('=== END DEBUG ===');
}
