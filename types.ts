
export enum Shift {
  MORNING = 'ภาคเช้า',
  AFTERNOON = 'ภาคกลางวัน',
  EVENING = 'ภาคเย็น'
}

export interface WatchPoint {
  id: number;
  name: string;
}

export interface ReportState {
  date: string;
  pointId: number | null;
  shift: Shift | null;
  images: string[];
  notes: string;
  isSubmitting: boolean;
  uploadProgress?: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  timestamp: string;
  isActive: boolean;
}

export interface SubmissionResult {
  success: boolean;
  message: string;
}

export interface SummaryData {
  pointName: string;
  shifts: {
    [key in Shift]?: boolean;
  };
}
