import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface DashboardCardProps {
  description: string;
  title: string;
}

function DashboardCard({ description, title }: DashboardCardProps) {
  return (
    <Card className="min-h-44 transition-shadow hover:shadow-md">
      <CardHeader>
        <h2 className="text-base font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>
        <div className="h-16 rounded-md border border-dashed bg-muted/50" />
        <p className="mt-4 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardProps };
