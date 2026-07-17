"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/components/theme/theme-provider";

function ThemeSwitcher() {
  const { toggleTheme } = useTheme();

  return (
    <Button
      aria-label="Toggle color theme"
      onClick={toggleTheme}
      size="sm"
      title="Toggle color theme"
      variant="outline"
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <span className="sr-only">Toggle color theme</span>
    </Button>
  );
}

export { ThemeSwitcher };
