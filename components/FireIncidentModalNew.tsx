import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FireIncident } from '../types';
import { submitFireIncident } from '../services/mockDriveService';
import { toUTM, fromUTM } from '../utils/utmConverter';

interface FireIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmitSuccess: () => void;
}

const FireIncidentModal: React.FC<FireIncidentModalProps> = ({ isOpen, onClose, onSubmitSuccess }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mode: 'auto' (GPS) or 'manual' (Input)
    const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');

    // Form Data
    const [formData, setFormData] = useState<Partial<FireIncident>>({
        location: {
            lat: 0, lng: 0,
            utm: { zone: 47, easting: 0, northing: 0 },
            locality: '', moo: '', tambon: '', amphoe: '', province: 'กาญจนบุรี'
        },
        damageArea: { rai: 0, ngan: 0, wa: 0 },
        isInsidePark: true,
        staffCount: 0
    });

    // Update UTM when Lat/Lng changes (only in Auto mode or when forced)
    const updateUTMFromLatLon = (lat: number, lng: number) => {
        const utm = toUTM(lat, lng);
        setFormData(prev => ({
            ...prev,
            location: {
                ...prev.location!,
                lat, lng,
                utm: { zone: utm.zone, easting: utm.easting, northing: utm.northing }
            }
        }));
    };

    // Update Lat/Lng when UTM changes
    const updateLatLonFromUTM = (easting: number, northing: number, zone: number) => {
        const ll = fromUTM(easting, northing, zone);
        setFormData(prev => ({
            ...prev,
            location: {
                ...prev.location!,
                lat: ll.lat,
                lng: ll.lon,
                utm: { zone, easting, northing }
            }
        }));
    };

    // Times (Separate state for easier handling)
    const [times, setTimes] = useState({
        found: '',
        reached: '',
        extinguished: ''
    });

    const [imagePreview, setImagePreview] = useState<string | undefined>(undefined);

    if (!isOpen) return null;

    const handleGPS = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    updateUTMFromLatLon(lat, lng);
                    setInputMode('auto');
                    alert(`ดึงพิกัดสำเร็จ: ${lat.toFixed(5)}, ${lng.toFixed(5)}\nUTM: ${toUTM(lat, lng).easting}, ${toUTM(lat, lng).northing}`);
                },
                (error) => {
                    alert('ไม่สามารถดึงพิกัดได้: ' + error.message);
                    setInputMode('manual'); // Switch to manual on error
                }
            );
        } else {
            alert('เบราว์เซอร์นี้ไม่รองรับ GPS');
            setInputMode('manual');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!times.found || !times.reached || !times.extinguished) {
            alert('กรุณากรอกเวลาให้ครบทุกช่อง');
            return;
        }

        setIsSubmitting(true);

        const newIncident: FireIncident = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            location: formData.location!,
            foundTime: times.found,
            reachedTime: times.reached,
            extinguishedTime: times.extinguished,
            staffCount: Number(formData.staffCount),
            damageArea: {
                rai: Number(formData.damageArea?.rai || 0),
                ngan: Number(formData.damageArea?.ngan || 0),
                wa: Number(formData.damageArea?.wa || 0)
            },
            isInsidePark: formData.isInsidePark || false,
            image: imagePreview
        };

        const result = await submitFireIncident(newIncident);
        setIsSubmitting(false);

        if (result.success) {
            alert(result.message);
            setStep(1); // Reset
            onClose();
            onSubmitSuccess();
        } else {
            alert(result.message);
        }
    };

    const calculateDuration = (start: string, end: string) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        const d1 = new Date(0, 0, 0, h1, m1);
        const d2 = new Date(0, 0, 0, h2, m2);
        const diffMs = d2.getTime() - d1.getTime();
        return diffMs > 0 ? Math.round(diffMs / 60000) : 0;
    };

    const reachDuration = calculateDuration(times.found, times.reached);
    const opDuration = calculateDuration(times.reached, times.extinguished);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] grid place-items-center p-0 sm:p-4 font-sarabun text-base overflow-y-auto bg-slate-900/90 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 w-full sm:max-w-lg sm:rounded-[2rem] relative z-10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[100vh] sm:max-h-[95vh]"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 text-white shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-black flex items-center gap-2">🔥 แจ้งเหตุไฟป่า</h2>
                        <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <p className="text-white/90 text-sm font-medium">บันทึกข้อมูลเพื่อทำสถิติ "พบไว เข้าถึงไว ดับไว (ไฟป่า)"</p>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 w-full space-y-10 custom-scrollbar">
                    {/* Location Section */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-l-4 border-red-500 pl-3">
                            📍 1. พิกัดตำแหน่งที่เกิดเหตุ
                        </h3>

                        {/* Professional UTM Entry Area */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800/50 mb-4 shadow-inner">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">พิกัด UTM (WGS84)</span>
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 shadow-sm">
                                    <span className="text-[9px] font-bold text-slate-400">ZONE</span>
                                    <input
                                        type="number"
                                        className="w-8 text-xs font-black bg-transparent outline-none text-blue-600 dark:text-blue-400"
                                        value={formData.location?.utm?.zone || 47}
                                        onChange={(e) => updateLatLonFromUTM(formData.location?.utm?.easting || 0, formData.location?.utm?.northing || 0, parseInt(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="relative">
                                    <label className="absolute left-4 top-2 text-[9px] font-black text-slate-400 uppercase">E (ค่าพิกัดตะวันออก - 6 หลัก)</label>
                                    <input
                                        type="number"
                                        readOnly={inputMode === 'auto'}
                                        placeholder="000000"
                                        className={`w-full pt-6 pb-3 px-4 text-2xl font-black rounded-2xl border-2 transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-slate-800 border-blue-400 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 border-transparent text-slate-500'}`}
                                        value={formData.location?.utm?.easting || ''}
                                        onChange={(e) => updateLatLonFromUTM(parseInt(e.target.value), formData.location?.utm?.northing || 0, formData.location?.utm?.zone || 47)}
                                    />
                                </div>
                                <div className="relative">
                                    <label className="absolute left-4 top-2 text-[9px] font-black text-slate-400 uppercase">N (ค่าพิกัดเหนือ - 7 หลัก)</label>
                                    <input
                                        type="number"
                                        readOnly={inputMode === 'auto'}
                                        placeholder="0000000"
                                        className={`w-full pt-6 pb-3 px-4 text-2xl font-black rounded-2xl border-2 transition-all ${inputMode === 'manual' ? 'bg-white dark:bg-slate-800 border-blue-400 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 border-transparent text-slate-500'}`}
                                        value={formData.location?.utm?.northing || ''}
                                        onChange={(e) => updateLatLonFromUTM(formData.location?.utm?.easting || 0, parseInt(e.target.value), formData.location?.utm?.zone || 47)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleGPS}
                                className="w-full mt-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                                ดึงพิกัดจาก GPS อัตโนมัติ
                            </button>
                            <p className="text-[10px] text-center mt-2 text-slate-400 font-medium">* ระบบจะแปลงค่าพิกัดให้เป็น UTM โดยอัตโนมัติ</p>
                        </div>

                        {/* Secondary Lat/Long Info (Collapsed/Simplified) */}
                        <div className="flex gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6">
                            <div className="flex-1">
                                <span className="text-[9px] text-slate-400 font-bold block">Lat:</span>
                                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{(formData.location?.lat || 0).toFixed(6)}</span>
                            </div>
                            <div className="flex-1">
                                <span className="text-[9px] text-slate-400 font-bold block">Lng:</span>
                                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">{(formData.location?.lng || 0).toFixed(6)}</span>
                            </div>
                            <button
                                onClick={() => setInputMode(inputMode === 'auto' ? 'manual' : 'auto')}
                                className="text-[10px] font-black text-rose-500 uppercase hover:underline"
                            >
                                {inputMode === 'auto' ? '[ แก้ไขเอง ]' : '[ ล็อคพิกัด ]'}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="ชื่อท้องที่/ป่า" className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-red-500"
                                value={formData.location?.locality} onChange={e => setFormData(p => ({ ...p, location: { ...p.location!, locality: e.target.value } }))} />
                            <input placeholder="หมู่ที่" className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-red-500"
                                value={formData.location?.moo} onChange={e => setFormData(p => ({ ...p, location: { ...p.location!, moo: e.target.value } }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input placeholder="ตำบล" className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-red-500"
                                value={formData.location?.tambon} onChange={e => setFormData(p => ({ ...p, location: { ...p.location!, tambon: e.target.value } }))} />
                            <input placeholder="อำเภอ" className="p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 outline-none focus:ring-2 focus:ring-red-500"
                                value={formData.location?.amphoe} onChange={e => setFormData(p => ({ ...p, location: { ...p.location!, amphoe: e.target.value } }))} />
                        </div>

                        <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600 flex-1 justify-center">
                                <input type="radio" name="parkZone" className="w-5 h-5 accent-red-600" checked={formData.isInsidePark} onChange={() => setFormData({ ...formData, isInsidePark: true })} />
                                <span className="font-bold text-slate-700 dark:text-slate-300">ในเขตอุทยาน</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600 flex-1 justify-center">
                                <input type="radio" name="parkZone" className="w-5 h-5 accent-red-600" checked={!formData.isInsidePark} onChange={() => setFormData({ ...formData, isInsidePark: false })} />
                                <span className="font-bold text-slate-700 dark:text-slate-300">นอกเขตอุทยาน</span>
                            </label>
                        </div>
                    </div>

                    {/* Time Section */}
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-800">
                        <h3 className="text-lg font-bold text-orange-800 dark:text-orange-400 mb-4 flex items-center gap-2 border-l-4 border-orange-500 pl-3">
                            ⏱️ 2. ข้อมูลเวลา (ไทม์ไลน์)
                        </h3>

                        <div className="relative space-y-8 pl-8 border-l-2 border-orange-400/30 dark:border-orange-700/50">
                            {/* Found */}
                            <div className="relative">
                                <div className="absolute -left-[41px] top-2 w-4 h-4 rounded-full bg-white border-4 border-blue-500 z-10 shadow-sm"></div>
                                <label className="block text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">เวลาที่ตรวจพบไฟ</label>
                                <input type="time" className="w-full p-4 text-lg font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                    value={times.found} onChange={e => setTimes({ ...times, found: e.target.value })} />
                            </div>

                            {/* Reached */}
                            <div className="relative">
                                <div className="absolute -left-[41px] top-2 w-4 h-4 rounded-full bg-white border-4 border-orange-500 z-10 shadow-sm"></div>
                                <label className="block text-sm font-bold text-orange-600 dark:text-orange-400 mb-1">เวลาเข้าถึง / เริ่มดับ</label>
                                <input type="time" className="w-full p-4 text-lg font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-orange-500 transition-all"
                                    value={times.reached} onChange={e => setTimes({ ...times, reached: e.target.value })} />
                                {reachDuration > 0 && <span className="absolute right-3 top-0 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 text-[10px] px-2 py-1 rounded-full font-black border border-orange-200 dark:border-orange-800 shadow-sm">เดินทาง {reachDuration} นาที</span>}
                            </div>

                            {/* Extinguished */}
                            <div className="relative">
                                <div className="absolute -left-[41px] top-2 w-4 h-4 rounded-full bg-white border-4 border-emerald-500 z-10 shadow-sm"></div>
                                <label className="block text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">เวลาดับเสร็จสิ้น</label>
                                <input type="time" className="w-full p-4 text-lg font-black bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                                    value={times.extinguished} onChange={e => setTimes({ ...times, extinguished: e.target.value })} />
                                {opDuration > 0 && <span className="absolute right-3 top-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-1 rounded-full font-black border border-emerald-200 dark:border-emerald-800 shadow-sm">ใช้เวลาดับ {opDuration} นาที</span>}
                            </div>
                        </div>
                    </div>

                    {/* Stats Section */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-l-4 border-purple-500 pl-3">
                            🚒 3. การปฏิบัติงาน & ความเสียหาย
                        </h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">จนท. ปฏิบัติงาน (นาย)</label>
                                <input type="number" min="0" className="w-full p-4 text-center text-xl font-black bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800 focus:ring-2 focus:ring-purple-500"
                                    value={formData.staffCount} onChange={e => setFormData(p => ({ ...p, staffCount: Number(e.target.value) }))} />
                            </div>
                            <div>
                                {/* Spacer or other stat */}
                            </div>
                        </div>

                        <label className="block text-xs font-bold text-slate-500 mb-2">พื้นที่เสียหาย (ไร่ - งาน - ตร.วา)</label>
                        <div className="flex gap-2 items-center">
                            <div className="flex-1">
                                <input type="number" min="0" placeholder="0" className="w-full p-3 text-center font-bold bg-slate-50 dark:bg-slate-700 border border-slate-200 rounded-xl"
                                    value={formData.damageArea?.rai} onChange={e => setFormData(p => ({ ...p, damageArea: { ...p.damageArea!, rai: Number(e.target.value) } }))} />
                                <span className="text-xs text-center block mt-1 text-slate-400">ไร่</span>
                            </div>
                            <div className="flex-1">
                                <input type="number" min="0" max="3" placeholder="0" className="w-full p-3 text-center font-bold bg-slate-50 dark:bg-slate-700 border border-slate-200 rounded-xl"
                                    value={formData.damageArea?.ngan} onChange={e => setFormData(p => ({ ...p, damageArea: { ...p.damageArea!, ngan: Number(e.target.value) } }))} />
                                <span className="text-xs text-center block mt-1 text-slate-400">งาน</span>
                            </div>
                            <div className="flex-1">
                                <input type="number" min="0" max="99" placeholder="0" className="w-full p-3 text-center font-bold bg-slate-50 dark:bg-slate-700 border border-slate-200 rounded-xl"
                                    value={formData.damageArea?.wa} onChange={e => setFormData(p => ({ ...p, damageArea: { ...p.damageArea!, wa: Number(e.target.value) } }))} />
                                <span className="text-xs text-center block mt-1 text-slate-400">ตร.วา</span>
                            </div>
                        </div>
                    </div>

                    {/* Image Section */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                            📷 4. รูปภาพประกอบ
                        </h3>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-40 bg-slate-50 dark:bg-slate-700/50 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative overflow-hidden"
                        >
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="text-slate-500 font-bold">แตะเพื่ออัปโหลดรูปภาพ</span>
                                </>
                            )}
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xl shadow-lg shadow-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกรายงานเหตุไฟป่า'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default FireIncidentModal;
