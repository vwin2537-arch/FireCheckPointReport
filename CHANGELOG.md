# Changelog

## [2.3.0] - 2026-02-17

### เพิ่มใหม่
- **PWA Support**: เพิ่มการรองรับ Progressive Web App (ติดตั้งบนมือถือได้, ทำงาน offline)
  - เพิ่ม `manifest.json` พร้อม app metadata
  - อัปเดต `service-worker.js` รองรับ caching และ offline mode
  - เพิ่ม meta tags สำหรับ theme color และ PWA

- **Hotspot Modal ปรับปรุง**: 
  - ใช้ React Portal เพื่อแสดงกลางจอถูกต้อง
  - ปรับขนาด responsive สำหรับมือถือ (เต็มจอ 100vh)
  - UI ปรับให้เหมาะกับการใช้งานบน mobile

- **Fire Incident Modal ปรับปรุง**:
  - ใช้ React Portal แก้ปัญหา modal ไม่แสดงกลางจอ
  - Responsive design สำหรับ mobile/desktop

### ปรับปรุง
- **Announcement Image Loading**: 
  - เพิ่ม skeleton placeholder ขณะโหลดภาพ
  - ใช้ lazy loading และ async decoding
  - Fade-in animation เมื่อภาพโหลดเสร็จ
  - Auto-fallback URL หากโหลดไม่สำเร็จ

- **UI/UX ปรับปรุง**:
  - ลด padding ส่วนหัวสีส้ม (pb-20 → pb-16)
  - ปุ่ม action (แจ้งเหตุ/Hotspot/ประกาศ) จัดวางใหม่ให้อยู่ใน header

### แก้ไข
- แก้ไข `App.tsx` ที่มีโค้ด `HotspotPage` ถูกแทรกผิดที่ทำให้ไฟล์เสียหาย
- ลบ `GEMINI_API_KEY` ที่ไม่ได้ใช้ออกจาก `vite.config.ts`

---

## [2.2.0] - 2026-02-16

### เพิ่มใหม่
- **ระบบประกาศ (Announcements)**: Admin สามารถสร้างและจัดการประกาศได้
  - รองรับการอัปโหลดรูปภาพโปสเตอร์
  - ระดับความสำคัญ (info/warning/critical)
  - กำหนดวันหมดอายุประกาศ
  - แสดงตัวเลข badge บนไอคอนประกาศ

- **Fire Incident Reporting**: ระบบแจ้งเหตุไฟป่าแบบละเอียด
  - รองรับ GPS auto-detect และ manual UTM input
  - บันทึก timeline (พบ/เข้าถึง/ดับ)
  - คำนวณระยะเวลาอัตโนมัติ
  - อัปโหลดรูปภาพประกอบ
  - บันทึกพื้นที่เสียหาย (ไร่-งาน-ตร.วา)

- **Hotspot Integration**: ดูข้อมูลจุดความร้อนจาก GISTDA ในแอพ

### ปรับปรุง
- แก้ไข Heroicons imports สำหรับ Vercel deployment
- แก้ไข `AirQualityWidget` ใช้ `pm25` แทน `aqi`
- ปรับตำแหน่งปุ่ม action ให้อยู่ใน header ไม่ทับกับ UI อื่น
- แก้ไข scroll lock หลังปิด AnnouncementModal

### Technical
- ปรับปรุง Google Drive image URL normalization
- เพิ่ม offline mode ด้วย LocalStorage fallback
- Service Worker สำหรับ cache management

---

## [2.1.0] - 2026-02-15

### ปรับปรุง
- Cache fix สำหรับ Service Worker
- UI refinements

---

## [2.0.0] - 2026-02-14

### Major Release
- ปล่อยเวอร์ชัน stable แรก
- ระบบเฝ้าระวังไฟป่าครบถ้วน
- Dashboard แสดงสถิติการรายงาน
- Dark mode support

---

**หมายเหตุ**: ใช้ [Keep a Changelog](https://keepachangelog.com/) format
