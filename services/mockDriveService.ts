
import { SubmissionResult, Shift } from '../types';

// ** สำคัญ **: ตรวจสอบ URL นี้ให้เป็น URL ล่าสุดจากการ Deploy (New Deployment)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9uB5fl4o2YeDQ7msFotRFCSNcMal_BJ_Uf_6ImhhllvIaIKFEVWuqa-FEqfF8Y17i-A/exec';
export const TARGET_FOLDER_ID = '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ';

export const submitReport = async (
  pointName: string,
  shift: Shift,
  images: string[],
  notes: string,
  selectedDate: string
): Promise<SubmissionResult> => {

  try {
    const payload = {
      parentFolderId: TARGET_FOLDER_ID,
      date: selectedDate,
      pointName: pointName,
      shift: shift,
      images: images,
      notes: notes
    };

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Network response was not ok');

    return {
      success: true,
      message: `บันทึกรูปภาพลงในโฟลเดอร์ ${pointName} > ${shift} เรียบร้อยแล้ว`,
    };
  } catch (error) {
    console.error('Submission error:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
    };
  }
};

export const fetchDashboardData = async (date: string): Promise<any[]> => {
  try {
    // ใช้ Cache Buster เพื่อให้ได้ข้อมูลล่าสุดเสมอ
    const response = await fetch(`${GOOGLE_SCRIPT_URL}?date=${date}&t=${Date.now()}`);
    if (!response.ok) return [];
    const data = await response.json();
    // คาดหวังรูปแบบ: [{pointName: "...", shift: "ภาคเช้า"}, ...]
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Dashboard fetch error:", e);
    return [];
  }
};

// --- Services for Announcements (Hybrid Mode) ---

export const fetchAnnouncements = async (): Promise<any[]> => {
  try {
    // 1. Try fetching from GAS (Future implementation response expectation)
    // const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAnnouncements&t=${Date.now()}`);
    // if (response.ok) return await response.json();

    // 2. Fallback: LocalStorage (For immediate testing)
    const localData = localStorage.getItem('announcements');
    return localData ? JSON.parse(localData) : [];
  } catch (e) {
    console.error("Fetch announcements error:", e);
    return [];
  }
};

export const createAnnouncement = async (announcement: any): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Try sending to GAS (Mocking the call structure)
    /*
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'createAnnouncement',
        ...announcement
      }),
    });
    */

    // 2. Fallback: Save to LocalStorage (For immediate testing)
    const current = await fetchAnnouncements();
    const updated = [announcement, ...current];
    localStorage.setItem('announcements', JSON.stringify(updated));

    return { success: true, message: 'ลงประกาศเรียบร้อยแล้ว (Local Mode)' };
  } catch (e) {
    console.error("Create announcement error:", e);
    return { success: false, message: 'เกิดข้อผิดพลาดในการลงประกาศ' };
  }
};

export const deleteAnnouncement = async (id: string): Promise<boolean> => {
  try {
    // Local delete
    const current = await fetchAnnouncements();
    const updated = current.filter((a: any) => a.id !== id);
    localStorage.setItem('announcements', JSON.stringify(updated));
    return true;
  } catch (e) {
    return false;
  }
};
