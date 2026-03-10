import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Panel } from "@/components/ui/panel";
import { getViewerContext } from "@/lib/auth";

export default async function LoginPage() {
  const viewer = await getViewerContext();

  if (viewer.isAuthenticated) {
    redirect("/voice");
  }

  return (
    <div className="mx-auto max-w-xl">
      <Panel className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">Sign In</p>
          <h1 className="text-3xl font-semibold">登录 AI Voice Journal</h1>
          <p className="text-sm leading-6 text-muted">
            真实环境使用 Supabase 邮箱魔法链接登录。未配置环境变量时，应用保持 demo 模式，页面与 API 继续可用。
          </p>
        </div>

        <LoginForm isDemoMode={viewer.isDemoMode} />
      </Panel>
    </div>
  );
}
