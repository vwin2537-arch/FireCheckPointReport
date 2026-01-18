
import { WatchPoint } from './types';

export const WATCH_POINTS: WatchPoint[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `จุดเฝ้าระวังที่ ${i + 1}`
}));

export const APP_TITLE = "ระบบเฝ้าระวังไฟป่า อุทยานแห่งชาติเอราวัณ";
