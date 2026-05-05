import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import type { Tables } from "@/integrations/supabase/types";

type Part = Tables<"parts">;
const empty = { name: "", sku: "", quantity: "0", min_quantity: "0", unit_price: "", notes: "" };

export default function PartsPage() {
  const [list, setList] = useState<Part[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => { document.title = "Estoque — FixFlow"; load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("parts").select("*").order("name");
    setList(data ?? []);
  };

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: Part) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku ?? "", quantity: String(p.quantity),
      min_quantity: String(p.min_quantity), unit_price: p.unit_price?.toString() ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload: any = {
      name: form.name.trim(),
      sku: form.sku || null,
      quantity: parseInt(form.quantity || "0", 10),
      min_quantity: parseInt(form.min_quantity || "0", 10),
      unit_price: form.unit_price ? parseFloat(form.unit_price.replace(",", ".")) : null,
      notes: form.notes || null,
      user_id: u.user.id,
    };
    const { error } = editing
      ? await supabase.from("parts").update(payload).eq("id", editing.id)
      : await supabase.from("parts").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Peça salva"); setOpen(false); load(); }
  };

  const adjust = async (p: Part, delta: number) => {
    const { error } = await supabase.from("parts").update({ quantity: Math.max(0, p.quantity + delta) }).eq("id", p.id);
    if (error) toast.error(error.message); else load();
  };

  const del = async () => {
    if (!delId) return;
    await supabase.from("parts").delete().eq("id", delId);
    setDelId(null); load();
  };

  const filtered = list.filter((p) => {
    const s = q.toLowerCase();
    return !s || p.name.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s);
  });
  const lowStock = list.filter((p) => p.quantity <= p.min_quantity).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Estoque de Peças"
        subtitle={lowStock > 0 ? `${lowStock} item(ns) abaixo do mínimo` : "Controle de quantidades"}
        action={<Button onClick={openNew} className="gradient-brand text-primary-foreground border-0"><Plus className="w-4 h-4 mr-1" /> Nova peça</Button>}
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar peça ou SKU..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center"><Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" /><p className="text-muted-foreground">Nenhuma peça cadastrada</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const low = p.quantity <= p.min_quantity;
            return (
              <Card key={p.id} className="p-4 card-hover">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{p.name}</h3>
                      {low && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1"><AlertTriangle className="w-3 h-3" />Baixo</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground mt-1">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      {p.unit_price != null && <span>R$ {Number(p.unit_price).toFixed(2).replace(".", ",")}</span>}
                      <span>Mín: {p.min_quantity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjust(p, -1)}>−</Button>
                    <span className={`font-display text-xl font-semibold w-10 text-center ${low ? "text-warning" : ""}`}>{p.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => adjust(p, +1)}>+</Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDelId(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar peça" : "Nova peça"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-4 pt-2">
            <div className="col-span-2 space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>SKU/Código</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            <div className="space-y-2"><Label>Preço (R$)</Label><Input value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="0,00" /></div>
            <div className="space-y-2"><Label>Quantidade</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="space-y-2"><Label>Quantidade mínima</Label><Input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></div>
            <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir peça?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={del}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
