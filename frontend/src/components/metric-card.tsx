import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "blue" | "green" | "yellow" | "red";
}

const colorMap = {
  blue: "text-blue-400 bg-blue-500/10",
  green: "text-emerald-400 bg-emerald-500/10",
  yellow: "text-amber-400 bg-amber-500/10",
  red: "text-red-400 bg-red-500/10",
};

export function MetricCard({ title, value, icon: Icon, color = "blue" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={cn("p-3 rounded-xl", colorMap[color])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
