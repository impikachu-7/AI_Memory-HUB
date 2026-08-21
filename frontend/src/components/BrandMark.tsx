/** Quiet Intelligence Console mark: the protected double-arc memory thread remains visible at useful scale. */

import { cn } from "@/lib/utils";

export function BrandMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span aria-label="AI Memory Hub" className={cn("memory-mark", className)} data-priority={priority} role="img">
      <span className="memory-mark__arc memory-mark__arc--outer" />
      <span className="memory-mark__arc memory-mark__arc--inner" />
      <span className="memory-mark__node" />
    </span>
  );
}

export function BrandLockup({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark priority className="h-9 w-9" />
      {!compact && (
        <span className="font-display text-[15px] font-semibold tracking-[-0.04em] text-foreground">
          AI Memory <span className="text-[color:var(--memory-teal)]">Hub</span>
        </span>
      )}
    </div>
  );
}
