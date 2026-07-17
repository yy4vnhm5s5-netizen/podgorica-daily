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
      <Card className="overflow-hidden border-indigo-200/70 bg-indigo-50/60 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-300/80 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)] dark:border-indigo-950/80">
        <CardHeader className="flex-row items-center gap-3 space-y-0 p-5 sm:p-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Megaphone aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {label}
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
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
