export interface PlannedTask {
  id: string;
  sessionId: string;
  userId: string;
  taskDate: string;
  title: string;
  notes?: string;
  location?: string;
  priority: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  startTime?: string;
  endTime?: string;
  sourceType: "explicit" | "inferred";
  calendarEventId?: string;
  calendarSource?: "ios_eventkit" | "ics_single" | "ics_feed";
  status: "draft" | "confirmed" | "exported";
}
