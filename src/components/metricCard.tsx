import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function MetricCard(props: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card className="rounded-2xl gap-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {props.title}
        </CardTitle>
        <div className="text-2xl font-semibold tabular-nums">{props.value}</div>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">{props.subtitle}</div>
      </CardContent>
    </Card>
  );
}
