import { Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface AdvertisingCardProps {
  label: string;
  subtitle: string;
  title: string;
}

function AdvertisingCard({ label, subtitle, title }: AdvertisingCardProps) {
  return (
    <aside aria-label={title} className="mx-auto w-full max-w-xl py-2 sm:py-4">
      <Card className="overflow-hidden border-2 border-indigo-200/80 bg-indigo-50/85 text-center transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)] dark:border-indigo-950/80">
        <CardHeader className="items-center space-y-3 p-5 sm:p-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Megaphone aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {label}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:px-6 sm:pb-6 sm:pt-0">
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </aside>
  );
}

export { AdvertisingCard, type AdvertisingCardProps };
