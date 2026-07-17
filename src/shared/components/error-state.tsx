import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  action?: ReactNode;
  description: ReactNode;
  title?: ReactNode;
}

function ErrorState({
  action,
  className,
  description,
  title = "Something went wrong",
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 p-6 text-red-950 dark:border-red-900 dark:bg-red-950 dark:text-red-50",
        className,
      )}
      role="alert"
      {...props}
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export { ErrorState, type ErrorStateProps };
