import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ServiceCall = Tables<"service_calls">;

const schema = z.object({
  client_name: z.string().trim().min(1, "Nome do cliente é obrigatório").max(200),
  service_date: z.string().min(1, "Data é obrigatória"),
  address: z.string().max(500).optional(),
  contact: z.string().max(100).optional(),
  reported_defect: z.string().max(2000).optional(),
  service_performed: z.string().max(2000).optional(),
  parts_replaced: z.string().max(1000).optional(),
  technician: z.string().max(100).optional(),
  status: z.enum(["open", "in_progress", "completed", "waiting_parts"]),
  value: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: ServiceCall | null;
  onSaved: () => void;
}

const empty = {
  client_name: "",
  service_date: new Date().toISOString().slice(0, 10),
  address: "",
  contact: "",
  reported_defect: "",
  service_performed: "",
  parts_replaced: "",
  technician: "",
  status: "open" as const,
  value: "",
  notes: "",
};

export const ServiceCallForm = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        client_name: editing.client_name,
        service_date: editing.service_date,
        address: editing.address ?? "",
        contact: editing.contact ?? "",
        reported_defect: editing.reported_defect ?? "",
        service_performed: editing.service_performed ?? "",
        parts_replaced: editing.parts_replaced ?? "",
        technician: editing.technician ?? "",
        status: (editing.status as any) ?? "open",
        value: editing.value?.toString() ?? "",
        notes: editing.notes ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [editing, open]);

  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const payload = {
        client_name: parsed.data.client_name,
        service_date: parsed.data.service_date,
        address: parsed.data.address || null,
        contact: parsed.data.contact || null,
        reported_defect: parsed.data.reported_defect || null,
        service_performed: parsed.data.service_performed || null,
        parts_replaced: parsed.data.parts_replaced || null,
        technician: parsed.data.technician || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        value: parsed.data.value ? parseFloat(parsed.data.value.replace(",", ".")) : null,
        user_id: userData.user.id,
      };

      const { error } = editing
        ? await supabase.from("service_calls").update(payload).eq("id", editing.id)
        : await supabase.from("service_calls").insert(payload);

      if (error) throw error;
      toast.success(editing ? "Chamado atualizado" : "Chamado criado");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Chamado" : "Novo Atendimento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Data de atendimento *</Label>
            <Input type="date" value={form.service_date} onChange={(e) => set("service_date", e.target.value)} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label>Técnico responsável</Label>
            <Input value={form.technician} onChange={(e) => set("technician", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Defeito reclamado</Label>
            <Textarea rows={2} value={form.reported_defect} onChange={(e) => set("reported_defect", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Serviço realizado</Label>
            <Textarea rows={3} value={form.service_performed} onChange={(e) => set("service_performed", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Peças trocadas</Label>
            <Textarea rows={2} value={form.parts_replaced} onChange={(e) => set("parts_replaced", e.target.value)} placeholder="Ex: Filtro de ar, Correia dentada" />
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
          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="0,00" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar chamado"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
