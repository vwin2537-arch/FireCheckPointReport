import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WATCH_POINTS } from './constants';
import { Shift, ReportState } from './types';
import { submitReport, fetchDashboardData } from './services/mockDriveService';

// Fallback icons with loading state
const IconPlaceholder = ({ className }: { className?: string }) => (
  <div className={`${className} bg-slate-200 animate-pulse rounded-full`} />
);

const App: React.FC = () => {
  const [icons, setIcons] = useState<any>(null);
  const [solidIcons, setSolidIcons] = useState<any>(null);

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
        console.error("Icon loading error:", err);
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

  const loadDashboardData = useCallback(async (targetDate: string) => {
    setIsLoadingDashboard(true);
    try {
      const data = await fetchDashboardData(targetDate);
      setFolderStatus(Array.isArray(data) ? data : []);
    } catch (err) {
      setFolderStatus([]);
    } finally {
      setIsLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    if (view !== 'login') {
      loadDashboardData(state.date);
    }
  }, [state.date, view, loadDashboardData]);

  const checkIsDuplicate = () => {
    if (!state.pointId || !state.shift) return false;
    const point = WATCH_POINTS.find(p => p.id === state.pointId);
    const formattedName = formatPointName(point?.name || '');
    return folderStatus.some(f => f.pointName === formattedName && f.shift === state.shift);
  };

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

  const executeSubmit = async () => {
    if (!state.shift || !state.pointId) return;
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
    if (checkIsDuplicate()) {
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

  const Icon = ({ name, type = 'outline', className = "w-6 h-6" }: { name: string, type?: 'outline' | 'solid', className?: string }) => {
    const iconSet = type === 'outline' ? icons : solidIcons;
    if (!iconSet || !iconSet[name]) return <IconPlaceholder className={className} />;
    const TargetIcon = iconSet[name];
    return <TargetIcon className={className} />;
  };

  // Dashboard calculations
  const totalOperationsGoal = WATCH_POINTS.length * 3;
  const currentTotalOperations = folderStatus.length;
  const progressPercentage = Math.round((currentTotalOperations / totalOperationsGoal) * 100);
  
  const pointsWithCompleteShifts = WATCH_POINTS.filter(p => {
    const pointName = formatPointName(p.name);
    const shiftsSent = new Set(folderStatus.filter(f => f.pointName === pointName).map(f => f.shift));
    return shiftsSent.size === 3;
  }).length;

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 animate-fade-in">
      <div className="w-full max-sm bg-white rounded-[3rem] p-8 shadow-2xl">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-700">
          <Icon name="LockClosedIcon" className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-center text-slate-800 mb-6 font-sarabun">ยืนยันตัวตน</h2>
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
    <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setView('user')} className="flex items-center gap-1 text-emerald-700 font-bold bg-white px-4 py-2 rounded-full shadow-sm border border-emerald-100 transition-all active:scale-95">
          <Icon name="ChevronLeftIcon" className="w-4 h-4" /> กลับหน้าแรก
        </button>
        <div className="flex items-center gap-2">
          <input type="date" value={state.date} onChange={(e) => setState(prev => ({...prev, date: e.target.value}))} className="text-sm font-bold border-none bg-white rounded-xl px-4 py-2 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => loadDashboardData(state.date)} disabled={isLoadingDashboard} className="p-2.5 bg-white rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95">
            <Icon name="ArrowPathRoundedSquareIcon" className={`w-5 h-5 ${isLoadingDashboard ? 'animate-spin text-emerald-500' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 text-white p-8 rounded-[3rem] shadow-2xl mb-8 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black mb-1">ภาพรวมการเฝ้าระวัง</h2>
              <p className="text-emerald-300/80 text-sm font-medium">ข้อมูลประจำวันที่ {new Date(state.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 text-right">
              <span className="text-[10px] uppercase font-black tracking-widest opacity-60 block">ความคืบหน้า</span>
              <span className="text-2xl font-black text-yellow-400">{progressPercentage}%</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10">
              <p className="text-[10px] opacity-70 uppercase font-black mb-1 tracking-widest">ดำเนินการแล้ว (ครั้ง)</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-black text-emerald-300">{currentTotalOperations}</p>
                <p className="text-sm font-bold opacity-50 mb-1.5">/ {totalOperationsGoal}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10">
              <p className="text-[10px] opacity-70 uppercase font-black mb-1 tracking-widest">จุดที่รายงานแล้ว</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-black text-yellow-300">{new Set(folderStatus.map(f => f.pointName)).size}</p>
                <p className="text-sm font-bold opacity-50 mb-1.5">/ {WATCH_POINTS.length}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10">
              <p className="text-[10px] opacity-70 uppercase font-black mb-1 tracking-widest">จุดที่ส่งครบ 3 ช่วง</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-black text-white">{pointsWithCompleteShifts}</p>
                <p className="text-sm font-bold opacity-50 mb-1.5">จุด</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60 px-1">
              <span>สถานะดำเนินการภาพรวม</span>
              <span>{currentTotalOperations} จาก {totalOperationsGoal} รายการ</span>
            </div>
            <div className="h-4 bg-white/10 rounded-full overflow-hidden p-1 border border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-yellow-400 to-emerald-400 rounded-full transition-all duration-1000 shadow-sm"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        <Icon name="ChartBarIcon" className="absolute -right-10 -bottom-10 w-60 h-60 text-white/5 rotate-12" />
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="p-6 bg-slate-50/80 border-b flex justify-between items-center">
            <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight text-sm">
                <Icon name="ListBulletIcon" className="w-5 h-5 text-emerald-600" /> รายละเอียดรายจุด
            </h3>
            <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> ส่งแล้ว</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-200"></div> ยังไม่ส่ง</span>
            </div>
        </div>
        
        <div className="p-2 bg-slate-50/50 border-b text-[10px] font-black uppercase text-slate-400 flex justify-between tracking-widest">
          <span className="w-1/3 pl-6">จุดเฝ้าระวัง</span>
          <div className="w-2/3 flex justify-around"><span>เช้า</span><span>กลางวัน</span><span>เย็น</span></div>
        </div>
        
        <div className="divide-y max-h-[60vh] overflow-y-auto custom-scrollbar">
          {WATCH_POINTS.map(point => {
            const pointName = formatPointName(point.name);
            const status = folderStatus.filter(f => f.pointName === pointName);
            const isPointComplete = status.length === 3;
            
            return (
              <div key={point.id} className={`flex items-center p-5 transition-colors ${isPointComplete ? 'bg-emerald-50/20' : 'hover:bg-slate-50'}`}>
                <div className="w-1/3 pl-2 flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${isPointComplete ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {point.id}
                  </span>
                  <span className={`text-sm font-bold ${isPointComplete ? 'text-emerald-900' : 'text-slate-700'}`}>{pointName}</span>
                </div>
                <div className="w-2/3 flex justify-around">
                  {[Shift.MORNING, Shift.AFTERNOON, Shift.EVENING].map(s => (
                    status.some(f => f.shift === s) 
                      ? <Icon key={s} name="CheckCircleIcon" className="w-7 h-7 text-emerald-600" />
                      : <Icon key={s} name="XCircleIcon" type="solid" className="w-7 h-7 text-slate-100" />
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
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-50 shadow-2xl relative overflow-x-hidden animate-fade-in font-sarabun">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

      {/* Pop-up Loading Overlay (Compact) */}
      {state.isSubmitting && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in">
          <div className="bg-white w-full max-w-[280px] rounded-[3rem] p-8 shadow-2xl text-center flex flex-col items-center animate-fade-in border border-emerald-50">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-yellow-400/20 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping"></div>
              <Icon name="FireIcon" type="solid" className="w-14 h-14 text-yellow-500 relative z-10 animate-bounce drop-shadow-[0_4px_10px_rgba(234,179,8,0.3)]" />
            </div>
            <h2 className="text-xl font-black text-slate-800 mb-2">กำลังส่งรายงาน</h2>
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest animate-pulse">โปรดรอสักครู่...</p>
            
            <div className="mt-8 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{width: '40%'}}></div>
            </div>
            <style>{`
                @keyframes progress {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(250%); }
                }
            `}</style>
          </div>
        </div>
      )}

      {showConfirmOverlap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="bg-white w-full rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center animate-fade-in">
            <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="ExclamationTriangleIcon" className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">ตรวจพบข้อมูลซ้ำ!</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              คุณเคยส่งรายงานของ <span className="font-bold text-slate-700">{WATCH_POINTS.find(p => p.id === state.pointId)?.name}</span> ในช่วง <span className="font-bold text-slate-700">{state.shift}</span> ไปแล้ว ต้องการส่งข้อมูลชุดใหม่ใช่หรือไม่?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSubmit} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-orange-200">ยืนยันการส่งใหม่</button>
              <button onClick={() => setShowConfirmOverlap(false)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold active:scale-95 transition-all">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <header className="relative bg-emerald-900 text-white pt-16 pb-24 px-8 rounded-b-[4.5rem] shadow-2xl overflow-hidden">
        <div className="relative z-10 text-center">
          <Icon name="FireIcon" className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-black leading-tight tracking-tight mb-4 drop-shadow-md">ระบบเฝ้าระวังไฟป่า</h1>
          <div className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-400 text-emerald-950 text-xs font-black rounded-full uppercase tracking-widest shadow-lg shadow-black/20">
            <Icon name="MapPinIcon" className="w-3.5 h-3.5" /> อุทยานแห่งชาติเอราวัณ
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-800 rounded-full -mr-20 -mt-20 opacity-40 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-800 rounded-full -ml-16 -mb-16 opacity-20 blur-xl"></div>
      </header>

      {successMessage ? (
        <div className="px-6 -mt-16 animate-fade-in relative z-30">
           <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl text-center border border-emerald-50">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <Icon name="CheckCircleIcon" className="w-14 h-14" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">บันทึกสำเร็จ!</h2>
              <p className="text-sm text-slate-500 mb-10 leading-relaxed font-medium">{successMessage}</p>
              <div className="space-y-4">
                <button onClick={() => setSuccessMessage(null)} className="w-full py-5 bg-emerald-700 text-white rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-xl shadow-emerald-200">กลับไปส่งใหม่</button>
                <button onClick={() => { setSuccessMessage(null); setView('admin'); }} className="w-full py-4 bg-slate-50 text-slate-500 rounded-[1.5rem] font-bold border border-slate-100 active:scale-95 transition-all">ดูสรุปงานวันนี้</button>
              </div>
           </div>
        </div>
      ) : (
        <main className="px-6 -mt-16 space-y-6 relative z-30">
          <div className="group bg-white p-6 rounded-[2.5rem] shadow-xl border-b-4 border-blue-500/10 hover:border-blue-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-blue-600 uppercase tracking-[0.2em]">
              <Icon name="CalendarDaysIcon" className="w-4 h-4" /> วันที่ปฏิบัติงาน
            </div>
            <div className="relative">
              <input type="date" value={state.date} max={today} onChange={(e) => setState(prev => ({ ...prev, date: e.target.value }))} className="w-full p-4.5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-[1.8rem] font-black text-blue-900 text-lg outline-none transition-all cursor-pointer" />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300">
                <Icon name="PencilSquareIcon" className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-b-4 border-orange-500/10 hover:border-orange-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-orange-600 uppercase tracking-[0.2em]">
              <Icon name="MapPinIcon" className="w-4 h-4" /> เลือกจุดเฝ้าระวัง
            </div>
            <div className="relative">
              <select value={state.pointId || ''} onChange={(e) => setState(prev => ({ ...prev, pointId: Number(e.target.value) }))} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-orange-500 rounded-[1.8rem] font-bold text-slate-800 outline-none appearance-none text-md transition-all cursor-pointer">
                <option value="">-- เลือกจุดเฝ้าระวัง --</option>
                {WATCH_POINTS.map(p => <option key={p.id} value={p.id}>{formatPointName(p.name)}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-orange-400">
                <Icon name="ChevronDownIcon" className="w-6 h-6" />
              </div>
            </div>
            {state.pointId && (
              <div className="mt-4 flex gap-2 animate-fade-in">
                {[Shift.MORNING, Shift.AFTERNOON, Shift.EVENING].map(s => {
                  const hasData = folderStatus.some(f => f.pointName === formatPointName(WATCH_POINTS.find(p => p.id === state.pointId)!.name) && f.shift === s);
                  return (
                    <div key={s} className={`flex-1 text-[10px] font-black py-2 px-1 rounded-2xl text-center border-2 transition-all ${hasData ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-transparent text-slate-300'}`}>
                      {s.replace('ภาค', '')} {hasData ? '✓' : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-b-4 border-purple-500/10 hover:border-purple-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-5 font-black text-[11px] text-purple-600 uppercase tracking-[0.2em]">
              <Icon name="ClockIcon" className="w-4 h-4" /> ช่วงเวลาที่ตรวจสอบ
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(Shift).map(shift => {
                const isSelected = state.shift === shift;
                const alreadySent = state.pointId ? folderStatus.some(f => f.pointName === formatPointName(WATCH_POINTS.find(p => p.id === state.pointId)!.name) && f.shift === shift) : false;
                return (
                  <button key={shift} onClick={() => setState(prev => ({ ...prev, shift }))} className={`group relative flex items-center justify-between p-5 rounded-[2rem] border-2 font-black transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-xl shadow-purple-200 scale-[1.03]' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full transition-all ${isSelected ? 'bg-white scale-125' : 'bg-slate-300'}`}></div>
                      <span className="text-lg">{shift}</span>
                    </div>
                    {alreadySent && <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-600'}`}>ส่งแล้ว</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-7 rounded-[2.5rem] shadow-xl border-b-4 border-rose-500/10 hover:border-rose-500/40 transition-all duration-300">
            <div className="flex justify-between items-center mb-5 font-black text-[11px] uppercase tracking-[0.2em]">
              <div className="flex items-center gap-2 text-rose-600 font-black"><Icon name="PhotoIcon" className="w-4 h-4" /> รูปถ่ายความเรียบร้อย</div>
              <span className={`px-2 py-0.5 rounded-lg ${state.images.length >= 5 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.images.length}/5</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {state.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border-2 border-slate-50 shadow-sm animate-fade-in group">
                  <img src={img} className="w-full h-full object-cover" alt={`p-${idx}`} />
                  <button onClick={() => setState(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}))} className="absolute top-2 right-2 bg-rose-600/90 text-white p-1.5 rounded-full shadow-lg active:scale-90 transition-all">
                    <Icon name="TrashIcon" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {state.images.length < 5 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-[1.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 bg-slate-50 hover:bg-slate-100 hover:border-rose-300 transition-all active:scale-95 group">
                  <Icon name="CameraIcon" className="w-8 h-8 mb-2 group-hover:text-rose-500 transition-colors" />
                  <span className="text-[10px] font-black group-hover:text-rose-600">กดเพื่อถ่าย/เลือกรูป</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-b-4 border-emerald-500/10 hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-emerald-600 uppercase tracking-[0.2em]">
              <Icon name="ChatBubbleLeftRightIcon" className="w-4 h-4" /> บันทึกเพิ่มเติม
            </div>
            <textarea value={state.notes} onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))} placeholder="ระบุเหตุการณ์ปกติ หรือปัญหาที่พบ..." className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-emerald-500 rounded-[1.8rem] text-sm font-medium min-h-[140px] outline-none transition-all resize-none shadow-inner" />
          </div>

          <button onClick={handleSubmitAttempt} disabled={state.isSubmitting} className={`w-full py-6 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 shadow-2xl active:scale-[0.97] transition-all ${state.isSubmitting ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white shadow-emerald-200 hover:shadow-emerald-300'}`}>
            {state.isSubmitting ? (
              <><Icon name="ArrowPathIcon" className="w-7 h-7 animate-spin" /> กำลังส่งรายงาน...</>
            ) : (
              <><Icon name="CloudArrowUpIcon" className="w-7 h-7" /> ส่งรายงาน</>
            )}
          </button>

          <div className="pt-4 pb-16 flex justify-center">
            <button onClick={() => setView('login')} className="flex items-center gap-3 text-[11px] font-black text-slate-400 hover:text-emerald-700 uppercase tracking-[0.2em] py-4 px-10 bg-white border border-slate-100 rounded-full shadow-lg transition-all active:scale-95 group">
              <Icon name="LockClosedIcon" className="w-4 h-4 group-hover:animate-bounce" /> เข้าสู่ระบบเจ้าหน้าที่
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;