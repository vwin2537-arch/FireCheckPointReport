
import React, { useState, useRef, useEffect } from 'react';
import { WATCH_POINTS, APP_TITLE } from './constants';
import { Shift, ReportState } from './types';
import { submitReport, fetchDashboardData } from './services/mockDriveService';
import * as OutlineIcons from '@heroicons/react/24/outline';
import * as SolidIcons from '@heroicons/react/24/solid';

const App: React.FC = () => {
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
      console.error("Failed to load dashboard:", err);
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
    
    const result = await submitReport(
      formattedName, 
      state.shift, 
      state.images, 
      state.notes, 
      state.date
    );

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

  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-700">
          <OutlineIcons.LockClosedIcon className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-center text-slate-800 mb-2">ยืนยันตัวตน</h2>
        <p className="text-center text-slate-500 text-sm mb-8 italic">เฉพาะเจ้าหน้าที่ผู้ดูแลระบบเท่านั้น</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน 4 หลัก"
              className={`w-full p-4 bg-slate-100 border-2 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none transition-all ${loginError ? 'border-rose-500 bg-rose-50' : 'border-transparent focus:border-emerald-500 focus:bg-white'}`}
              autoFocus
            />
            {loginError && <p className="text-rose-500 text-xs text-center mt-2 font-bold animate-bounce">รหัสผ่านไม่ถูกต้อง!</p>}
          </div>
          <button type="submit" className="w-full py-4.5 bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all">เข้าสู่ระบบ</button>
          <button type="button" onClick={() => {setView('user'); setLoginError(false);}} className="w-full py-3 text-slate-400 font-bold text-sm">ยกเลิก</button>
        </form>
      </div>
    </div>
  );

  const renderDashboard = () => {
    const reportedPointsCount = new Set(folderStatus.map(f => f.pointName)).size;

    return (
      <div className="min-h-screen bg-slate-50 p-4 pb-20 animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setView('user')} className="flex items-center gap-1 text-emerald-700 font-bold bg-white px-4 py-2 rounded-full shadow-sm border border-emerald-100 active:scale-95 transition-all">
            <OutlineIcons.ChevronLeftIcon className="w-4 h-4" />
            กลับหน้าส่งรายงาน
          </button>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={state.date} 
              onChange={(e) => setState(prev => ({...prev, date: e.target.value}))}
              className="text-[12px] font-bold border-none bg-white rounded-lg px-3 py-1.5 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button 
              onClick={() => loadDashboardData(state.date)} 
              disabled={isLoadingDashboard}
              className={`p-2 transition-all bg-white rounded-full shadow-sm ${isLoadingDashboard ? 'text-emerald-500' : 'text-slate-400'}`}
            >
              <OutlineIcons.ArrowPathRoundedSquareIcon className={`w-5 h-5 ${isLoadingDashboard ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-7 rounded-[2.5rem] shadow-xl mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-80">DAILY MONITORING STATUS</p>
            <h2 className="text-2xl font-black mb-4 tracking-tight">Dashboard ตรวจสอบ</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider mb-1">จุดที่รายงานแล้ว</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-300">{reportedPointsCount}</span>
                  <span className="text-xs opacity-50">/{WATCH_POINTS.length}</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-inner">
                <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider mb-1">ยังไม่เคลื่อนไหว</p>
                <p className="text-3xl font-black text-rose-400">{WATCH_POINTS.length - reportedPointsCount}</p>
              </div>
            </div>
          </div>
          <OutlineIcons.FolderOpenIcon className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 rotate-12" />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mb-6 relative">
          {isLoadingDashboard && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-20 flex items-center justify-center">
               <div className="flex flex-col items-center gap-3">
                 <OutlineIcons.ArrowPathIcon className="w-10 h-10 text-emerald-600 animate-spin" />
                 <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Scanning Drive Data...</span>
               </div>
            </div>
          )}
          <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <span className="w-1/3">WATCH POINT</span>
            <div className="w-2/3 flex justify-around">
              <span className="w-1/3 text-center">MORNING</span>
              <span className="w-1/3 text-center">NOON</span>
              <span className="w-1/3 text-center">EVENING</span>
            </div>
          </div>
          <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {WATCH_POINTS.map(point => {
              const formattedName = formatPointName(point.name);
              const pointFolders = folderStatus.filter(f => f.pointName === formattedName);
              return (
                <div key={point.id} className="flex items-center p-5 hover:bg-emerald-50/30 transition-colors">
                  <span className="w-1/3 text-sm font-bold text-slate-700">{formattedName}</span>
                  <div className="w-2/3 flex justify-around items-center">
                    {[Shift.MORNING, Shift.AFTERNOON, Shift.EVENING].map(s => {
                      const isExist = pointFolders.some(f => f.shift === s);
                      return (
                        <div key={s} className="w-1/3 flex justify-center">
                          {isExist ? (
                            <div className="p-1 bg-emerald-100 rounded-full animate-in zoom-in duration-300">
                              <OutlineIcons.CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                            </div>
                          ) : (
                            <SolidIcons.XCircleIcon className="w-6 h-6 text-rose-200/70" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (view === 'login') return renderLogin();
  if (view === 'admin') return renderDashboard();

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-50 shadow-2xl relative overflow-x-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

      {showConfirmOverlap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="bg-white w-full rounded-[2.5rem] p-8 relative z-10 shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600">
              <OutlineIcons.ExclamationTriangleIcon className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-3">แก้ไขข้อมูล?</h3>
            <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed">
              จุดนี้ได้มีการส่งรายงาน <span className="text-orange-600 font-bold">{state.shift}</span> ไปแล้ว <br/> 
              คุณต้องการบันทึกภาพและข้อมูลเพิ่ม หรือต้องการแก้ไขข้อมูลเดิมใช่หรือไม่?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSubmit} className="w-full py-4.5 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-600/20 active:scale-95 transition-all">ยืนยัน (แก้ไข/บันทึกเพิ่ม)</button>
              <button onClick={() => setShowConfirmOverlap(false)} className="w-full py-4.5 bg-slate-100 text-slate-500 rounded-2xl font-bold active:scale-95 transition-all">ยกเลิกไปตรวจสอบใหม่</button>
            </div>
          </div>
        </div>
      )}

      <header className="relative bg-emerald-900 text-white pt-12 pb-20 px-6 rounded-b-[4rem] shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-800/50 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="relative z-10 text-center space-y-3">
          <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 mb-2">
            <OutlineIcons.MapPinIcon className="w-8 h-8 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black leading-tight tracking-tight px-4">{APP_TITLE}</h1>
          <div className="px-5 py-1.5 bg-yellow-400 text-emerald-950 text-[11px] font-black rounded-full uppercase tracking-[0.15em] shadow-lg border-2 border-emerald-900/10 inline-block">
            อุทยานแห่งชาติเอราวัณ
          </div>
        </div>
      </header>

      {successMessage ? (
        <div className="px-6 -mt-12 animate-in zoom-in duration-500">
           <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center border border-emerald-50">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
                <OutlineIcons.CheckCircleIcon className="w-14 h-14" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">บันทึกสำเร็จ!</h2>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed px-2">{successMessage}</p>
              <div className="space-y-3">
                <button onClick={() => setSuccessMessage(null)} className="w-full py-4.5 bg-emerald-700 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg">ส่งรายงานต่อ</button>
                <button onClick={() => { setSuccessMessage(null); setView('login'); }} className="w-full py-4.5 bg-slate-50 text-slate-500 rounded-2xl font-bold active:scale-95 transition-all border border-slate-100">เข้าหน้า Dashboard</button>
              </div>
           </div>
        </div>
      ) : (
        <main className="px-5 -mt-10 space-y-5 relative z-20">
          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-blue-500 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4 font-black text-[11px] text-blue-600 uppercase tracking-widest">
              <OutlineIcons.CalendarDaysIcon className="w-5 h-5" /> วันที่ปฏิบัติงาน
            </div>
            <input type="date" value={state.date} max={today} onChange={(e) => setState(prev => ({ ...prev, date: e.target.value }))} className="w-full p-4 bg-blue-50/50 border-none rounded-2xl font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-lg" />
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-orange-500 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4 font-black text-[11px] text-orange-600 uppercase tracking-widest">
              <OutlineIcons.MapPinIcon className="w-5 h-5" /> จุดเฝ้าระวังไฟป่า
            </div>
            <select value={state.pointId || ''} onChange={(e) => setState(prev => ({ ...prev, pointId: Number(e.target.value) }))} className="w-full p-5 bg-orange-50/50 border-none rounded-2xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500 transition-all appearance-none text-md">
              <option value="">-- เลือกจุดเฝ้าระวัง --</option>
              {WATCH_POINTS.map(p => {
                const formattedName = formatPointName(p.name);
                const hasReports = folderStatus.filter(f => f.pointName === formattedName).length > 0;
                return (
                  <option key={p.id} value={p.id}>
                    {formattedName} {hasReports ? '(ส่งแล้วบางช่วง)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-purple-500 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4 font-black text-[11px] text-purple-600 uppercase tracking-widest">
              <OutlineIcons.ClockIcon className="w-5 h-5" /> ช่วงเวลาตรวจสอบ
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(Shift).map(shift => {
                const isSelected = state.shift === shift;
                const point = WATCH_POINTS.find(p => p.id === state.pointId);
                const isSent = point && folderStatus.some(f => f.pointName === formatPointName(point.name) && f.shift === shift);

                return (
                  <button 
                    key={shift} 
                    onClick={() => setState(prev => ({ ...prev, shift }))} 
                    className={`flex items-center justify-between p-5 rounded-2xl border-2 font-black transition-all 
                      ${isSelected 
                        ? 'bg-purple-600 border-purple-600 text-white shadow-xl scale-[1.03]' 
                        : isSent 
                          ? 'bg-slate-100 border-transparent text-slate-400 opacity-80' 
                          : 'bg-purple-50/50 border-transparent text-purple-400'}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className="tracking-tight text-lg">{shift}</span>
                      {isSent && <span className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">✓ ส่งรายงานแล้ว</span>}
                    </div>
                    {isSelected 
                      ? <OutlineIcons.CheckCircleIcon className="w-7 h-7" /> 
                      : isSent 
                        ? <OutlineIcons.CheckCircleIcon className="w-7 h-7 text-emerald-500/50" />
                        : <div className="w-7 h-7 rounded-full border-2 border-purple-200"></div>
                    }
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-rose-500 transition-all hover:shadow-lg">
            <div className="flex justify-between items-center mb-5 font-black text-[11px] uppercase tracking-widest">
              <div className="flex items-center gap-3 text-rose-600"><OutlineIcons.PhotoIcon className="w-5 h-5" /> หลักฐานภาพถ่าย</div>
              <span className={`px-3 py-1 rounded-full text-[10px] ${state.images.length > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{state.images.length} / 5</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {state.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md">
                  <img src={img} className="w-full h-full object-cover" />
                  <button onClick={() => setState(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}))} className="absolute top-1.5 right-1.5 bg-rose-600 text-white p-1.5 rounded-full shadow-lg"><OutlineIcons.TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {state.images.length < 5 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border-3 border-dashed border-rose-200 flex flex-col items-center justify-center text-rose-400 bg-rose-50/30 active:bg-rose-100 transition-all group">
                  <OutlineIcons.PlusIcon className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase">ถ่ายรูป</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-md border-l-8 border-emerald-500 transition-all hover:shadow-lg">
            <div className="flex items-center gap-3 mb-4 font-black text-[11px] text-emerald-600 uppercase tracking-widest">
              <OutlineIcons.ChatBubbleLeftRightIcon className="w-5 h-5" /> บันทึกเพิ่มเติม
            </div>
            <textarea 
              value={state.notes}
              onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="กรอกรายละเอียดเหตุการณ์..."
              className="w-full p-5 bg-emerald-50/30 border-none rounded-2xl font-medium text-slate-700 outline-none min-h-[120px] text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <button 
            onClick={handleSubmitAttempt} 
            disabled={state.isSubmitting} 
            className={`w-full py-6 rounded-[2.5rem] font-black text-xl flex flex-col items-center justify-center gap-1 shadow-2xl transition-all active:scale-[0.96] group ${state.isSubmitting ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white'}`}
          >
            {state.isSubmitting ? (
              <div className="flex items-center gap-3">
                <OutlineIcons.ArrowPathIcon className="w-7 h-7 animate-spin" />
                <span>กำลังบันทึกข้อมูล...</span>
              </div>
            ) : (
              <>
                <span className="tracking-tight text-2xl">ส่งรายงานเข้าส่วนกลาง</span>
                <span className="text-[10px] font-bold opacity-70 uppercase tracking-[0.2em]">CLOUD SYNC ENABLED</span>
              </>
            )}
          </button>

          <div className="pt-8 pb-12 flex flex-col items-center gap-5">
            <button 
              onClick={() => setView('login')}
              className="group flex items-center gap-3 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-10 py-4 bg-white border border-slate-100 rounded-full shadow-sm hover:text-emerald-600 transition-all active:scale-95"
            >
              <OutlineIcons.ChartBarIcon className="w-4 h-4" /> 
              ADMIN DASHBOARD
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;
