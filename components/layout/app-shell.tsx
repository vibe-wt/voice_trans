import Link from "next/link";
import { Mic, ScrollText, CalendarRange, History, Settings } from "lucide-react";
import { AuthStatus } from "@/components/auth/auth-status";
import { getViewerContext } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/voice", label: "语音", icon: Mic },
  { href: "/today/demo-session", label: "今日", icon: ScrollText },
  { href: "/tomorrow/demo-session", label: "明日", icon: CalendarRange },
  { href: "/history", label: "历史", icon: History },
  { href: "/settings", label: "设置", icon: Settings }
];

export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerContext();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-5 md:px-6">
      <header className="mb-6 flex items-center justify-between rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-3 shadow-panel backdrop-blur">
        <Link className="text-lg font-semibold tracking-tight" href="/">
          AI Voice Journal
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <nav className="items-center gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted transition hover:bg-slate-100 hover:text-foreground"
                )}
                href={href}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
          <AuthStatus isDemoMode={viewer.isDemoMode} user={viewer.user} />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="sticky bottom-4 mt-8 grid grid-cols-5 gap-2 rounded-[1.4rem] border border-white/70 bg-white/90 p-2 shadow-panel backdrop-blur md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            className="flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs text-muted"
            href={href}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
