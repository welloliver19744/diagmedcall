import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/AppLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type SC = Tables<"service_calls">;

const COLORS = ["hsl(217 91% 60%)", "hsl(252 83% 67%)", "hsl(38 92% 50%)", "hsl(142 71% 45%)", "hsl(0 72% 51%)"];

export default function ReportsPage() {
  const [calls, setCalls] = useState<SC[]>([]);

  useEffect(() => {
    document.title = "Relatórios — FixFlow";
    supabase.from("service_calls").select("*").then(({ data }) => setCalls(data ?? []));
  }, []);

  const byMonth = useMemo(() => {
    const months: { key: string; label: string; total: number; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM", { locale: ptBR }), total: 0, revenue: 0 });
    }
    calls.forEach((c) => {
      const k = c.service_date.slice(0, 7);
      const m = months.find((x) => x.key === k);
      if (m) { m.total += 1; m.revenue += Number(c.value ?? 0); }
    });
    return months;
  }, [calls]);

  const byStatus = useMemo(() => {
    const labels: Record<string, string> = { open: "Aberto", in_progress: "Em execução", waiting_parts: "Aguard. peça", completed: "Finalizado" };
    const map: Record<string, number> = {};
    calls.forEach((c) => { map[c.status] = (map[c.status] ?? 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ name: labels[k] ?? k, value: v }));
  }, [calls]);

  const byTechnician = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => { const t = c.technician || "Sem técnico"; map[t] = (map[t] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [calls]);

  const totalRevenue = calls.reduce((s, c) => s + Number(c.value ?? 0), 0);
  const completed = calls.filter((c) => c.status === "completed").length;
  const avg = completed ? totalRevenue / completed : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Relatórios" subtitle="Visão analítica da operação" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total de chamados" value={calls.length.toString()} />
        <Stat label="Finalizados" value={completed.toString()} accent="text-success" />
        <Stat label="Faturamento" value={`R$ ${totalRevenue.toFixed(2).replace(".", ",")}`} accent="text-gradient-brand" />
        <Stat label="Ticket médio" value={`R$ ${avg.toFixed(2).replace(".", ",")}`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Chamados por mês</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Faturamento mensal</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => `R$ ${Number(v).toFixed(2)}`} />
                <Bar dataKey="revenue" fill="hsl(252 83% 67%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Distribuição por status</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={3}>
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs">
            {byStatus.map((s, i) => (
              <div key={s.name} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{s.name}: {s.value}</div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-4">Top técnicos</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byTechnician} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(142 71% 45%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
    </Card>
  );
}
