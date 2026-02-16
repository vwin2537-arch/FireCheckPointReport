import React from 'react';
import { createPortal } from 'react-dom';

interface HotspotPageProps {
  isOpen: boolean;
  onClose: () => void;
}

const HotspotPage: React.FC<HotspotPageProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/90 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-4xl h-[100vh] sm:h-[95vh] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-3 sm:p-4 flex justify-between items-center shadow-lg shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">ระบบติดตาม Hotspot</h2>
              <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">ข้อมูลจากกรมอุทยานแห่งชาติ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open('https://dnp.gistda.or.th/', '_blank')}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <span className="hidden sm:inline">เปิดในหน้าใหม่</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Iframe Container */}
        <div className="flex-1 bg-slate-100 min-h-0">
          <iframe
            src="https://dnp.gistda.or.th/"
            className="w-full h-full border-0"
            title="GISTDA Fire Hotspot Map"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>

        {/* Footer Info */}
        <div className="bg-white border-t border-slate-200 p-2 sm:p-3 text-[10px] sm:text-xs text-slate-600 flex justify-between items-center shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="hidden sm:inline">VIIRS/S-NPP</span>
              <span className="sm:hidden">GISTDA</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="hidden sm:inline">VIIRS/NOAA-20</span>
              <span className="sm:hidden">NASA</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="hidden sm:inline">MODIS/Terra, Aqua</span>
              <span className="sm:hidden">MODIS</span>
            </span>
          </div>
          <div className="text-slate-400 whitespace-nowrap ml-2">
            GISTDA
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default HotspotPage;
