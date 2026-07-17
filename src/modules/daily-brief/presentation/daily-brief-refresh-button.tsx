"use client";

import { RefreshButton } from "@/shared/components/refresh-button";

interface DailyBriefRefreshButtonProps {
  label: string;
  title: string;
}

function DailyBriefRefreshButton({ label, title }: DailyBriefRefreshButtonProps) {
  return <RefreshButton disabled label={label} onRefresh={() => undefined} title={title} />;
}

export { DailyBriefRefreshButton, type DailyBriefRefreshButtonProps };
