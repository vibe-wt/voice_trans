import { z } from "zod";

export const summarySchema = z.object({
  date: z.string(),
  raw_summary: z.string(),
  journal: z.object({
    title: z.string(),
    events: z.array(z.string()),
    thoughts: z.array(z.string()),
    mood: z.string().optional(),
    wins: z.array(z.string()),
    problems: z.array(z.string()),
    ideas: z.array(z.string()),
    markdown: z.string()
  }),
  tomorrow_plan: z.object({
    must_do: z.array(z.string()),
    schedule_blocks: z.array(
      z.object({
        title: z.string(),
        start_time: z.string(),
        end_time: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        confidence: z.enum(["high", "medium", "low"])
      })
    ),
    follow_ups: z.array(z.string()),
    reminders: z.array(z.string())
  })
});

export type SummaryOutput = z.infer<typeof summarySchema>;

export async function summarizeTranscript(transcript: string): Promise<SummaryOutput> {
  const date = new Date().toISOString().slice(0, 10);
  const utterances = extractUtterances(transcript);
  const userUtterances = utterances.filter((item) => item.role === "user").map((item) => item.content);
  const sourceTexts = userUtterances.length ? userUtterances : utterances.map((item) => item.content);
  const sentences = splitSentences(sourceTexts);

  const tomorrowSentences = unique(
    sentences.filter((sentence) => /明天|明日|待会|稍后|下周|上午|下午|晚上|今晚|中午|跟进|联系|确认|安排|提醒/.test(sentence))
  );
  const todaySentences = unique(sentences.filter((sentence) => !tomorrowSentences.includes(sentence)));

  const wins = unique(filterByKeywords(sentences, ["完成", "搞定", "推进", "打通", "实现", "上线", "解决"])).slice(0, 3);
  const problems = unique(filterByKeywords(sentences, ["问题", "卡住", "失败", "报错", "超时", "风险", "来不及", "困难"])).slice(0, 3);
  const ideas = unique(filterByKeywords(sentences, ["想", "可以", "考虑", "也许", "计划", "方案", "优化"])).slice(0, 3);
  const thoughts = unique(
    sentences.filter((sentence) => /觉得|感觉|希望|担心|计划|准备|打算|想/.test(sentence))
  ).slice(0, 3);

  const events = unique(
    [
      ...todaySentences.filter((sentence) => /今天|刚才|现在|已经|完成|推进|整理|讨论|确认|实现|处理/.test(sentence)),
      ...todaySentences
    ].map(cleanSentence)
  )
    .filter(Boolean)
    .slice(0, 4);

  const mustDo = unique(
    tomorrowSentences
      .filter((sentence) => /明天|明日|先|优先|必须|要|需要|准备/.test(sentence))
      .map(stripTomorrowLead)
      .map(cleanSentence)
  )
    .filter(Boolean)
    .slice(0, 5);

  const followUps = unique(
    tomorrowSentences
      .filter((sentence) => /跟进|联系|确认|联调|沟通|同步|回复/.test(sentence))
      .map(stripTomorrowLead)
      .map(cleanSentence)
  )
    .filter(Boolean)
    .slice(0, 4);

  const reminders = unique(
    tomorrowSentences
      .filter((sentence) => /记得|提醒|别忘|注意/.test(sentence))
      .map(stripTomorrowLead)
      .map(cleanSentence)
  )
    .filter(Boolean)
    .slice(0, 4);

  const scheduleBlocks = buildScheduleBlocks(tomorrowSentences, date);
  const mood = inferMood(transcript);
  const title = inferTitle(events, mustDo);
  const markdown = buildJournalMarkdown({
    title,
    events,
    thoughts,
    wins,
    problems,
    ideas,
    mustDo
  });

  return summarySchema.parse({
    date,
    raw_summary: sourceTexts.slice(0, 4).join("；") || "本次语音会话生成了今日日记和明日安排。",
    journal: {
      title,
      events: events.length ? events : ["完成了一轮语音会话整理"],
      thoughts,
      mood,
      wins,
      problems,
      ideas,
      markdown
    },
    tomorrow_plan: {
      must_do: mustDo,
      schedule_blocks: scheduleBlocks,
      follow_ups: followUps,
      reminders
    }
  });
}

function extractUtterances(transcript: string) {
  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(user|assistant|system):\s*(.+)$/i);
      return {
        role: (match?.[1]?.toLowerCase() ?? "user") as "user" | "assistant" | "system",
        content: match?.[2]?.trim() ?? line
      };
    });
}

function splitSentences(lines: string[]) {
  return lines
    .flatMap((line) => line.split(/[。！？!?；;\n]/))
    .map(cleanSentence)
    .filter(Boolean);
}

