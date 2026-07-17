import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { siteConfig } from "@/shared/config/site";

interface AppFooterProps {
  tagline: string;
}

function AppFooter({ tagline }: AppFooterProps) {
  return (
    <footer className="border-t py-8">
      <ResponsiveContainer>
        <p className="text-sm text-muted-foreground">
          {siteConfig.name} — {tagline}
        </p>
      </ResponsiveContainer>
    </footer>
  );
}

export { AppFooter, type AppFooterProps };
