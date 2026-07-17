import { ResponsiveContainer } from "@/shared/components/layout/responsive-container";
import { siteConfig } from "@/shared/config/site";

function AppFooter() {
  return (
    <footer className="border-t py-8">
      <ResponsiveContainer>
        <p className="text-sm text-muted-foreground">
          {siteConfig.name} — local information, thoughtfully designed.
        </p>
      </ResponsiveContainer>
    </footer>
  );
}

export { AppFooter };
