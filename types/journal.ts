export interface JournalEntry {
  id: string;
  sessionId: string;
  userId: string;
  entryDate: string;
  title: string;
  events: string[];
  thoughts: string[];
  mood?: string;
  wins: string[];
  problems: string[];
  ideas: string[];
  markdown: string;
}
