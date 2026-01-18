import React, { useState, useRef, useEffect } from 'react';
import { WATCH_POINTS, APP_TITLE } from './constants';
import { Shift, ReportState } from './types';
import { submitReport, fetchDashboardData } from './services/mockDriveService';

// Fallback icons in case of loading delay
const IconPlaceholder = ({ className }: { className?: string }) => (
  <div className={`${className} bg-slate-200 animate-pulse rounded-full`} />
);

const App: React.FC = () => {
  const [icons, setIcons] = useState<any>(null);
  const [solidIcons, setSolidIcons] = useState<any>(null);

  // Load icons from CDN to ensure they work regardless of local bundle issues
  useEffect(() => {
    const loadIcons = async () => {
      try {
        const [outline, solid] = await Promise.all([
          import('https://esm.sh/@heroicons/react@2.1.1/24/outline'),
          import('https://esm.sh/@heroicons/react@2.1.1/24/solid')
        ]);
        setIcons(outline);
        setSolidIcons(solid);
      } catch (err) {
        console.error("Failed to load icons:", err);
      }
    };
    loadIcons();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<'user' | 'admin' | 'login'>('user');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  
  const [state, setState] = useState<ReportState>({
    date: today,
    pointId: null,
    shift: null,
    images: [],
    notes: '',
    isSubmitting: false
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [folderStatus, setFolderStatus] = useState<any[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [showConfirmOverlap, setShowConfirmOverlap] = useState(false);

  const formatPointName = (name: string) => {
    return name.replace(/(\d+)/, (match) => match.padStart(2, '0'));
  };

  const loadDashboardData = async (targetDate: string) => {
    setIsLoadingDashboard(true);
    try {
      const data = await fetchDashboardData(targetDate);
      setFolderStatus(Array.isArray(data) ? data : []);
    } catch (err) {
      setFolderStatus([]);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (view === 'admin' || view === 'user') {
      loadDashboardData(state.date);
    }
  }, [state.date, view]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const remainingSlots = 5 - state.images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      filesToProcess.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setState(prev => ({
            ...prev,
            images: [...prev.images, reader.result as string].slice(0, 5)
          }));
        };
        reader.readAsDataURL(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const checkDuplicate = () => {
    const point = WATCH_POINTS.find(p => p.id === state.pointId);
    const formattedName = formatPointName(point?.name || '');
    return folderStatus.some(f => f.pointName === formattedName && f.shift === state.shift);
  };

  const executeSubmit = async () => {
    if (!state.shift) return;
    setShowConfirmOverlap(false);
    setState(prev => ({ ...prev, isSubmitting: true }));
    
    const point = WATCH_POINTS.find(p => p.id === state.pointId);
    const formattedName = formatPointName(point?.name || '');
    
    const result = await submitReport(formattedName, state.shift, state.images, state.notes, state.date);

    if (result.success) {
      setSuccessMessage(result.message);
      setState({ date: state.date, pointId: null, shift: null, images: [], notes: '', isSubmitting: false });
      loadDashboardData(state.date);
    } else {
      alert(result.message);
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleSubmitAttempt = () => {
    if (!state.pointId || !state.shift || state.images.length === 0) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน: เลือกจุด, ช่วงเวลา และแนบรูปอย่างน้อย 1 รูป');
      return;
    }
    if (checkDuplicate()) {
      setShowConfirmOverlap(true);
    } else {
      executeSubmit();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '2518') {
      setView('admin');
      setLoginError(false);
      setPassword('');
    } else {
      setLoginError(true);
      setPassword('');
    }
  };

  // Icon Helper
  const Icon = ({ name, type = 'outline', className = "w-6 h-6" }: { name: string, type?: 'outline' | 'solid', className?: string }) => {
    const iconSet = type === 'outline' ? icons : solidIcons;
    if (!iconSet || !iconSet[name]) return <IconPlaceholder className={className} />;
    const TargetIcon = iconSet[name];
    return <TargetIcon className={className} />;
  };

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-700">
          <Icon name="LockClosedIcon" className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-center text-slate-800 mb-6">ยืนยันตัวตน</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="รหัสผ่าน 4 หลัก"
            className={`w-full p-4 bg-slate-100 border-2 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none ${loginError ? 'border-rose-500 bg-rose-50' : 'border-transparent focus:border-emerald-500'}`}
          />
          <button type="submit" className="w-full py-4.5 bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all">เข้าสู่ระบบ</button>
          <button type="button" onClick={() => setView('user')} className="w-full py-3 text-slate-400 font-bold text-sm text-center block">ยกเลิก</button>
        </form>
      </div>
    </div>
  );

  if (view === 'admin') return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setView('user')} className="flex items-center gap-1 text-emerald-700 font-bold bg-white px-4 py-2 rounded-full shadow-sm border border-emerald-100">
          <Icon name="ChevronLeftIcon" className="w-4 h-4" /> กลับ
        </button>
        <div className="flex items-center gap-2">
          <input type="date" value={state.date} onChange={(e) => setState(prev => ({...prev, date: e.target.value}))} className="text-[12px] font-bold border-none bg-white rounded-lg px-3 py-1.5 shadow-sm outline-none" />
          <button onClick={() => loadDashboardData(state.date)} disabled={isLoadingDashboard} className="p-2 bg-white rounded-full shadow-sm">
            <Icon name="ArrowPathRoundedSquareIcon" className={`w-5 h-5 ${isLoadingDashboard ? 'animate-spin text-emerald-500' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-7 rounded-[2.5rem] shadow-xl mb-6 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-black mb-4">Dashboard</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <p className="text-[10px] opacity-70 uppercase font-bold mb-1">ส่งแล้ว</p>
              <p className="text-3xl font-black text-emerald-300">{new Set(folderStatus.map(f => f.pointName)).size}/{WATCH_POINTS.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <p className="text-[10px] opacity-70 uppercase font-bold mb-1">ยังไม่ส่ง</p>
              <p className="text-3xl font-black text-rose-400">{WATCH_POINTS.length - new Set(folderStatus.map(f => f.pointName)).size}</p>
            </div>
          </div>
        </div>
        <Icon name="FolderOpenIcon" className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 rotate-12" />
      </div>
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="p-5 bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400 flex justify-between tracking-widest">
          <span className="w-1/3">จุดเฝ้าระวัง</span>
          <div className="w-2/3 flex justify-around"><span>เช้า</span><span>กลางวัน</span><span>เย็น</span></div>
        </div>
        <div className="divide-y max-h-[60vh] overflow-y-auto custom-scrollbar">
          {WATCH_POINTS.map(point => {
            const pointName = formatPointName(point.name);
            const status = folderStatus.filter(f => f.pointName === pointName);
            return (
              <div key={point.id} className="flex items-center p-5 hover:bg-emerald-50/50 transition-colors">
                <span className="w-1/3 text-sm font-bold text-slate-700">{pointName}</span>
                <div className="w-2/3 flex justify-around">
                  {[Shift.MORNING, Shift.AFTERNOON, Shift.EVENING].map(s => (
                    status.some(f => f.shift === s) 
                      ? <Icon key={s} name="CheckCircleIcon" className="w-6 h-6 text-emerald-600" />
                      : <Icon key={s} name="XCircleIcon" type="solid" className="w-6 h-6 text-rose-100" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-50 shadow-2xl relative overflow-x-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

      {showConfirmOverlap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="bg-white w-full rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center">
            <Icon name="ExclamationTriangleIcon" className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-800 mb-2">ส่งซ้ำ หรือ แก้ไข?</h3>
            <p className="text-slate-500 text-sm mb-8">คุณเคยส่งรายงานช่วงนี้ไปแล้ว ต้องการแก้ไขใช่หรือไม่?</p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSubmit} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold active:scale-95 transition-all">ยืนยัน</button>
              <button onClick={() => setShowConfirmOverlap(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold active:scale-95 transition-all">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <header className="relative bg-emerald-900 text-white pt-12 pb-20 px-6 rounded-b-[4rem] shadow-2xl">
        <div className="relative z-10 text-center space-y-3">
          <Icon name="MapPinIcon" className="w-12 h-12 text-yellow-400 mx-auto" />
          <h1 className="text-2xl font-black leading-tight tracking-tight">{APP_TITLE}</h1>
          <div className="px-5 py-1.5 bg-yellow-400 text-emerald-950 text-[11px] font-black rounded-full uppercase tracking-widest">อุทยานแห่งชาติเอราวัณ</div>
        </div>
      </header>

      {successMessage ? (
        <div className="px-6 -mt-12">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center border border-emerald-50">
              <Icon name="CheckCircleIcon" className="w-20 h-20 text-emerald-600 mx-auto mb-6" />
              <h2 className="text-2xl font-black text-slate-800 mb-2">บันทึกสำเร็จ!</h2>
              <p className="text-sm text-slate-500 mb-8">{successMessage}</p>
              <div className="space-y-3">
                <button onClick={() => setSuccessMessage(null)} className="w-full py-4 bg-emerald-700 text-white rounded-2xl font-bold active:scale-95 transition-all">กลับไปส่งใหม่</button>
                <button onClick={() => { setSuccessMessage(null); setView('login'); }} className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-bold border border-slate-100 active:scale-95 transition-all">ดูสรุปงาน</button>
              </div>
           </div>
        </div>
      ) : (
        <main className="px-5 -mt-10 space-y-5 relative z-20">
          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-blue-500">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-blue-600 uppercase tracking-widest"><Icon name="CalendarDaysIcon" className="w-4 h-4" /> วันที่ปฏิบัติงาน</div>
            <input type="date" value={state.date} max={today} onChange={(e) => setState(prev => ({ ...prev, date: e.target.value }))} className="w-full p-4 bg-blue-50 border-none rounded-2xl font-black text-blue-900 text-lg outline-none" />
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-orange-500">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-orange-600 uppercase tracking-widest"><Icon name="MapPinIcon" className="w-4 h-4" /> จุดเฝ้าระวัง</div>
            <select value={state.pointId || ''} onChange={(e) => setState(prev => ({ ...prev, pointId: Number(e.target.value) }))} className="w-full p-4 bg-orange-50 border-none rounded-2xl font-bold text-slate-800 outline-none appearance-none text-md">
              <option value="">-- เลือกจุดเฝ้าระวัง --</option>
              {WATCH_POINTS.map(p => <option key={p.id} value={p.id}>{formatPointName(p.name)}</option>)}
            </select>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-purple-500">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-purple-600 uppercase tracking-widest"><Icon name="ClockIcon" className="w-4 h-4" /> ช่วงเวลา</div>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(Shift).map(shift => {
                const isSelected = state.shift === shift;
                return (
                  <button key={shift} onClick={() => setState(prev => ({ ...prev, shift }))} className={`flex items-center justify-between p-4 rounded-2xl border-2 font-black transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-purple-50/50 border-transparent text-purple-400'}`}>
                    <span>{shift}</span>
                    {isSelected && <Icon name="CheckCircleIcon" className="w-6 h-6" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-rose-500">
            <div className="flex justify-between mb-4 font-black text-[11px] uppercase tracking-widest">
              <div className="flex items-center gap-2 text-rose-600"><Icon name="PhotoIcon" className="w-4 h-4" /> รูปถ่าย</div>
              <span className="text-slate-400">{state.images.length}/5</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {state.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border">
                  <img src={img} className="w-full h-full object-cover" />
                  <button onClick={() => setState(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}))} className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full"><Icon name="TrashIcon" className="w-3 h-3" /></button>
                </div>
              ))}
              {state.images.length < 5 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-rose-200 flex flex-col items-center justify-center text-rose-300 bg-rose-50/30">
                  <Icon name="PlusIcon" className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">เพิ่มรูป</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-emerald-500">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-emerald-600 uppercase tracking-widest"><Icon name="ChatBubbleLeftRightIcon" className="w-4 h-4" /> เพิ่มเติม</div>
            <textarea value={state.notes} onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))} placeholder="บันทึก..." className="w-full p-4 bg-emerald-50/30 border-none rounded-2xl text-sm min-h-[100px] outline-none" />
          </div>

          <button onClick={handleSubmitAttempt} disabled={state.isSubmitting} className={`w-full py-5 rounded-[2rem] font-black text-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all ${state.isSubmitting ? 'bg-slate-300 text-slate-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white'}`}>
            {state.isSubmitting ? <><Icon name="ArrowPathIcon" className="w-6 h-6 animate-spin" /> กำลังส่ง...</> : 'ส่งรายงาน'}
          </button>

          <div className="pt-4 pb-10 flex justify-center">
            <button onClick={() => setView('login')} className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] py-3 px-8 bg-white border rounded-full shadow-sm">
              <Icon name="ChartBarIcon" className="w-4 h-4" /> ADMIN DASHBOARD
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;