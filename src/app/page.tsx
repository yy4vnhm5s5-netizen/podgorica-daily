import { PageShell } from "@/shared/components/layout/page-shell";
import { Button } from "@/shared/components/ui/button";
import { siteConfig } from "@/shared/config/site";

export default function HomePage() {
  return (
    <PageShell>
      <section className="mx-auto flex max-w-2xl flex-col gap-6 py-16 sm:py-24">
        <p className="text-sm font-medium text-muted-foreground">Foundation</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{siteConfig.name}</h1>
        <p className="max-w-prose text-base leading-7 text-muted-foreground sm:text-lg">
          {siteConfig.description}
        </p>
        <div>
          <Button asChild variant="outline">
            <a href="https://github.com/yy4vnhm5s5-netizen/podgorica-daily">Project source</a>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
