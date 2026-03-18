import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KPICard {
  label: string;
  value: string | number;
  delta?: string;
}

interface WorkspaceKPICardsProps {
  cards: KPICard[];
}

export function WorkspaceKPICards({ cards }: WorkspaceKPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.delta && (
              <p className="text-xs text-muted-foreground">{card.delta}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
