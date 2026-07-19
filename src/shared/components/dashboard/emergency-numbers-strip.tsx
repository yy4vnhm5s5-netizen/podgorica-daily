import { Ambulance, Flame, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  emergencyNumbersStripLayout,
  type EmergencyNumber,
} from "@/shared/components/dashboard/emergency-numbers";
import { Card } from "@/shared/components/ui/card";

interface EmergencyNumbersStripProps {
  items: readonly EmergencyNumber[];
  label: string;
}

const emergencyIcons: Record<EmergencyNumber["id"], LucideIcon> = {
  ambulance: Ambulance,
  fireService: Flame,
  police: Shield,
};

function EmergencyNumbersStrip({ items, label }: EmergencyNumbersStripProps) {
  return (
    <aside aria-label={label} className="mt-5">
      <Card className="border-blue-200/80 bg-blue-50/45 shadow-none">
        <ul className={emergencyNumbersStripLayout.list}>
          {items.map(({ href, id, label: itemLabel, number }) => {
            const Icon = emergencyIcons[id];

            return (
              <li className={emergencyNumbersStripLayout.item} key={id}>
                <a
                  aria-label={`${itemLabel}: ${number}`}
                  className={emergencyNumbersStripLayout.link}
                  href={href}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3.5 shrink-0 text-blue-700" strokeWidth={1.8} />
                    {itemLabel}
                  </span>
                  <span className="text-base font-semibold tracking-tight text-foreground tabular-nums">
                    {number}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Card>
    </aside>
  );
}

export { EmergencyNumbersStrip, type EmergencyNumbersStripProps };
