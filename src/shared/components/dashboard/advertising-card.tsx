import { Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface AdvertisingCardProps {
  subtitle: string;
  title: string;
}

function AdvertisingCard({ subtitle, title }: AdvertisingCardProps) {
  return (
    <aside aria-label={title} className="mx-auto w-full max-w-[420px] py-1.5 sm:py-3">
      <Card className="card-fog card-fog--advertising border-indigo-200/80 bg-indigo-50/60 text-center transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)] dark:border-indigo-950/80">
        <CardHeader className="items-center space-y-3 p-3.5 sm:p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
            <Megaphone aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </CardHeader>
        <CardContent className="p-3.5 pt-0 sm:p-4 sm:pt-0">
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    </aside>
  );
}

export { AdvertisingCard, type AdvertisingCardProps };
