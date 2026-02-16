
import { SubmissionResult, Shift } from '../types';

// ** สำคัญ **: ตรวจสอบ URL นี้ให้เป็น URL ล่าสุดจากการ Deploy (New Deployment)
// หลังจาก deploy Code.gs ใหม่ ให้อัปเดต URL นี้
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx9uB5fl4o2YeDQ7msFotRFCSNcMal_BJ_Uf_6ImhhllvIaIKFEVWuqa-FEqfF8Y17i-A/exec';
export const TARGET_FOLDER_ID = '1tSGasMDHMNyfudAc4GGJqyc7XPXXH-hQ';

// ตั้งค่า: ใช้ Backend จริงหรือ LocalStorage
const USE_BACKEND_API = true; // เปลี่ยนเป็น true เมื่อ deploy backend แล้ว

const normalizeImageUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([^&]+)/);
  if (match?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  return url;
};

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

// --- Services for Announcements ---

export const fetchAnnouncements = async (): Promise<any[]> => {
  try {
    if (USE_BACKEND_API) {
      // เรียก API จาก Backend
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAnnouncements&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        const normalized = (Array.isArray(data) ? data : []).map((item: any) => ({
          ...item,
          imageUrl: normalizeImageUrl(item.imageUrl ?? item.image ?? item.posterUrl ?? item.poster ?? null),
          timestamp: item.timestamp ?? item.createdAt ?? item.date ?? new Date().toISOString(),
          createdAt: item.createdAt ?? item.timestamp ?? item.date ?? new Date().toISOString(),
          isActive: item.isActive ?? true
        }));
        // Sync กับ LocalStorage เพื่อใช้งาน Offline
        localStorage.setItem('announcements', JSON.stringify(normalized));
        return normalized;
      }
    }

    // Fallback: LocalStorage
    const localData = localStorage.getItem('announcements');
    const parsed = localData ? JSON.parse(localData) : [];
    return (Array.isArray(parsed) ? parsed : []).map((item: any) => ({
      ...item,
      imageUrl: normalizeImageUrl(item.imageUrl ?? item.image ?? item.posterUrl ?? item.poster ?? null),
      timestamp: item.timestamp ?? item.createdAt ?? item.date ?? new Date().toISOString(),
      createdAt: item.createdAt ?? item.timestamp ?? item.date ?? new Date().toISOString(),
      isActive: item.isActive ?? true
    }));
  } catch (e) {
    console.error("Fetch announcements error:", e);
    // Fallback to local on error
    const localData = localStorage.getItem('announcements');
    const parsed = localData ? JSON.parse(localData) : [];
    return (Array.isArray(parsed) ? parsed : []).map((item: any) => ({
      ...item,
      imageUrl: normalizeImageUrl(item.imageUrl ?? item.image ?? item.posterUrl ?? item.poster ?? null),
      timestamp: item.timestamp ?? item.createdAt ?? item.date ?? new Date().toISOString(),
      createdAt: item.createdAt ?? item.timestamp ?? item.date ?? new Date().toISOString(),
      isActive: item.isActive ?? true
    }));
  }
};

export const createAnnouncement = async (announcement: any): Promise<{ success: boolean; message: string }> => {
  // เพิ่ม ID ถ้ายังไม่มี
  const nowIso = new Date().toISOString();
  const announcementWithId = {
    ...announcement,
    id: announcement.id || 'ann_' + Date.now(),
    imageUrl: normalizeImageUrl(announcement.imageUrl ?? announcement.image ?? null),
    timestamp: announcement.timestamp ?? announcement.createdAt ?? nowIso,
    createdAt: announcement.createdAt ?? announcement.timestamp ?? nowIso,
    isActive: announcement.isActive ?? true
  };
  try {

    if (USE_BACKEND_API) {
      // ส่งไป Backend
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createAnnouncement',
          payload: announcementWithId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // อัปเดต LocalStorage
        const current = await fetchAnnouncements();
        localStorage.setItem('announcements', JSON.stringify([announcementWithId, ...current]));
        return { success: true, message: result.message || 'ลงประกาศเรียบร้อยแล้ว' };
      }
    }

    // Fallback: Save to LocalStorage
    const current = await fetchAnnouncements();
    const updated = [announcementWithId, ...current];
    localStorage.setItem('announcements', JSON.stringify(updated));

    return { success: true, message: 'ลงประกาศเรียบร้อยแล้ว (Offline Mode)' };
  } catch (e) {
    console.error("Create announcement error:", e);
    // บันทึก Local เมื่อ Backend ล้มเหลว
    const current = await fetchAnnouncements();
    localStorage.setItem('announcements', JSON.stringify([announcementWithId, ...current]));
    return { success: true, message: 'ลงประกาศเรียบร้อยแล้ว (Offline Mode)' };
  }
};

