import { Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface AdvertisingCardProps {
  label: string;
  subtitle: string;
  title: string;
}

function AdvertisingCard({ label, subtitle, title }: AdvertisingCardProps) {
  return (
    <aside aria-label={title}>
      <Card className="overflow-hidden border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.08] via-background to-sky-50/70 transition-shadow hover:shadow-md dark:to-sky-950/20">
        <CardHeader className="flex-row items-center gap-3 space-y-0 p-5 sm:p-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {label}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <p className="max-w-md text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </aside>
  );
}

export { AdvertisingCard, type AdvertisingCardProps };