function cleanSentence(sentence: string) {
  return sentence.replace(/^(今天|明天|明日|然后|就是|那个|嗯|啊)\s*/g, "").trim();
}

function stripTomorrowLead(sentence: string) {
  return sentence.replace(/^(明天|明日)(早上|上午|中午|下午|晚上)?(先)?/g, "").trim();
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function filterByKeywords(sentences: string[], keywords: string[]) {
  return sentences.filter((sentence) => keywords.some((keyword) => sentence.includes(keyword)));
}

function inferMood(transcript: string) {
  if (/开心|轻松|顺利|满意/.test(transcript)) {
    return "轻松积极";
  }

  if (/焦虑|压力|紧张|着急|累/.test(transcript)) {
    return "有压力但在推进";
  }

  if (/专注|投入|认真/.test(transcript)) {
    return "专注投入";
  }

  return "平稳";
}

function inferTitle(events: string[], mustDo: string[]) {
  const seed = events[0] ?? mustDo[0] ?? "语音会话整理";
  return seed.length > 18 ? `${seed.slice(0, 18)}...` : seed;
}

function buildJournalMarkdown(input: {
  title: string;
  events: string[];
  thoughts: string[];
  wins: string[];
  problems: string[];
  ideas: string[];
  mustDo: string[];
}) {
  const sections = [
    `### 今日日记\n- ${input.events.join("\n- ") || "完成了一轮语音会话整理"}`,
    input.thoughts.length ? `### 想法与感受\n- ${input.thoughts.join("\n- ")}` : "",
    input.wins.length ? `### 今日进展\n- ${input.wins.join("\n- ")}` : "",
    input.problems.length ? `### 当前问题\n- ${input.problems.join("\n- ")}` : "",
    input.ideas.length ? `### 新想法\n- ${input.ideas.join("\n- ")}` : "",
    input.mustDo.length ? `### 明日优先\n- ${input.mustDo.join("\n- ")}` : ""
  ].filter(Boolean);

  return sections.join("\n\n");
}

function buildScheduleBlocks(sentences: string[], date: string) {
  const blocks = sentences
    .map((sentence) => {
      const timeInfo = extractTimeWindow(sentence, date);
      if (!timeInfo) {
        return null;
      }

      return {
        title: stripTomorrowLead(sentence),
        start_time: timeInfo.start,
        end_time: timeInfo.end,
        priority: inferPriority(sentence),
        confidence: inferConfidence(sentence)
      } as const;
    })
    .filter((block): block is NonNullable<typeof block> => Boolean(block));

  return uniqueByTitle(blocks).slice(0, 5);
}

function extractTimeWindow(sentence: string, date: string) {
  const match = sentence.match(/(?:(早上|上午|中午|下午|晚上|今晚))?\s*(\d{1,2})点(?:(\d{1,2})分?)?/);
  if (match) {
    const period = match[1] ?? "";
    let hour = Number(match[2]);
    const minute = Number(match[3] ?? "0");

    if (period === "下午" || period === "晚上" || period === "今晚") {
      if (hour < 12) {
        hour += 12;
      }
    }

    if (period === "中午" && hour < 11) {
      hour += 12;
    }

    return {
      start: buildIso(date, hour, minute),
      end: buildIso(date, Math.min(hour + 1, 23), minute)
    };
  }

  if (/早上|上午/.test(sentence)) {
    return { start: buildIso(date, 9, 0), end: buildIso(date, 10, 0) };
  }

  if (/中午/.test(sentence)) {
    return { start: buildIso(date, 12, 0), end: buildIso(date, 13, 0) };
  }

  if (/下午/.test(sentence)) {
    return { start: buildIso(date, 15, 0), end: buildIso(date, 16, 0) };
  }

  if (/晚上|今晚/.test(sentence)) {
    return { start: buildIso(date, 20, 0), end: buildIso(date, 21, 0) };
  }

  return null;
}

function buildIso(date: string, hour: number, minute: number) {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
}

function inferPriority(sentence: string) {
  if (/必须|优先|先|尽快|立刻/.test(sentence)) {
    return "high" as const;
  }

  if (/可以|有空|顺手/.test(sentence)) {
    return "low" as const;
  }

  return "medium" as const;
}

function inferConfidence(sentence: string) {
  if (/确认|已经约好|一定|明确/.test(sentence)) {
    return "high" as const;
  }

  if (/可能|如果|看看|计划/.test(sentence)) {
    return "medium" as const;
  }

  return "medium" as const;
}

function uniqueByTitle<T extends { title: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) {
      return false;
    }
    seen.add(item.title);
    return true;
  });
}
