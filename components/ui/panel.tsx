import { cn } from "@/lib/utils";

export function Panel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-panel backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}