export const deleteAnnouncement = async (id: string): Promise<boolean> => {
  try {
    if (USE_BACKEND_API) {
      // ส่งไป Backend
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteAnnouncement',
          id: id
        }),
      });

      if (response.ok) {
        // อัปเดต LocalStorage
        const current = await fetchAnnouncements();
        const updated = current.filter((a: any) => a.id !== id);
        localStorage.setItem('announcements', JSON.stringify(updated));
        return true;
      }
    }

    // Fallback: Local delete
    const current = await fetchAnnouncements();
    const updated = current.filter((a: any) => a.id !== id);
    localStorage.setItem('announcements', JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error("Delete announcement error:", e);
    return false;
  }
};

// --- Services for Fire Incidents ---

export const fetchFireIncidents = async (): Promise<any[]> => {
  try {
    if (USE_BACKEND_API) {
      // เรียก API จาก Backend
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getFireIncidents&t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        // Sync กับ LocalStorage เพื่อใช้งาน Offline
        localStorage.setItem('fireIncidents', JSON.stringify(data));
        return data;
      }
    }

    // Fallback: LocalStorage
    const localData = localStorage.getItem('fireIncidents');
    return localData ? JSON.parse(localData) : [];
  } catch (e) {
    console.error("Fetch fire incidents error:", e);
    // Fallback to local on error
    const localData = localStorage.getItem('fireIncidents');
    return localData ? JSON.parse(localData) : [];
  }
};

export const fetchFireIncidentStats = async (): Promise<any> => {
  try {
    if (USE_BACKEND_API) {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getFireStats&t=${Date.now()}`);
      if (response.ok) {
        return await response.json();
      }
    }

    // คำนวณจาก LocalStorage ถ้า Backend ไม่พร้อม
    const incidents = await fetchFireIncidents();
    return calculateLocalStats(incidents);
  } catch (e) {
    console.error("Fetch fire stats error:", e);
    return {
      totalIncidents: 0,
      avgResponseTime: 0,
      avgOperationTime: 0,
      totalDamageArea: 0,
      recentIncidents: []
    };
  }
};

// คำนวณสถิติจากข้อมูล Local
function calculateLocalStats(incidents: any[]): any {
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
    // คำนวณเวลาตอบสนอง
    if (incident.foundTime && incident.reachedTime) {
      const found = new Date(incident.foundTime);
      const reached = new Date(incident.reachedTime);
      const diff = (reached.getTime() - found.getTime()) / (1000 * 60);
      if (diff > 0 && diff < 1440) {
        totalResponseTime += diff;
        validResponseCount++;
      }
    }

    // คำนวณเวลาปฏิบัติงาน
    if (incident.reachedTime && incident.extinguishedTime) {
      const reached = new Date(incident.reachedTime);
      const extinguished = new Date(incident.extinguishedTime);
      const diff = (extinguished.getTime() - reached.getTime()) / (1000 * 60);
      if (diff > 0 && diff < 1440) {
        totalOperationTime += diff;
        validOperationCount++;
      }
    }

    // คำนวณพื้นที่เสียหาย
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

export const submitFireIncident = async (incident: any): Promise<{ success: boolean; message: string }> => {
  try {
    // เพิ่ม ID และ timestamp ถ้ายังไม่มี
    const incidentWithId = {
      ...incident,
      id: incident.id || 'fire_' + Date.now(),
      timestamp: incident.timestamp || new Date().toISOString()
    };

    if (USE_BACKEND_API) {
      // ส่งไป Backend
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveFireIncident',
          payload: incidentWithId
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // อัปเดต LocalStorage
        const current = await fetchFireIncidents();
        localStorage.setItem('fireIncidents', JSON.stringify([incidentWithId, ...current]));
        return { success: true, message: result.message || 'บันทึกรายงานเหตุไฟป่าเรียบร้อยแล้ว' };
      }
    }

    // Fallback: Save to LocalStorage
    const current = await fetchFireIncidents();
    const updated = [incidentWithId, ...current];
    localStorage.setItem('fireIncidents', JSON.stringify(updated));

    return { success: true, message: 'บันทึกรายงานเหตุไฟป่าเรียบร้อยแล้ว (Offline Mode)' };
  } catch (e) {
    console.error("Submit fire incident error:", e);
    // บันทึก Local เมื่อ Backend ล้มเหลว
    const current = await fetchFireIncidents();
    localStorage.setItem('fireIncidents', JSON.stringify([incident, ...current]));
    return { success: true, message: 'บันทึกรายงานเรียบร้อยแล้ว (Offline Mode)' };
  }
};
