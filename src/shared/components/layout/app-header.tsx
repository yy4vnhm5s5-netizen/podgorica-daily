import { CommandTrigger } from "@/shared/components/layout/command-trigger";
import { Navigation } from "@/shared/components/layout/navigation";
import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { ThemeSwitcher } from "@/shared/components/theme/theme-switcher";
import { siteConfig } from "@/shared/config/site";

function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <ResponsiveContainer className="flex h-16 items-center justify-between gap-4">
        <a className="shrink-0 text-sm font-semibold tracking-tight" href="#dashboard">
          {siteConfig.name}
        </a>
        <div className="hidden flex-1 justify-center md:flex">
          <Navigation />
        </div>
        <div className="flex items-center gap-2">
          <CommandTrigger />
          <ThemeSwitcher />
        </div>
      </ResponsiveContainer>
    </header>
  );
}

export { AppHeader };
