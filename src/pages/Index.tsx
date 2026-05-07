import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Wrench, Search, Pencil, Trash2, Calendar, MapPin, Phone, User, FileDown } from "lucide-react";
import { ServiceCallForm } from "@/components/ServiceCallForm";
import { PageHeader } from "@/components/AppLayout";
import { generateServiceCallPDF } from "@/lib/pdf";
import { toast } from "sonner";
import { useRole } from "@/hooks/use-role";
import type { Tables } from "@/integrations/supabase/types";

type ServiceCall = Tables<"service_calls">;

const statusLabels: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "bg-warning/10 text-warning border-warning/30" },
  in_progress: { label: "Em execução", cls: "bg-primary/10 text-primary border-primary/30" },
  waiting_parts: { label: "Aguardando peça", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  completed: { label: "Finalizado", cls: "bg-success/10 text-success border-success/30" },
};

const Index = () => {
  const { isStaff } = useRole();
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCall | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "FixFlow — Chamados Técnicos";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("service_calls")
      .select("*")
      .order("service_date", { ascending: false });
    if (error) toast.error(error.message);
    else setCalls(data ?? []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("service_calls").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Chamado excluído"); setCalls((c) => c.filter((x) => x.id !== deleteId)); }
    setDeleteId(null);
  };

  const filtered = useMemo(() => calls.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.client_name.toLowerCase().includes(q)
        || c.address?.toLowerCase().includes(q)
        || c.reported_defect?.toLowerCase().includes(q);
    }
    return true;
  }), [calls, filter, search]);

  const stats = useMemo(() => ({
    open: calls.filter((c) => c.status === "open").length,
    in_progress: calls.filter((c) => c.status === "in_progress").length,
    completed: calls.filter((c) => c.status === "completed").length,
    total: calls.length,
  }), [calls]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Chamados Técnicos"
        subtitle="Gerencie todos os atendimentos da sua operação"
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gradient-brand glow-brand text-primary-foreground border-0">
            <Plus className="w-4 h-4 mr-1" /> Novo chamado
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Abertos", value: stats.open, color: "text-warning" },
          { label: "Em Execução", value: stats.in_progress, color: "text-primary" },
          { label: "Finalizados", value: stats.completed, color: "text-success" },
          { label: "Total", value: stats.total, color: "text-gradient-brand" },
        ].map((s) => (
          <Card key={s.label} className="p-5 card-hover">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">{s.label}</p>
            <p className={`font-display text-3xl font-semibold mt-1 ${s.color}`}>{s.value.toString().padStart(2, "0")}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, endereço, defeito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {[
            { v: "all", l: `Todos (${stats.total})` },
            { v: "open", l: "Abertos" },
            { v: "in_progress", l: "Em execução" },
            { v: "waiting_parts", l: "Aguard. peça" },
            { v: "completed", l: "Finalizados" },
          ].map((f) => (
            <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "outline"} onClick={() => setFilter(f.v)} className="whitespace-nowrap">
              {f.l}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhum chamado encontrado</p>
          <Button className="mt-4" variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Criar primeiro chamado
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((c) => {
            const st = statusLabels[c.status] ?? statusLabels.open;
            return (
              <Card key={c.id} className="p-5 card-hover">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate">{c.client_name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.service_date + "T00:00").toLocaleDateString("pt-BR")}</span>
                          {c.contact && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.contact}</span>}
                          {c.technician && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.technician}</span>}
                        </div>
                      </div>
                      <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                    </div>

                    {c.address && <p className="text-xs text-muted-foreground flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{c.address}</p>}

                    {c.reported_defect && (<div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Defeito</p><p className="text-sm">{c.reported_defect}</p></div>)}
                    {c.service_performed && (<div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Serviço realizado</p><p className="text-sm">{c.service_performed}</p></div>)}
                    {c.parts_replaced && (<div><p className="text-[10px] uppercase text-muted-foreground tracking-wider">Peças trocadas</p><p className="text-sm">{c.parts_replaced}</p></div>)}
                    {c.value != null && <p className="text-sm font-semibold text-gradient-brand">R$ {Number(c.value).toFixed(2).replace(".", ",")}</p>}
                  </div>

                  <div className="flex lg:flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => generateServiceCallPDF(c)} title="Gerar OS em PDF">
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(c); setFormOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ServiceCallForm open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={load} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir chamado?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
