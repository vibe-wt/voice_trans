export interface CalendarExportRecord {
  id: string;
  userId: string;
  sessionId: string;
  exportType: "ics_single" | "ics_feed" | "shortcuts" | "eventkit";
  externalRef?: string | null;
  createdAt: string;
}
