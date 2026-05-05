import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays, Pencil } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import type { Tables } from "@/integrations/supabase/types";

type R = Tables<"reminders">;

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

const empty = { title: "", description: "", due_date: toLocal(new Date().toISOString()) };

export default function RemindersPage() {
  const [list, setList] = useState<R[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<R | null>(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState<string | null>(null);

  useEffect(() => { document.title = "Agenda — FixFlow"; load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("reminders").select("*").order("due_date");
    setList(data ?? []);
  };

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: R) => {
    setEditing(r);
    setForm({ title: r.title, description: r.description ?? "", due_date: toLocal(r.due_date) });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.due_date) { toast.error("Título e data obrigatórios"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      due_date: new Date(form.due_date).toISOString(),
      user_id: u.user.id,
    };
    const { error } = editing
      ? await supabase.from("reminders").update(payload).eq("id", editing.id)
      : await supabase.from("reminders").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Lembrete salvo"); setOpen(false); load(); }
  };

  const toggle = async (r: R) => {
    await supabase.from("reminders").update({ done: !r.done }).eq("id", r.id);
    load();
  };

  const del = async () => {
    if (!delId) return;
    await supabase.from("reminders").delete().eq("id", delId);
    setDelId(null); load();
  };

  const now = new Date();
  const groups = {
    overdue: list.filter((r) => !r.done && new Date(r.due_date) < now),
    upcoming: list.filter((r) => !r.done && new Date(r.due_date) >= now),
    done: list.filter((r) => r.done),
  };

  const Item = ({ r }: { r: R }) => {
    const d = new Date(r.due_date);
    const overdue = !r.done && d < now;
    return (
      <Card className="p-4 card-hover">
        <div className="flex items-start gap-3">
          <Checkbox checked={r.done} onCheckedChange={() => toggle(r)} className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${r.done ? "line-through text-muted-foreground" : ""}`}>{r.title}</div>
            <div className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
              {d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </div>
            {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDelId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Agenda"
        subtitle="Lembretes e retornos programados"
        action={<Button onClick={openNew} className="gradient-brand text-primary-foreground border-0"><Plus className="w-4 h-4 mr-1" /> Novo lembrete</Button>}
      />

      {list.length === 0 ? (
        <Card className="p-12 text-center"><CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" /><p className="text-muted-foreground">Nenhum lembrete</p></Card>
      ) : (
        <div className="space-y-6">
          {groups.overdue.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-destructive mb-2">Atrasados ({groups.overdue.length})</h2>
              <div className="space-y-2">{groups.overdue.map((r) => <Item key={r.id} r={r} />)}</div>
            </section>
          )}
          {groups.upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Próximos ({groups.upcoming.length})</h2>
              <div className="space-y-2">{groups.upcoming.map((r) => <Item key={r.id} r={r} />)}</div>
            </section>
          )}
          {groups.done.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Concluídos ({groups.done.length})</h2>
              <div className="space-y-2">{groups.done.map((r) => <Item key={r.id} r={r} />)}</div>
            </section>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar lembrete" : "Novo lembrete"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Data e hora *</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir lembrete?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={del}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
