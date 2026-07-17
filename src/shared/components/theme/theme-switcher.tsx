"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { useTheme } from "@/shared/components/theme/theme-provider";

interface ThemeSwitcherProps {
  label: string;
}

function ThemeSwitcher({ label }: ThemeSwitcherProps) {
  const { toggleTheme } = useTheme();

  return (
    <Button aria-label={label} onClick={toggleTheme} size="sm" title={label} variant="outline">
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export { ThemeSwitcher, type ThemeSwitcherProps };
