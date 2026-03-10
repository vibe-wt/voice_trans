import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";

export function AuthStatus({
  user,
  isDemoMode
}: {
  user: User | null;
  isDemoMode: boolean;
}) {
  if (isDemoMode) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Demo 模式</span>
        <Button asChild variant="secondary">
          <Link href="/login">查看说明</Link>
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <Button asChild variant="secondary">
        <Link href="/login">登录</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="max-w-44 truncate text-sm text-muted">{user.email}</span>
      <form action="/api/auth/signout" method="post">
        <Button type="submit" variant="secondary">
          退出
        </Button>
      </form>
    </div>
  );
}
