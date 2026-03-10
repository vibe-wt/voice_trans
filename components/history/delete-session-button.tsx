"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteSessionButton({
  sessionId,
  redirectTo
}: {
  sessionId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleDelete() {
    const confirmed = window.confirm("删除后会移除该会话、日记、任务和 transcript。是否继续？");
    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(`/api/session/${sessionId}`, {
        method: "DELETE"
      });
      const json = await response.json();

      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message ?? "删除会话失败。");
      }

      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除会话失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button disabled={loading} onClick={handleDelete} variant="ghost">
        {loading ? "删除中..." : "删除会话"}
      </Button>
      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
    </div>
  );
}
