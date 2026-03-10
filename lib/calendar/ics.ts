import type { PlannedTask } from "@/types/task";

function formatIcsDate(dateString?: string) {
  if (!dateString) {
    return "";
  }

  const iso = new Date(dateString).toISOString();
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function formatIcsDateOnly(dateString?: string) {
  if (!dateString) {
    return "";
  }

  return dateString.replace(/-/g, "");
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function buildIcsFile(tasks: PlannedTask[]) {
  const events = tasks
    .map((task) => {
      const dtStart = formatIcsDate(task.startTime);
      const dtEnd = formatIcsDate(task.endTime);
      const allDayDate = !dtStart ? formatIcsDateOnly(task.taskDate) : "";
      const allDayEnd = allDayDate ? formatIcsDateOnly(addOneDay(task.taskDate)) : "";

      return [
        "BEGIN:VEVENT",
        `UID:${task.id}@ai-voice-journal`,
        `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
        dtStart ? `DTSTART:${dtStart}` : allDayDate ? `DTSTART;VALUE=DATE:${allDayDate}` : "",
        dtEnd ? `DTEND:${dtEnd}` : allDayEnd ? `DTEND;VALUE=DATE:${allDayEnd}` : "",
        `SUMMARY:${escapeIcsText(task.title)}`,
        task.location ? `LOCATION:${escapeIcsText(task.location)}` : "",
        `DESCRIPTION:${escapeIcsText(
          [
            `Priority=${task.priority}`,
            `Confidence=${task.confidence}`,
            `Source=${task.sourceType}`,
            task.notes ? `Notes=${task.notes}` : ""
          ]
            .filter(Boolean)
            .join("; ")
        )}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      ]
        .filter(Boolean)
        .join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Voice Journal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:AI Voice Journal",
    events,
    "END:VCALENDAR"
  ].join("\r\n");
}

function addOneDay(dateString: string) {
  const date = new Date(`${dateString}T00:00:00+08:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
