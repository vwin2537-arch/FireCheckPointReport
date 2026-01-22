import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        isChunkError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        const isChunkError = error.message.includes('Loading chunk') ||
            error.message.includes('Importing a module script failed') ||
            error.name === 'ChunkLoadError';
        return { hasError: true, isChunkError };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        // Force a hard reload from the server, ignoring cache
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700">
                        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-yellow-600 dark:text-yellow-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-3">
                            {this.state.isChunkError ? 'มีการอัปเดตเวอร์ชันใหม่' : 'เกิดข้อผิดพลาดบางอย่าง'}
                        </h1>

                        <p className="text-slate-500 dark:text-slate-400 mb-8">
                            {this.state.isChunkError
                                ? 'ตรวจพบเวอร์ชันใหม่ของแอปพลิเคชัน กรุณารีโหลดเพื่อใช้งานเวอร์ชันล่าสุด'
                                : 'ขออภัยในความไม่สะดวก ระบบเกิดข้อผิดพลาดที่ไม่คาดคิด'}
                        </p>

                        <button
                            onClick={this.handleReload}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-95 transition-all text-lg"
                        >
                            {this.state.isChunkError ? 'อัปเดตทันที' : 'โหลดหน้าจอใหม่'}
                        </button>

                        <div className="mt-6 text-xs text-slate-400 font-mono">
                            Error Code: {this.state.isChunkError ? 'CHUNK_LOAD_FAILURE' : 'RUNTIME_ERROR'}
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
