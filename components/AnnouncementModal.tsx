import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Announcement } from '../types';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
    announcements: Announcement[];
}

// Image with loading state component
const LazyImage: React.FC<{ 
    src: string; 
    alt: string; 
    fallbackSrcs: string[];
}> = ({ src, alt, fallbackSrcs }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [currentSrc, setCurrentSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        setHasError(false);
        setCurrentSrc(src);
    }, [src]);

    const handleError = () => {
        // Try next fallback URL
        const currentIndex = fallbackSrcs.indexOf(currentSrc);
        const nextSrc = fallbackSrcs[currentIndex + 1];
        if (nextSrc) {
            setCurrentSrc(nextSrc);
        } else {
            setHasError(true);
            setIsLoading(false);
        }
    };

    if (hasError) return null;

    return (
        <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-900/50 rounded-xl overflow-hidden">
            {/* Skeleton placeholder */}
            {isLoading && (
                <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}
            <img
                src={currentSrc}
                alt={alt}
                className={`w-full h-full object-contain transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onLoad={() => setIsLoading(false)}
                onError={handleError}
            />
        </div>
    );
};

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ isOpen, onClose, announcements }) => {
    useEffect(() => {
        if (!isOpen) {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            return;
        }
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Function to determine badge color based on level
    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'critical':
                return 'bg-red-500 text-white shadow-red-500/50';
            case 'warning':
                return 'bg-orange-500 text-white shadow-orange-500/50';
            case 'info':
            default:
                return 'bg-blue-500 text-white shadow-blue-500/50';
        }
    };

    const getLevelLabel = (level: string) => {
        switch (level) {
            case 'critical': return 'ด่วนที่สุด';
            case 'warning': return 'สำคัญ';
            case 'info': return 'ข่าวสาร';
            default: return 'ทั่วไป';
        }
    };

    const getDriveImageCandidates = (url?: string | null) => {
        if (!url) return [] as string[];
        if (url.startsWith('data:image')) return [url];
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([^&]+)/);
        if (match?.[1]) {
            const id = match[1];
            return [
                `https://drive.google.com/uc?export=view&id=${id}`,
                `https://drive.google.com/uc?export=download&id=${id}`,
                `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
                url
            ];
        }
        return [url];
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] grid place-items-center p-4 font-sarabun overflow-y-auto bg-slate-900/90 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[2.5rem] relative z-10 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shrink-0">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-2xl font-black flex items-center gap-2">📢 ประกาศ & ข่าวสาร</h2>
                        <button 
                            onClick={onClose} 
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-white/90 text-sm font-medium">ข้อมูลอัปเดตล่าสุดจากส่วนกลาง</p>
                </div>

                {/* Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {announcements.length === 0 ? (
                        <div className="text-center py-10 opacity-60">
                            <div className="text-4xl mb-4 grayscale">📭</div>
                            <p className="text-slate-500 dark:text-slate-400 font-bold">ยังไม่มีประกาศในขณะนี้</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {announcements.map((item) => {
                                const rawImage = item.imageUrl ?? (item as any).image ?? (item as any).posterUrl ?? (item as any).poster ?? null;
                                const imageCandidates = getDriveImageCandidates(rawImage);
                                let imageIndex = 0;
                                const displayDate = item.timestamp ?? item.createdAt ?? new Date().toISOString();
                                return (
                                <div key={item.id} className="group relative bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 hover:border-indigo-100 dark:hover:border-slate-600 transition-all">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${getLevelBadge(item.level)}`}>
                                            {getLevelLabel(item.level)}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-700">
                                            {new Date(displayDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    {imageCandidates.length > 0 && (
                                        <div className="mb-3 rounded-xl overflow-hidden shadow-sm">
                                            <LazyImage
                                                src={imageCandidates[0]}
                                                alt={item.title}
                                                fallbackSrcs={imageCandidates}
                                            />
                                        </div>
                                    )}
                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {item.title}
                                    </h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                        {item.message}
                                    </p>
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                    >
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AnnouncementModal;
