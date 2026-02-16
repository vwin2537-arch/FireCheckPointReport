
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
  imageUrl?: string;
  level: 'info' | 'warning' | 'critical';
  timestamp?: string;
  createdAt?: string;
  expiresAt?: string | null;
  isActive: boolean;
}

export interface SubmissionResult {
  success: boolean;
  message: string;
}

export interface SummaryData {
  pointName: string;
  shifts: {
  };
}

export interface FireIncident {
  id: string;
  timestamp: string;
  // Location
  location: {
    lat: number;
    lng: number;
    // UTM Data
    utm?: {
      zone: number;
      easting: number;
      northing: number;
    };
    locality: string;
    moo: string;
    tambon: string;
    amphoe: string;
    province: string;
  };
  // Times
  foundTime: string;
  reachedTime: string;
  extinguishedTime: string;
  // Operation
  staffCount: number;
  damageArea: {
    rai: number;
    ngan: number;
    wa: number;
  };
  // Evidence
  image?: string;
  isInsidePark: boolean;
}
