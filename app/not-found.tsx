import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Panel className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">页面不存在</h1>
        <p className="text-sm text-muted">当前记录不存在，或者数据尚未落库。</p>
        <Button asChild>
          <Link href="/">返回首页</Link>
        </Button>
      </Panel>
    </div>
  );
}
