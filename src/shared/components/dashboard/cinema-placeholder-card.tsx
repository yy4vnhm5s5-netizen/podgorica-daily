import { Clapperboard } from "lucide-react";

import { DashboardCard } from "@/shared/components/dashboard/dashboard-card";

interface CinemaPlaceholderCardProps {
  actionLabel: string;
  description: string;
  title: string;
}

function CinemaPlaceholderCard({ actionLabel, description, title }: CinemaPlaceholderCardProps) {
  return (
    <DashboardCard
      accent="warning"
      actionLabel={actionLabel}
      description={description}
      icon={Clapperboard}
      title={title}
    />
  );
}

export { CinemaPlaceholderCard, type CinemaPlaceholderCardProps };
