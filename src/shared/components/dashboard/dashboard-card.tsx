import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

interface DashboardCardProps {
  title: string;
}

function DashboardCard({ title }: DashboardCardProps) {
  return (
    <Card className="min-h-44 transition-shadow hover:shadow-md">
      <CardHeader>
        <h2 className="text-base font-semibold">{title}</h2>
      </CardHeader>
      <CardContent>
        <div className="h-16 rounded-md border border-dashed bg-muted/50" />
        <p className="mt-4 text-sm text-muted-foreground">No information is available yet.</p>
      </CardContent>
    </Card>
  );
}

export { DashboardCard, type DashboardCardProps };
