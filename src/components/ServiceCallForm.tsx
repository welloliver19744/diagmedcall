import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type ClientRow = Tables<"clients">;
type ServiceCall = Tables<"service_calls">;

interface PartLine { number: string; description: string; qty: string; nr_op: string; }

const schema = z.object({
  client_name: z.string().trim().min(1, "Cliente é obrigatório").max(200),
  service_date: z.string().min(1, "Data é obrigatória"),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ServiceCall | null;
  onSaved: () => void;
}

const empty = {
  report_type: "litotripsia" as "litotripsia" | "laser",
  report_number: "",
  client_name: "",
  service_date: new Date().toISOString().slice(0, 10),
  address: "",
  contact: "",
  technician: "",
  equipment_type: "",
  equipment_serial: "",
  responsible_employee: "",
  installed_at: "",
  in_warranty: "" as "" | "sim" | "nao",
  in_contract: "" as "" | "sim" | "nao",
  transformer_serial: "",
  counter_odometer: "",
  lot_number: "",
  working_before: "" as "" | "sim" | "nao",
  reported_defect: "",
  service_performed: "",
  verified_tested: "" as "" | "sim" | "nao",
  working_after: "" as "" | "sim" | "nao",
  parts_replaced: "",
  parts_priority: "" as "" | "padrao" | "urgente",
  notes: "",
  approved_by: "",
  status: "open" as "open" | "in_progress" | "completed" | "waiting_parts",
  value: "",
};

const triBool = (v: "" | "sim" | "nao"): boolean | null => v === "sim" ? true : v === "nao" ? false : null;
const fromBool = (v: boolean | null | undefined): "" | "sim" | "nao" => v === true ? "sim" : v === false ? "nao" : "";

export const ServiceCallForm = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [techs, setTechs] = useState<{ id: string; full_name: string | null }[]>([]);
  const [assignedTo, setAssignedTo] = useState<string>("_none");
  const [partsUsed, setPartsUsed] = useState<PartLine[]>([]);
  const [partsRequested, setPartsRequested] = useState<PartLine[]>([]);
  const [clientSignature, setClientSignature] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      supabase.from("clients").select("*").order("name").then(({ data }) => setClients(data ?? []));
      supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => setTechs(data ?? []));
    }
  }, [open]);

  const pickClient = (id: string) => {
    setClientId(id);
    if (id === "_none") return;
    const c = clients.find((x) => x.id === id);
    if (c) setForm((s) => ({ ...s, client_name: c.name, contact: c.contact ?? s.contact, address: c.address ?? s.address }));
  };

  useEffect(() => {
    if (editing) {
      const e: any = editing;
      setForm({
        report_type: (e.report_type as any) ?? "litotripsia",
        report_number: e.report_number ?? "",
        client_name: e.client_name,
        service_date: e.service_date,
        address: e.address ?? "",
        contact: e.contact ?? "",
        technician: e.technician ?? "",
        equipment_type: e.equipment_type ?? "",
        equipment_serial: e.equipment_serial ?? "",
        responsible_employee: e.responsible_employee ?? "",
        installed_at: e.installed_at ?? "",
        in_warranty: fromBool(e.in_warranty),
        in_contract: fromBool(e.in_contract),
        transformer_serial: e.transformer_serial ?? "",
        counter_odometer: e.counter_odometer ?? "",
        lot_number: e.lot_number ?? "",
        working_before: fromBool(e.working_before),
        reported_defect: e.reported_defect ?? "",
        service_performed: e.service_performed ?? "",
        verified_tested: fromBool(e.verified_tested),
        working_after: fromBool(e.working_after),
        parts_replaced: e.parts_replaced ?? "",
        parts_priority: (e.parts_priority as any) ?? "",
        notes: e.notes ?? "",
        approved_by: e.approved_by ?? "",
        status: e.status ?? "open",
        value: e.value?.toString() ?? "",
      });
      setPartsUsed(Array.isArray(e.parts_used) ? e.parts_used : []);
      setPartsRequested(Array.isArray(e.parts_requested) ? e.parts_requested : []);
      setClientSignature(e.client_signature ?? null);
    } else {
      setForm(empty);
      setPartsUsed([]);
      setPartsRequested([]);
      setClientSignature(null);
    }
    setClientId(editing?.client_id ?? "");
    setAssignedTo((editing as any)?.assigned_to ?? "_none");
  }, [editing, open]);

  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const addLine = (kind: "used" | "req") => {
    const ln: PartLine = { number: "", description: "", qty: "", nr_op: "" };
    if (kind === "used") setPartsUsed((s) => [...s, ln]);
    else setPartsRequested((s) => [...s, ln]);
  };
  const updLine = (kind: "used" | "req", i: number, k: keyof PartLine, v: string) => {
    const upd = (s: PartLine[]) => s.map((x, idx) => idx === i ? { ...x, [k]: v } : x);
    if (kind === "used") setPartsUsed(upd); else setPartsRequested(upd);
  };
  const rmLine = (kind: "used" | "req", i: number) => {
    const upd = (s: PartLine[]) => s.filter((_, idx) => idx !== i);
    if (kind === "used") setPartsUsed(upd); else setPartsRequested(upd);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const payload: any = {
        report_type: form.report_type,
        report_number: form.report_number || null,
        client_name: form.client_name,
        service_date: form.service_date,
        address: form.address || null,
        contact: form.contact || null,
        technician: form.technician || null,
        equipment_type: form.equipment_type || null,
        equipment_serial: form.equipment_serial || null,
        responsible_employee: form.responsible_employee || null,
        installed_at: form.installed_at || null,
        in_warranty: triBool(form.in_warranty),
        in_contract: triBool(form.in_contract),
        transformer_serial: form.transformer_serial || null,
        counter_odometer: form.counter_odometer || null,
        lot_number: form.lot_number || null,
        working_before: triBool(form.working_before),
        reported_defect: form.reported_defect || null,
        service_performed: form.service_performed || null,
        verified_tested: triBool(form.verified_tested),
        working_after: triBool(form.working_after),
        parts_replaced: form.parts_replaced || null,
        parts_priority: form.parts_priority || null,
        parts_used: partsUsed,
        parts_requested: partsRequested,
        notes: form.notes || null,
        approved_by: form.approved_by || null,
        status: form.status,
        value: form.value ? parseFloat(form.value.replace(",", ".")) : null,
        client_signature: clientSignature,
        user_id: userData.user.id,
        client_id: clientId && clientId !== "_none" ? clientId : null,
        assigned_to: assignedTo && assignedTo !== "_none" ? assignedTo : null,
      };

      const { error } = editing
        ? await supabase.from("service_calls").update(payload).eq("id", editing.id)
        : await supabase.from("service_calls").insert(payload);

      if (error) throw error;
      toast.success(editing ? "Relatório atualizado" : "Relatório criado");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const TriRadio = ({ value, onChange }: { value: "" | "sim" | "nao"; onChange: (v: any) => void }) => (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-4">
      <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="sim" /> Sim</label>
      <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="nao" /> Não</label>
    </RadioGroup>
  );

  const PartsTable = ({ kind, lines }: { kind: "used" | "req"; lines: PartLine[] }) => (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-muted-foreground tracking-wider px-1">
        <span className="col-span-2">Número</span><span className="col-span-6">Descrição</span>
        <span className="col-span-1">Qtd.</span><span className="col-span-2">NR / OP</span><span></span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-2">
          <Input className="col-span-2 h-8" value={l.number} onChange={(e) => updLine(kind, i, "number", e.target.value)} />
          <Input className="col-span-6 h-8" value={l.description} onChange={(e) => updLine(kind, i, "description", e.target.value)} />
          <Input className="col-span-1 h-8" value={l.qty} onChange={(e) => updLine(kind, i, "qty", e.target.value)} />
          <Input className="col-span-2 h-8" value={l.nr_op} onChange={(e) => updLine(kind, i, "nr_op", e.target.value)} />
          <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8" onClick={() => rmLine(kind, i)}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => addLine(kind)}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar peça
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Relatório" : "Novo Relatório de Chamada de Serviço"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Modelo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg border border-border bg-sidebar-accent/30">
            <div className="space-y-2">
              <Label>Modelo do relatório *</Label>
              <Select value={form.report_type} onValueChange={(v) => set("report_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="litotripsia">Litotripsia</SelectItem>
                  <SelectItem value="laser">Laser</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relatório Nº</Label>
              <Input value={form.report_number} onChange={(e) => set("report_number", e.target.value)} placeholder="000/2026" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em execução</SelectItem>
                  <SelectItem value="waiting_parts">Aguardando peça</SelectItem>
                  <SelectItem value="completed">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="dados">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="equip">Equipamento</TabsTrigger>
              <TabsTrigger value="servico">Serviço</TabsTrigger>
              <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Vincular cliente cadastrado</Label>
                <Select value={clientId} onValueChange={pickClient}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Nenhum —</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cliente *</Label>
                  <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} required /></div>
                <div className="space-y-2"><Label>Data *</Label>
                  <Input type="date" value={form.service_date} onChange={(e) => set("service_date", e.target.value)} required /></div>
              </div>
              <div className="space-y-2"><Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contato</Label>
                  <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} /></div>
                <div className="space-y-2"><Label>Colaborador responsável em atender</Label>
                  <Input value={form.responsible_employee} onChange={(e) => set("responsible_employee", e.target.value)} /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Técnico executor (atribuído)</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger><SelectValue placeholder="Atribuir..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Sem atribuição —</SelectItem>
                      {techs.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name ?? t.id.slice(0, 8)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Nome do técnico (impresso no relatório)</Label>
                  <Input value={form.technician} onChange={(e) => set("technician", e.target.value)} placeholder="Auto-preenchido com o atribuído"/></div>
              </div>
            </TabsContent>

            <TabsContent value="equip" className="space-y-4 pt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Tipo de equipamento</Label>
                  <Input value={form.equipment_type} onChange={(e) => set("equipment_type", e.target.value)} /></div>
                <div className="space-y-2"><Label>Número de série</Label>
                  <Input value={form.equipment_serial} onChange={(e) => set("equipment_serial", e.target.value)} /></div>
                <div className="space-y-2"><Label>Instalado em</Label>
                  <Input type="date" value={form.installed_at} onChange={(e) => set("installed_at", e.target.value)} /></div>
                <div className="space-y-2"><Label>Contador / Odômetro</Label>
                  <Input value={form.counter_odometer} onChange={(e) => set("counter_odometer", e.target.value)} /></div>
                <div className="space-y-2"><Label>Nº Série Transformador Principal</Label>
                  <Input value={form.transformer_serial} onChange={(e) => set("transformer_serial", e.target.value)} /></div>
                <div className="space-y-2"><Label>Nº lote (consumíveis)</Label>
                  <Input value={form.lot_number} onChange={(e) => set("lot_number", e.target.value)} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2"><Label>Em garantia?</Label>
                  <TriRadio value={form.in_warranty} onChange={(v) => set("in_warranty", v)} /></div>
                <div className="space-y-2"><Label>Em contrato de manutenção?</Label>
                  <TriRadio value={form.in_contract} onChange={(v) => set("in_contract", v)} /></div>
                <div className="space-y-2"><Label>Funcionava antes do reparo?</Label>
                  <TriRadio value={form.working_before} onChange={(v) => set("working_before", v)} /></div>
              </div>
            </TabsContent>

            <TabsContent value="servico" className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Descrição do problema</Label>
                <Textarea rows={3} value={form.reported_defect} onChange={(e) => set("reported_defect", e.target.value)} /></div>
              <div className="space-y-2"><Label>Causa diagnosticada e ação corretiva / reparo realizado</Label>
                <Textarea rows={4} value={form.service_performed} onChange={(e) => set("service_performed", e.target.value)} /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Verificado e testado?</Label>
                  <TriRadio value={form.verified_tested} onChange={(v) => set("verified_tested", v)} /></div>
                <div className="space-y-2"><Label>Voltou a funcionar após o reparo?</Label>
                  <TriRadio value={form.working_after} onChange={(v) => set("working_after", v)} /></div>
              </div>

              {form.report_type === "laser" ? (
                <>
                  <div className="space-y-2 pt-2">
                    <Label className="text-base">Peças utilizadas do estoque</Label>
                    <PartsTable kind="used" lines={partsUsed} />
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label className="text-base">Peças a serem requisitadas</Label>
                      <RadioGroup value={form.parts_priority} onValueChange={(v) => set("parts_priority", v)} className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="padrao" /> Padrão</label>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><RadioGroupItem value="urgente" /> Urgente</label>
                      </RadioGroup>
                    </div>
                    <PartsTable kind="req" lines={partsRequested} />
                  </div>
                </>
              ) : (
                <div className="space-y-2"><Label>Peças trocadas</Label>
                  <Textarea rows={2} value={form.parts_replaced} onChange={(e) => set("parts_replaced", e.target.value)} /></div>
              )}
            </TabsContent>

            <TabsContent value="fechamento" className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Observações</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Relatório aprovado por</Label>
                  <Input value={form.approved_by} onChange={(e) => set("approved_by", e.target.value)} /></div>
                <div className="space-y-2"><Label>Valor (R$) — opcional</Label>
                  <Input value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="0,00" /></div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-base">Assinatura do cliente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                <p className="text-xs text-muted-foreground">A assinatura do técnico é aplicada automaticamente do seu perfil.</p>
                <SignaturePad value={clientSignature} onChange={setClientSignature} height={160} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar relatório"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
