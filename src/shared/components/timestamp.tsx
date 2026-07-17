import type { ComponentProps } from "react";

import { formatDateTime } from "@/shared/lib/date";

interface TimestampProps extends Omit<ComponentProps<"time">, "children" | "dateTime"> {
  formatOptions?: Intl.DateTimeFormatOptions;
  locale?: string;
  value: Date;
}

function Timestamp({ formatOptions, locale, value, ...props }: TimestampProps) {
  const { dateTime, label } = formatDateTime(value, { formatOptions, locale });

  return (
    <time dateTime={dateTime} {...props}>
      {label}
    </time>
  );
}

export { Timestamp, type TimestampProps };
