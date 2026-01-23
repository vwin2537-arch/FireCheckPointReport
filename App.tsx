import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WATCH_POINTS } from './constants';
import { Shift, ReportState, Announcement } from './types';
import { submitReport, fetchDashboardData, fetchAnnouncements, createAnnouncement, deleteAnnouncement } from './services/mockDriveService';
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import html2canvas from 'html2canvas';
import { compressImages } from './utils/imageCompression';

// Fallback icons with loading state
const IconPlaceholder = ({ className }: { className?: string }) => (
  <div className={`${className} bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full`} />
);

const App: React.FC = () => {
  const [icons, setIcons] = useState<any>(null);

  // Initial State for form reset
  const INITIAL_STATE: ReportState = {
    date: new Date().toISOString().split('T')[0],
    pointId: null,
    shift: null,
    images: [],
    notes: '',
    isSubmitting: false,
    uploadProgress: 0
  };
  const [solidIcons, setSolidIcons] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  // Offline Mode State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingReports, setPendingReports] = useState<any[]>(() => {
    const saved = localStorage.getItem('pending_reports');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // PM2.5 Air Quality State
  const [airQuality, setAirQuality] = useState<{ pm25: number; level: string; color: string; station: string; updateTime: string } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('pending_reports', JSON.stringify(pendingReports));
  }, [pendingReports]);

  // Fetch PM2.5 from Air4Thai (using CORS proxy for HTTPS compatibility)
  useEffect(() => {
    const fetchAirQuality = async () => {
      try {
        // Use CORS proxy to handle HTTP -> HTTPS mixed content issue
        const apiUrl = 'http://air4thai.pcd.go.th/forappV2/getAQI_JSON.php';
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error('API fetch failed');

        const data = await res.json();
        // Find stations in Kanchanaburi area (or nearest)
        const stations = data.stations || [];
        const kanchanaburiStation = stations.find((s: any) =>
          s.areaTH?.includes('กาญจน') || s.nameTH?.includes('กาญจน')
        ) || stations.find((s: any) => s.areaTH?.includes('นครปฐม')) || stations[0];

        if (kanchanaburiStation?.AQILast) {
          const pm25Value = parseFloat(kanchanaburiStation.AQILast.PM25?.value) || 0;
          const colorId = parseInt(kanchanaburiStation.AQILast.PM25?.color_id) || parseInt(kanchanaburiStation.AQILast.AQI?.color_id) || 1;
          const updateTime = kanchanaburiStation.AQILast.time || '--:--';
          const levels = [
            { id: 1, level: 'ดีมาก', color: '#3b82f6' },
            { id: 2, level: 'ดี', color: '#22c55e' },
            { id: 3, level: 'ปานกลาง', color: '#eab308' },
            { id: 4, level: 'เริ่มมีผล', color: '#f97316' },
            { id: 5, level: 'มีผลต่อสุขภาพ', color: '#ef4444' },
          ];
          const matched = levels.find(l => l.id === colorId) || levels[2];
          setAirQuality({
            pm25: pm25Value,
            level: matched.level,
            color: matched.color,
            station: kanchanaburiStation.nameTH || 'Unknown',
            updateTime: updateTime
          });
        }
      } catch (e) {
        console.error('Air quality fetch error:', e);
        // Don't crash - just don't show the widget
        setAirQuality(null);
      }
    };
    fetchAirQuality();
    const interval = setInterval(fetchAirQuality, 15 * 60 * 1000); // Refresh every 15 mins (API is free)
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Get today's date dynamically (Local Time)
  const getToday = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null); // Ref for capture

  const [view, setView] = useState<'user' | 'admin' | 'login'>('user');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [state, setState] = useState<ReportState>({
    date: getToday(),
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

  // Ref to track the latest requested date to prevent race conditions
  const activeRequestDate = useRef<string | null>(null);

  const loadDashboardData = useCallback(async (targetDate: string) => {
    if (!isOnline) return; // Skip fetching if offline

    // Set this as the active request
    activeRequestDate.current = targetDate;

    setIsLoadingDashboard(true);
    // Clear data immediately to avoid showing stale data while loading
    setFolderStatus([]);

    try {
      const data = await fetchDashboardData(targetDate);

      // Only update state if this is still the active request
      if (activeRequestDate.current === targetDate) {
        setFolderStatus(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (activeRequestDate.current === targetDate) {
        setFolderStatus([]);
      }
    } finally {
      if (activeRequestDate.current === targetDate) {
        setIsLoadingDashboard(false);
      }
    }
  }, [isOnline]);

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

  const syncReports = async () => {
    if (!isOnline || pendingReports.length === 0) return;
    setIsSyncing(true);

    const remaining = [...pendingReports];
    let successCount = 0;

    // Process one by one
    for (const report of pendingReports) {
      try {
        const result = await submitReport(report.pointName, report.shift, report.images, report.notes, report.date);
        if (result.success) {
          remaining.shift(); // Remove successful
          successCount++;
        } else {
          break; // Stop on first error to retry later
        }
      } catch (e) {
        break;
      }
    }

    setPendingReports(remaining);
    setIsSyncing(false);
    if (successCount > 0) {
      alert(`อัปโหลดข้อมูลที่ค้างอยู่สำเร็จ ${successCount} รายการ`);
      loadDashboardData(state.date);
    }
  };

  const executeSubmit = async () => {
    if (!state.shift || !state.pointId) return;
    setShowConfirmOverlap(false);
    setState(prev => ({ ...prev, isSubmitting: true, uploadProgress: 0 }));

    const point = WATCH_POINTS.find(p => p.id === state.pointId);
    const formattedName = formatPointName(point?.name || '');

    // Offline Handling
    if (!isOnline) {
      const offlineReport = {
        pointName: formattedName,
        shift: state.shift,
        images: state.images,
        notes: state.notes,
        date: state.date,
        timestamp: new Date().getTime()
      };

      // Simulate delay
      setTimeout(() => {
        setPendingReports(prev => [...prev, offlineReport]);
        setSuccessMessage('บันทึกข้อมูลลงเครื่องแล้ว (รอสัญญาณเน็ตเพื่อส่ง)');
        setState({ ...INITIAL_STATE, date: state.date });
      }, 1000);
      return;
    }

    try {
      // 1. Compress Images
      setState(prev => ({ ...prev, uploadProgress: 10 }));
      const compressedImages = await compressImages(state.images, { maxWidth: 1920, quality: 0.85 }, (progress) => {
        // Map compression progress to 10-30% of total progress
        setState(prev => ({ ...prev, uploadProgress: 10 + (progress * 0.2) }));
      });

      // 2. Submit Report
      setState(prev => ({ ...prev, uploadProgress: 40 })); // Compression done, starting upload

      // Note: GAS doesn't support upload progress, so we simulate progress for the remaining 60%
      const progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.uploadProgress >= 90) return prev;
          return { ...prev, uploadProgress: prev.uploadProgress + 5 };
        });
      }, 1000);

      const result = await submitReport(formattedName, state.shift, compressedImages, state.notes, state.date);

      clearInterval(progressInterval);
      setState(prev => ({ ...prev, uploadProgress: 100 }));

      if (result.success) {
        setSuccessMessage(result.message);
        setState({ ...INITIAL_STATE, date: state.date });
        loadDashboardData(state.date);
      } else {
        alert(result.message);
        setState(prev => ({ ...prev, isSubmitting: false, uploadProgress: 0 }));
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล');
      setState(prev => ({ ...prev, isSubmitting: false, uploadProgress: 0 }));
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

  // Chart Data Preparation
  const sentCount = new Set(folderStatus.map(f => f.pointName)).size;
  const notSentCount = WATCH_POINTS.length - sentCount;
  const pieData = [
    { name: 'ส่งแล้ว', value: sentCount, color: '#10b981' },
    { name: 'ยังไม่ส่ง', value: notSentCount === 0 ? 0.01 : notSentCount, color: '#e2e8f0' } // Avoid 0 for pie chart
  ];

  const shiftData = [
    { name: 'เช้า', Sent: folderStatus.filter(f => f.shift === Shift.MORNING).length, Goal: WATCH_POINTS.length },
    { name: 'บ่าย', Sent: folderStatus.filter(f => f.shift === Shift.AFTERNOON).length, Goal: WATCH_POINTS.length },
    { name: 'เย็น', Sent: folderStatus.filter(f => f.shift === Shift.EVENING).length, Goal: WATCH_POINTS.length },
  ];

  // Trophy Badge Component
  const TrophyBadge = () => {
    let trophy = { emoji: '❌', label: 'ยังไม่ได้', color: 'from-gray-500 to-gray-700', glow: '', show: false };
    if (progressPercentage >= 90) {
      trophy = { emoji: '🏆', label: 'ทองคำ', color: 'from-yellow-400 to-yellow-600', glow: 'animate-pulse shadow-yellow-400/50', show: true };
    } else if (progressPercentage >= 80) {
      trophy = { emoji: '🥈', label: 'เงิน', color: 'from-slate-300 to-slate-500', glow: '', show: true };
    } else if (progressPercentage >= 70) {
      trophy = { emoji: '🥉', label: 'ทองแดง', color: 'from-amber-600 to-amber-800', glow: '', show: true };
    }

    if (!trophy.show) {
      return (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-gray-600 to-gray-800 text-white/60 shadow-lg border border-white/10">
          <span className="text-3xl opacity-50">🎯</span>
          <div className="text-left">
            <span className="text-[9px] uppercase font-black tracking-widest opacity-60 block">รางวัลประจำวัน</span>
            <span className="text-sm font-bold opacity-80">ต้อง ≥70%</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r ${trophy.color} text-white shadow-xl ${trophy.glow} border border-white/20`}>
        <span className="text-4xl drop-shadow-lg">{trophy.emoji}</span>
        <div className="text-left">
          <span className="text-[9px] uppercase font-black tracking-widest opacity-80 block">รางวัลประจำวัน</span>
          <span className="text-lg font-black tracking-tight">{trophy.label}</span>
        </div>
      </div>
    );
  };


  // Air Quality Widget Component
  const AirQualityWidget = () => {
    if (!airQuality) return null;
    return (
      <div className="arcade-stat p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg"
          style={{ backgroundColor: airQuality.color }}
        >
          {airQuality.aqi}
        </div>
        <div>
          <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest">🌫️ PM2.5</p>
          <p className="arcade-title text-lg" style={{ color: airQuality.color }}>{airQuality.level}</p>
        </div>
      </div>
    );
  };

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className="fixed z-50 top-4 right-4 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md shadow-lg border border-white/20 transition-all active:scale-95 text-slate-800 dark:text-white"
      aria-label="Toggle Dark Mode"
    >
      {isDarkMode ? <Icon name="SunIcon" className="w-6 h-6 text-yellow-300" /> : <Icon name="MoonIcon" className="w-6 h-6 text-indigo-600" />}
    </button>
  );

  if (view === 'login') return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-500 animate-fade-in relative overflow-hidden">
      <ThemeToggle />
      <div className="absolute inset-0 z-0 opacity-30 dark:opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-400/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/30 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-sm bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[3rem] p-8 shadow-2xl border border-white/50 dark:border-slate-700 relative z-10 transition-all duration-300">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-700 dark:text-emerald-400 shadow-inner">
          <Icon name="LockClosedIcon" className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-center text-slate-800 dark:text-white mb-6 font-sarabun tracking-tight">ยืนยันตัวตน</h2>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน 4 หลัก"
              className={`w-full p-4 bg-slate-50 dark:bg-slate-900/50 border-2 rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 dark:text-white ${loginError ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-100 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500'}`}
            />
          </div>
          <button type="submit" className="w-full py-4.5 bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">
            เข้าสู่ระบบ
          </button>
          <button type="button" onClick={() => setView('user')} className="w-full py-3 text-slate-400 dark:text-slate-500 font-bold text-sm text-center block hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            ยกเลิก
          </button>
        </form>
      </div>
    </div>
  );

  if (view === 'admin') return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-500 px-4 pt-20 pb-20 animate-fade-in max-w-4xl mx-auto font-sarabun">
      <ThemeToggle />
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setView('user')} className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold bg-white dark:bg-slate-800 px-5 py-2.5 rounded-full shadow-md shadow-slate-200/50 dark:shadow-none border border-emerald-100 dark:border-slate-700 transition-all active:scale-95 hover:bg-emerald-50 dark:hover:bg-slate-700">
          <Icon name="ChevronLeftIcon" className="w-4 h-4" /> กลับหน้าแรก
        </button>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={state.date}
            onChange={(e) => setState(prev => ({ ...prev, date: e.target.value }))}
            className="text-sm font-bold border-none bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          />
          <button onClick={() => loadDashboardData(state.date)} disabled={isLoadingDashboard} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
            <Icon name="ArrowPathRoundedSquareIcon" className={`w-5 h-5 ${isLoadingDashboard ? 'animate-spin text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`} />
          </button>

          <button
            onClick={async () => {
              if (dashboardRef.current) {
                try {
                  const canvas = await html2canvas(dashboardRef.current, {
                    backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
                    scale: 2
                  });
                  const link = document.createElement('a');
                  link.download = `fire-report-${state.date}.png`;
                  link.href = canvas.toDataURL();
                  link.click();
                } catch (err) {
                  alert('บันทึกภาพไม่สำเร็จ: ' + err);
                }
              }
            }}
            className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 text-emerald-600 dark:text-emerald-400"
            title="บันทึกภาพรายงาน"
          >
            <Icon name="CameraIcon" className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div ref={dashboardRef} className="p-1 -m-1 rounded-[2.5rem] bg-slate-900 pixel-pattern transition-colors">
        {/* Arcade Stats Grid */}
        <div className="arcade-card text-white p-8 mb-8 relative">
          {/* Dynamic Trophy Background - only shows when >= 70% */}
          {progressPercentage >= 70 && (
            <div
              className="trophy-bg"
              style={{
                filter: progressPercentage >= 90
                  ? 'drop-shadow(0 0 30px rgba(251, 191, 36, 0.5))' // Gold glow
                  : progressPercentage >= 80
                    ? 'drop-shadow(0 0 20px rgba(156, 163, 175, 0.4))' // Silver glow
                    : 'drop-shadow(0 0 15px rgba(180, 83, 9, 0.3))' // Bronze glow
              }}
            >
              {progressPercentage >= 90 ? '🏆' : progressPercentage >= 80 ? '🥈' : '🥉'}
            </div>
          )}

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="arcade-title text-xl md:text-2xl mb-2">ภาพรวมการเฝ้าระวัง</h2>
                <p className="text-blue-300 text-sm font-bold">📅 {new Date(state.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <TrophyBadge />
                <div className="arcade-stat px-5 py-3 text-right min-w-[120px]">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-1">ความคืบหน้า</span>
                  <span className="arcade-title text-2xl">{progressPercentage}%</span>
                </div>
              </div>
            </div>



            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="arcade-stat p-5 hover:scale-105 transition-transform cursor-default group">
                <p className="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">⚡ ดำเนินการแล้ว</p>
                <div className="flex items-end gap-2">
                  <p className="arcade-title text-4xl text-cyan-400">{currentTotalOperations}</p>
                  <p className="text-sm font-bold text-gray-500 mb-1.5">/ {totalOperationsGoal}</p>
                </div>
              </div>
              <div className="arcade-stat p-5 hover:scale-105 transition-transform cursor-default group">
                <p className="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">📍 จุดที่รายงานแล้ว</p>
                <div className="flex items-end gap-2">
                  <p className="arcade-title text-4xl text-yellow-400">{new Set(folderStatus.map(f => f.pointName)).size}</p>
                  <p className="text-sm font-bold text-gray-500 mb-1.5">/ {WATCH_POINTS.length}</p>
                </div>
              </div>
              <div className="arcade-stat p-5 hover:scale-105 transition-transform cursor-default group">
                <p className="text-[10px] text-gray-400 uppercase font-black mb-2 tracking-widest">⭐ ส่งครบ 3 ช่วง</p>
                <div className="flex items-end gap-2">
                  <p className="arcade-title text-4xl text-green-400">{pointsWithCompleteShifts}</p>
                  <p className="text-sm font-bold text-gray-500 mb-1.5">จุด</p>
                </div>
              </div>
            </div>


            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60 px-2">
                <span>สถานะดำเนินการภาพรวม</span>
                <span>{currentTotalOperations} จาก {totalOperationsGoal} รายการ</span>
              </div>
              <div className="h-4 bg-black/20 rounded-full overflow-hidden p-1 border border-white/5 backdrop-blur-sm">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
          <Icon name="ChartBarIcon" className="absolute -right-10 -bottom-10 w-64 h-64 text-white/5 rotate-12 pointer-events-none" />
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-xl dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 overflow-hidden relative transition-colors">
          <div className="p-6 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-md border-b dark:border-slate-700 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 uppercase tracking-tight text-sm">
              <Icon name="ListBulletIcon" className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> รายละเอียดรายจุด
            </h3>
          </div>

          <div className="p-3 bg-slate-100/50 dark:bg-slate-700/30 border-b dark:border-slate-700 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex justify-between tracking-widest">
            <span className="w-1/3 pl-4">จุดเฝ้าระวัง</span>
            <div className="w-2/3 flex justify-around"><span>เช้า</span><span>กลางวัน</span><span>เย็น</span></div>
          </div>

          <div className="divide-y dark:divide-slate-700">
            {WATCH_POINTS.map(point => {
              const pointName = formatPointName(point.name);
              const status = folderStatus.filter(f => f.pointName === pointName);
              const isPointComplete = status.length === 3;

              return (
                <div key={point.id} className={`flex items-center p-5 transition-colors ${isPointComplete ? 'bg-emerald-50/20 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                  <div className="w-1/3 pl-2 flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm ${isPointComplete ? 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-none' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                      {point.id}
                    </span>
                    <span className={`text-sm font-bold ${isPointComplete ? 'text-emerald-900 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{pointName}</span>
                  </div>
                  <div className="w-2/3 flex justify-around">
                    {[Shift.MORNING, Shift.AFTERNOON, Shift.EVENING].map(s => (
                      status.some(f => f.shift === s)
                        ? <Icon key={s} name="CheckCircleIcon" className="w-7 h-7 text-emerald-600 dark:text-emerald-400 drop-shadow-sm" />
                        : <Icon key={s} name="XCircleIcon" type="solid" className="w-7 h-7 text-slate-100 dark:text-slate-700" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 max-w-md mx-auto bg-slate-50 dark:bg-slate-900 shadow-2xl relative overflow-x-hidden animate-fade-in font-sarabun transition-colors duration-500">
      <ThemeToggle />
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />

      {/* Persistent Network Status Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 px-6 py-3 transition-colors duration-300 backdrop-blur-md border-t ${!isOnline
        ? 'bg-rose-600/90 border-rose-500'
        : pendingReports.length > 0
          ? 'bg-yellow-500/90 border-yellow-400'
          : 'bg-emerald-600/90 border-emerald-500'
        } text-white shadow-lg flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${!isOnline ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
          <span className="font-bold text-sm tracking-wide">
            {!isOnline ? 'คุณกำลังทำงานออฟไลน์ (Offline Mode)' :
              pendingReports.length > 0 ? `มีข้อมูลรอส่ง ${pendingReports.length} รายการ` :
                'ออนไลน์ปกติ (Online)'}
          </span>
        </div>

        {isOnline && pendingReports.length > 0 && (
          <button onClick={syncReports} disabled={isSyncing} className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-xs font-black uppercase transition-all active:scale-95 border border-white/20">
            {isSyncing ? 'กำลังส่ง...' : 'ส่งข้อมูลทันที'}
          </button>
        )}

        {isOnline && pendingReports.length === 0 && (
          <Icon name="WifiIcon" className="w-5 h-5 opacity-80" />
        )}

        {!isOnline && (
          <Icon name="SignalSlashIcon" className="w-5 h-5 opacity-80" />
        )}
      </div>


      {showConfirmOverlap && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"></div>
          <div className="bg-white dark:bg-slate-800 w-full rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center animate-fade-in border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon name="ExclamationTriangleIcon" className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">ตรวจพบข้อมูลซ้ำ!</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed">
              คุณเคยส่งรายงานของ <span className="font-bold text-slate-700 dark:text-slate-200">{WATCH_POINTS.find(p => p.id === state.pointId)?.name}</span> ในช่วง <span className="font-bold text-slate-700 dark:text-slate-200">{state.shift}</span> ไปแล้ว ต้องการส่งข้อมูลชุดใหม่ใช่หรือไม่?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={executeSubmit} className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold active:scale-95 transition-all shadow-lg shadow-orange-200 dark:shadow-none hover:bg-orange-500">ยืนยันการส่งใหม่</button>
              <button onClick={() => setShowConfirmOverlap(false)} className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-2xl font-bold active:scale-95 transition-all hover:bg-slate-200 dark:hover:bg-slate-600">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <header
        className="relative text-white pt-16 pb-24 px-8 rounded-b-[4.5rem] shadow-2xl overflow-hidden transition-all duration-700"
        style={{
          background: airQuality
            ? airQuality.pm25 <= 15
              ? 'linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%)' // Deep green - excellent
              : airQuality.pm25 <= 25
                ? 'linear-gradient(135deg, #166534 0%, #15803d 50%, #22c55e 100%)' // Green - good
                : airQuality.pm25 <= 37.5
                  ? 'linear-gradient(135deg, #854d0e 0%, #a16207 50%, #ca8a04 100%)' // Yellow/amber - moderate
                  : airQuality.pm25 <= 75
                    ? 'linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #ea580c 100%)' // Orange - unhealthy for sensitive
                    : 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #dc2626 100%)' // Red - unhealthy
            : 'linear-gradient(135deg, #065f46 0%, #047857 50%, #10b981 100%)' // Default green
        }}
      >
        <div className="relative z-10 text-center">
          <Icon name="FireIcon" className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
          <h1 className="text-3xl font-black leading-tight tracking-tight mb-4 drop-shadow-md">ระบบเฝ้าระวังไฟป่า</h1>
          <div className="inline-flex items-center gap-2 px-6 py-2 bg-yellow-400 text-emerald-950 text-xs font-black rounded-full uppercase tracking-widest shadow-lg shadow-black/20 mb-4">
            <Icon name="MapPinIcon" className="w-3.5 h-3.5" /> อุทยานแห่งชาติเอราวัณ
          </div>
          {/* Enhanced PM2.5 Air Quality Widget */}
          {airQuality && (
            <div className="flex justify-center mt-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 min-w-[280px]">
                {/* Main Info Row */}
                <div className="flex items-center gap-4 mb-3">
                  {/* Animated Icon based on level */}
                  <div className="relative">
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${airQuality.pm25 <= 25 ? 'animate-pulse' : airQuality.pm25 > 50 ? 'animate-bounce' : ''
                        }`}
                      style={{ backgroundColor: airQuality.color + '30' }}
                    >
                      {airQuality.pm25 <= 15 ? '🌿' :
                        airQuality.pm25 <= 25 ? '😊' :
                          airQuality.pm25 <= 37.5 ? '😐' :
                            airQuality.pm25 <= 75 ? '😷' : '⚠️'}
                    </div>
                    {airQuality.pm25 > 50 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black" style={{ color: airQuality.color }}>{airQuality.pm25.toFixed(1)}</span>
                      <span className="text-white/50 text-[10px] font-bold">μg/m³</span>
                    </div>
                    <p className="text-sm font-bold" style={{ color: airQuality.color }}>{airQuality.level}</p>
                  </div>

                  {/* Update Time & Location */}
                  <div className="text-right">
                    <p className="text-[8px] text-white/40 uppercase font-black tracking-widest">🌫️ PM2.5</p>
                    <p className="text-white/60 text-xs truncate max-w-[100px]">{airQuality.station}</p>
                    <p className="text-white/40 text-[9px]">🕐 {airQuality.updateTime} น.</p>
                  </div>
                </div>

                {/* Health Advice - using PM2.5 μg/m³ thresholds */}
                <div
                  className="text-[10px] font-bold text-center py-2 px-3 rounded-lg"
                  style={{ backgroundColor: airQuality.color + '20', color: airQuality.color }}
                >
                  {airQuality.pm25 <= 15 ? '💪 เหมาะสำหรับกิจกรรมกลางแจ้งทุกประเภท' :
                    airQuality.pm25 <= 25 ? '🏃 ออกกำลังกายกลางแจ้งได้ปกติ' :
                      airQuality.pm25 <= 37.5 ? '🚶 กลุ่มเสี่ยงควรลดกิจกรรมกลางแจ้ง' :
                        airQuality.pm25 <= 75 ? '😷 ควรสวมหน้ากากเมื่ออยู่กลางแจ้ง' :
                          '🏠 หลีกเลี่ยงกิจกรรมกลางแจ้ง'}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-800 dark:bg-emerald-900 rounded-full -mr-20 -mt-20 opacity-40 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-800 dark:bg-emerald-900 rounded-full -ml-16 -mb-16 opacity-20 blur-xl"></div>
      </header>

      {successMessage ? (
        <div className="px-6 -mt-16 animate-fade-in relative z-30">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] shadow-2xl dark:shadow-slate-900/50 text-center border border-emerald-50 dark:border-slate-700 transition-colors">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8">
              {isOnline ? <Icon name="CheckCircleIcon" className="w-14 h-14" /> : <Icon name="DevicePhoneMobileIcon" className="w-14 h-14" />}
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">{isOnline ? 'บันทึกสำเร็จ!' : 'บันทึกออฟไลน์แล้ว!'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-medium">{successMessage}</p>
            <div className="space-y-4">
              <button onClick={() => setSuccessMessage(null)} className="w-full py-5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-lg active:scale-95 transition-all shadow-xl shadow-emerald-200 dark:shadow-none">กลับไปส่งใหม่</button>
              <button onClick={() => { setSuccessMessage(null); setView('admin'); }} className="w-full py-4 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-[1.5rem] font-bold border border-slate-100 dark:border-transparent active:scale-95 transition-all hover:bg-slate-100 dark:hover:bg-slate-600">ดูสรุปงานวันนี้</button>
            </div>
          </div>
        </div>
      ) : (
        <main className="px-6 -mt-16 space-y-6 relative z-30">
          <div className="group bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-xl dark:shadow-slate-900/50 border-b-4 border-blue-500/10 dark:border-blue-500/20 hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">
              <Icon name="CalendarDaysIcon" className="w-4 h-4" /> วันที่ปฏิบัติงาน
            </div>
            <div className="relative">
              <input type="date" value={state.date} max={getToday()} onChange={(e) => setState(prev => ({ ...prev, date: e.target.value }))} className="w-full p-4.5 bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent focus:border-blue-500 dark:focus:border-blue-500 rounded-[1.8rem] font-black text-blue-900 dark:text-blue-100 text-lg outline-none transition-all cursor-pointer dark:scheme-dark" />
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-300 dark:text-blue-500">
                <Icon name="PencilSquareIcon" className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-xl dark:shadow-slate-900/50 border-b-4 border-orange-500/10 dark:border-orange-500/20 hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-orange-600 dark:text-orange-400 uppercase tracking-[0.2em]">
              <Icon name="MapPinIcon" className="w-4 h-4" /> เลือกจุดเฝ้าระวัง
            </div>
            <div className="relative">
              <select value={state.pointId || ''} onChange={(e) => setState(prev => ({ ...prev, pointId: Number(e.target.value) }))} className="w-full p-5 bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent focus:border-orange-500 dark:focus:border-orange-500 rounded-[1.8rem] font-bold text-slate-800 dark:text-slate-100 outline-none appearance-none text-md transition-all cursor-pointer">
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
                    <div key={s} className={`flex-1 text-[10px] font-black py-2 px-1 rounded-2xl text-center border-2 transition-all ${hasData ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-700/30 border-transparent text-slate-300 dark:text-slate-600'}`}>
                      {s.replace('ภาค', '')} {hasData ? '✓' : ''}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-xl dark:shadow-slate-900/50 border-b-4 border-purple-500/10 dark:border-purple-500/20 hover:border-purple-500/40 dark:hover:border-purple-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-5 font-black text-[11px] text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">
              <Icon name="ClockIcon" className="w-4 h-4" /> ช่วงเวลาที่ตรวจสอบ
            </div>
            <div className="grid grid-cols-1 gap-3">
              {Object.values(Shift).map(shift => {
                const isSelected = state.shift === shift;
                const alreadySent = state.pointId ? folderStatus.some(f => f.pointName === formatPointName(WATCH_POINTS.find(p => p.id === state.pointId)!.name) && f.shift === shift) : false;
                return (
                  <button key={shift} onClick={() => setState(prev => ({ ...prev, shift }))} className={`group relative flex items-center justify-between p-5 rounded-[2rem] border-2 font-black transition-all ${isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-xl shadow-purple-200 dark:shadow-none scale-[1.03]' : 'bg-slate-50 dark:bg-slate-700/50 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full transition-all ${isSelected ? 'bg-white scale-125' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                      <span className="text-lg">{shift}</span>
                    </div>
                    {alreadySent && <span className={`text-[10px] font-black px-3 py-1 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>ส่งแล้ว</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-7 rounded-[2.5rem] shadow-xl dark:shadow-slate-900/50 border-b-4 border-rose-500/10 dark:border-rose-500/20 hover:border-rose-500/40 dark:hover:border-rose-500/40 transition-all duration-300">
            <div className="flex justify-between items-center mb-5 font-black text-[11px] uppercase tracking-[0.2em]">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black"><Icon name="PhotoIcon" className="w-4 h-4" /> รูปถ่ายความเรียบร้อย</div>
              <span className={`px-2 py-0.5 rounded-lg ${state.images.length >= 5 ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>{state.images.length}/5</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {state.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-[1.5rem] overflow-hidden border-2 border-slate-50 dark:border-slate-700 shadow-sm animate-fade-in group">
                  <img src={img} className="w-full h-full object-cover" alt={`p-${idx}`} />
                  <button onClick={() => setState(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))} className="absolute top-2 right-2 bg-rose-600/90 hover:bg-rose-500 text-white p-1.5 rounded-full shadow-lg active:scale-90 transition-all">
                    <Icon name="TrashIcon" className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {state.images.length < 5 && (
                <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-[1.5rem] border-2 border-dashed border-slate-200 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-rose-300 dark:hover:border-rose-500/50 transition-all active:scale-95 group">
                  <Icon name="CameraIcon" className="w-8 h-8 mb-2 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors" />
                  <span className="text-[10px] font-black group-hover:text-rose-600 dark:group-hover:text-rose-400">กดเพื่อถ่าย/เลือกรูป</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-xl dark:shadow-slate-900/50 border-b-4 border-emerald-500/10 dark:border-emerald-500/20 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center gap-2 mb-4 font-black text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">
              <Icon name="ChatBubbleLeftRightIcon" className="w-4 h-4" /> บันทึกเพิ่มเติม
            </div>
            <textarea value={state.notes} onChange={(e) => setState(prev => ({ ...prev, notes: e.target.value }))} placeholder="ระบุเหตุการณ์ปกติ หรือปัญหาที่พบ..." className="w-full p-5 bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent focus:border-emerald-500 dark:focus:border-emerald-500 rounded-[1.8rem] text-sm font-medium min-h-[140px] outline-none transition-all resize-none shadow-inner dark:text-white dark:placeholder:text-slate-500" />
          </div>


          <button onClick={handleSubmitAttempt} disabled={state.isSubmitting} className={`relative w-full py-6 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 shadow-2xl active:scale-[0.97] transition-all overflow-hidden ${state.isSubmitting ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-emerald-200 dark:shadow-emerald-900/20 hover:shadow-emerald-300'}`}>

            {/* Progress Background */}
            {state.isSubmitting && state.uploadProgress !== undefined && (
              <div
                className="absolute inset-0 bg-emerald-100 dark:bg-emerald-900/30 transition-all duration-300 ease-out"
                style={{ width: `${state.uploadProgress}%` }}
              />
            )}

            <div className="relative z-10 flex items-center gap-4">
              {state.isSubmitting ? (
                <>
                  <Icon name="ArrowPathIcon" className="w-7 h-7 animate-spin" />
                  <span>
                    {state.uploadProgress !== undefined
                      ? `กำลังส่ง... ${state.uploadProgress.toFixed(0)}%`
                      : (isOnline ? 'กำลังส่งรายงาน...' : 'บันทึกออฟไลน์...')}
                  </span>
                </>
              ) : (
                <><Icon name="CloudArrowUpIcon" className="w-7 h-7" /> {isOnline ? 'ส่งรายงาน' : 'บันทึกลงเครื่อง'}</>
              )}
            </div>
          </button>

          <div className="pt-4 pb-16 flex flex-col items-center justify-center gap-4">
            <button onClick={() => setView('login')} className="flex items-center gap-3 text-[11px] font-black text-slate-400 dark:text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400 uppercase tracking-[0.2em] py-4 px-10 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-lg transition-all active:scale-95 group">
              <Icon name="LockClosedIcon" className="w-4 h-4 group-hover:animate-bounce" /> เข้าสู่ระบบเจ้าหน้าที่
            </button>
            <span className="text-[10px] text-slate-300 dark:text-slate-600 font-bold tracking-widest opacity-50">v2.2 Cache Fix</span>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;