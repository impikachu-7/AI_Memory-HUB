/** Quiet Intelligence Console mark: the protected double-arc memory thread remains visible at useful scale. */

import { cn } from "@/lib/utils";

const MARK_URL = "/manus-storage/ai-memory-hub-logo_2603b235.png";

export function BrandMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <img
      src={MARK_URL}
      alt="AI Memory Hub"
      className={cn("h-9 w-9 object-contain", className)}
      loading={priority ? "eager" : "lazy"}
    />
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
