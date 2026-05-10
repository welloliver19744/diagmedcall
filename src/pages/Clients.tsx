import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, User, Phone, Mail, MapPin, Sparkles, History } from "lucide-react";
import { PageHeader } from "@/components/AppLayout";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
const empty = { name: "", contact: "", email: "", address: "", document: "", notes: "" };

export default function ClientsPage() {
  const [list, setList] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => { document.title = "Clientes — DiagMed Call"; load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("clients").select("*").order("name");
    setList(data ?? []);
    const { data: calls } = await supabase.from("service_calls").select("client_id");
    const c: Record<string, number> = {};
    (calls ?? []).forEach((s: any) => { if (s.client_id) c[s.client_id] = (c[s.client_id] ?? 0) + 1; });
    setCounts(c);
  };

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, contact: c.contact ?? "", email: c.email ?? "", address: c.address ?? "", document: c.document ?? "", notes: c.notes ?? "" });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload: any = {
      name: form.name.trim(),
      contact: form.contact || null, email: form.email || null,
      address: form.address || null, document: form.document || null, notes: form.notes || null,
      user_id: u.user.id,
    };
    const { error } = editing
      ? await supabase.from("clients").update(payload).eq("id", editing.id)
      : await supabase.from("clients").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Cliente salvo"); setOpen(false); load(); }
  };

  const del = async () => {
    if (!delId) return;
    const { error } = await supabase.from("clients").delete().eq("id", delId);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
    setDelId(null);
  };

  const summarizeHistory = async (clientName: string) => {
    toast.info(`Analisando histórico de ${clientName}...`);
    try {
      const { data: calls } = await supabase
        .from("service_calls")
        .select("reported_defect, service_performed, service_date")
        .eq("client_name", clientName)
        .order("service_date", { ascending: false })
        .limit(5);

      if (!calls || calls.length === 0) {
        toast.error("Nenhum histórico encontrado para este cliente.");
        return;
      }

      const historyText = calls.map(c => `Data: ${c.service_date}, Defeito: ${c.reported_defect}, Serviço: ${c.service_performed}`).join("\n");
      
      const localKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!localKey) {
        throw new Error("Chave VITE_GROQ_API_KEY não encontrada no ambiente.");
      }

      console.log("Enviando histórico para IA:", historyText);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            { 
              role: "system", 
              content: "Você é um consultor técnico de engenharia clínica. Resuma o histórico de manutenção deste cliente em 3 pontos principais, destacando recorrências ou alertas. Responda de forma direta." 
            },
            { role: "user", content: `Cliente: ${clientName}\n\nHistórico:\n${historyText}` }
          ],
          temperature: 0.3,
          max_tokens: 500
        }),
      });
      
      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.error?.message || "Erro na resposta do Groq");
      }

      const summary = resData.choices?.[0]?.message?.content;
      if (!summary) throw new Error("IA não retornou conteúdo.");
      
      alert(`Resumo de Histórico (IA):\n\n${summary}`);
    } catch (err: any) {
      console.error("Erro IA:", err);
      toast.error("Erro ao gerar resumo: " + err.message);
    }
  };

  const filtered = list.filter((c) => {
    const s = q.toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.contact?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Clientes"
        subtitle="Cadastro e histórico de atendimentos"
        action={<Button onClick={openNew} className="gradient-brand text-primary-foreground border-0"><Plus className="w-4 h-4 mr-1" /> Novo cliente</Button>}
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="p-5 card-hover">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{counts[c.id] ?? 0} atendimento(s)</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => summarizeHistory(c.name)} title="Resumo IA"><Sparkles className="w-3.5 h-3.5 text-amber-500" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDelId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {c.contact && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" />{c.contact}</div>}
                {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{c.email}</div>}
                {c.address && <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5" />{c.address}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="md:col-span-2 space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Contato</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div className="md:col-span-2 space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="md:col-span-2 space-y-2"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="md:col-span-2 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir cliente?</AlertDialogTitle><AlertDialogDescription>Os chamados ligados ficarão sem cliente vinculado.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={del}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
