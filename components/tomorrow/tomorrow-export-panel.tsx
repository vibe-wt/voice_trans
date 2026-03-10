"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { PlannedTask } from "@/types/task";

export function TomorrowExportPanel({
  sessionId,
  tasks
}: {
  sessionId: string;
  tasks: PlannedTask[];
}) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(tasks.map((task) => task.id));
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [webcalUrl, setWebcalUrl] = useState("");
  const [isPreparingFeed, setIsPreparingFeed] = useState(false);

  const selectedCount = selectedTaskIds.length;
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.includes(task.id)),
    [selectedTaskIds, tasks]
  );
  useEffect(() => {
    let cancelled = false;

    async function prepareFeed() {
      try {
        setIsPreparingFeed(true);
        const response = await fetch("/api/calendar/feed", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionId
          })
        });

        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json?.error?.message ?? "生成订阅链接失败。");
        }

        if (!cancelled) {
          setFeedUrl(json.data.feedUrl as string);
          setWebcalUrl(json.data.webcalUrl as string);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "生成订阅链接失败。");
        }
      } finally {
        if (!cancelled) {
          setIsPreparingFeed(false);
        }
      }
    }

    void prepareFeed();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleExport() {
    try {
      setIsExporting(true);
      setErrorMessage("");

      const response = await fetch("/api/calendar/ics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          taskIds: selectedTaskIds
        })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? "导出 ICS 失败。");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-plan-${selectedTasks[0]?.taskDate ?? "today"}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "导出 ICS 失败。");
    } finally {
      setIsExporting(false);
    }
  }

  function toggleTask(taskId: string, checked: boolean) {
    setSelectedTaskIds((current) =>
      checked ? Array.from(new Set([...current, taskId])) : current.filter((id) => id !== taskId)
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">Tomorrow Plan</p>
          <h1 className="text-3xl font-semibold">明日安排候选</h1>
          <p className="text-sm text-muted">
            勾选后导出为 Apple Calendar 兼容的 ICS 文件。在 iPhone 上打开后，可直接加入系统日历。
          </p>
        </div>
        <Button disabled={!selectedCount || isExporting} onClick={handleExport}>
          {isExporting ? "导出中..." : `导出到 iOS 日历 (${selectedCount})`}
        </Button>
      </div>

      <Panel className="space-y-2">
        <h2 className="text-lg font-semibold">iPhone 导入方式</h2>
        <p className="text-sm text-muted">点击上方按钮下载 `.ics` 后，在 iPhone 上选择“日历”打开，即可导入 Apple Calendar。</p>
        <p className="text-sm text-muted">未填写具体时间的事项会作为“全天事件”进入日历，后续可在系统日历里再调整时间。</p>
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      </Panel>

      <Panel className="space-y-3">
        <h2 className="text-lg font-semibold">iOS 日历订阅</h2>
        <p className="text-sm text-muted">
          如果你希望当前这组安排在 iPhone 日历里以“订阅日历”的方式打开，可以使用下面的 `webcal` 链接。
        </p>
        <div className="space-y-2 rounded-[1rem] bg-slate-50 p-4 text-sm">
          <p className="break-all text-foreground">{webcalUrl || "连接后可生成订阅地址"}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href={feedUrl || "#"} target="_blank">
                {isPreparingFeed ? "生成中..." : "打开 Feed"}
              </a>
            </Button>
            <Button
              onClick={() => {
                if (webcalUrl) {
                  void navigator.clipboard.writeText(webcalUrl);
                }
              }}
              disabled={!webcalUrl}
              variant="secondary"
            >
              复制 webcal 链接
            </Button>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4">
        {tasks.map((task) => {
          const checked = selectedTaskIds.includes(task.id);

          return (
            <Panel key={task.id} className="flex items-start gap-4">
              <input
                aria-label={`选择任务 ${task.title}`}
                checked={checked}
                className="mt-1 size-4 rounded border-border"
                onChange={(event) => toggleTask(task.id, event.target.checked)}
                type="checkbox"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{task.title}</h2>
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                    {task.priority}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                    {task.confidence}
                  </span>
                  {!task.startTime ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                      全天事件
                    </span>
                  ) : null}
                  {task.calendarEventId ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                      已绑定日历
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted">
                  {task.startTime ?? "全天"} - {task.endTime ?? "待补充"} | 来源：{task.sourceType}
                </p>
                {task.location ? <p className="text-sm text-muted">地点：{task.location}</p> : null}
                {task.notes ? <p className="text-sm text-muted whitespace-pre-wrap">备注：{task.notes}</p> : null}
                {task.calendarEventId ? (
                  <p className="text-sm text-muted">
                    日历来源：{task.calendarSource ?? "ios_eventkit"} | 事件 ID：{task.calendarEventId}
                  </p>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
