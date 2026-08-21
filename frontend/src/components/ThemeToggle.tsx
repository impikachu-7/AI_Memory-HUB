/** Quiet Intelligence Console control: a clear, low-motion contrast switch for deliberate reading environments. */

import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:text-foreground active:scale-[0.97] ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
