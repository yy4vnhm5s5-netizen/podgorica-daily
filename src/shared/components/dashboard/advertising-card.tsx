import { Megaphone } from "lucide-react";

import { Card } from "@/shared/components/ui/card";

interface AdvertisingCardProps {
  subtitle: string;
  title: string;
}

function AdvertisingCard({ subtitle, title }: AdvertisingCardProps) {
  return (
    <aside aria-label={title} className="mx-auto w-full max-w-[520px] py-1 sm:py-2">
      <Card className="border border-dashed border-indigo-200/80 bg-indigo-50/40 shadow-none">
        <div className="flex min-h-14 items-center gap-3 px-3 py-2 sm:min-h-[4.25rem] sm:px-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100/70 text-indigo-700">
            <Megaphone aria-hidden="true" className="size-4" strokeWidth={1.8} />
          </div>
          <p className="min-w-0 flex-1 text-sm font-medium tracking-tight text-foreground">{title}</p>
          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-indigo-700 sm:text-sm">
            {subtitle}
          </span>
        </div>
      </Card>
    </aside>
  );
}

export { AdvertisingCard, type AdvertisingCardProps };
