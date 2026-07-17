import type { PropsWithChildren } from "react";

export function PageShell({ children }: PropsWithChildren) {
  return <main className="container min-h-screen py-8 sm:py-12">{children}</main>;
}
