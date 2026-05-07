import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/AppLayout";
import { useRole, type AppRole } from "@/hooks/use-role";
import { Plus, Trash2, ShieldCheck, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
}

const roleMeta: Record<AppRole, { label: string; cls: string; icon: any }> = {
  admin: { label: "Administrador", cls: "bg-primary/15 text-primary border-primary/30", icon: ShieldCheck },
  manager: { label: "Gerente", cls: "bg-warning/15 text-warning border-warning/30", icon: ShieldAlert },
  technician: { label: "Técnico", cls: "bg-success/15 text-success border-success/30", icon: Wrench },
};

export default function Team() {
  const { isAdmin, isStaff, userId, loading: roleLoading } = useRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", role: "technician" as AppRole });
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "FixFlow — Equipe"; }, []);

  useEffect(() => {
    if (roleLoading) return;
    if (!isStaff) { setLoading(false); return; }
    load();
  }, [roleLoading, isStaff]);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r: any) => {
      const cur = roleMap.get(r.user_id);
      const order: AppRole[] = ["technician", "manager", "admin"];
      if (!cur || order.indexOf(r.role) > order.indexOf(cur)) roleMap.set(r.user_id, r.role);
    });
    setMembers((profiles ?? []).map((p: any) => ({
      id: p.id, full_name: p.full_name, phone: p.phone,
      role: roleMap.get(p.id) ?? "technician",
    })));
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || form.password.length < 6) { toast.error("E-mail válido e senha de 6+ caracteres"); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("create-technician", { body: form });
    setSaving(false);
    if (error || data?.error) { toast.error(data?.error ?? error?.message ?? "Erro"); return; }
    toast.success("Membro cadastrado");
    setOpen(false);
    setForm({ email: "", password: "", full_name: "", phone: "", role: "technician" });
    load();
  };

  const updateRole = async (uid: string, newRole: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole });
    if (error) toast.error(error.message);
    else { toast.success("Papel atualizado"); load(); }
  };

  const remove = async () => {
    if (!deleteId) return;
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: deleteId } });
    if (error || data?.error) toast.error(data?.error ?? error?.message ?? "Erro");
    else { toast.success("Usuário removido"); load(); }
    setDeleteId(null);
  };

  if (roleLoading || loading) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  if (!isStaff) {
    return (
      <div className="p-8">
        <Card className="p-8 text-center max-w-md mx-auto">
          <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">Apenas administradores e gerentes podem ver esta página.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Equipe"
        subtitle="Gerencie técnicos, gerentes e suas permissões"
        action={isAdmin && (
          <Button onClick={() => setOpen(true)} className="gradient-brand glow-brand text-primary-foreground border-0">
            <Plus className="w-4 h-4 mr-1" /> Novo membro
          </Button>
        )}
      />

      <div className="grid gap-3">
        {members.map((m) => {
          const meta = roleMeta[m.role];
          const Icon = meta.icon;
          const self = m.id === userId;
          return (
            <Card key={m.id} className="p-4 flex items-center gap-4 card-hover">
              <div className="w-10 h-10 rounded-full bg-sidebar-accent grid place-items-center">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium truncate">{m.full_name ?? "—"}</p>
                  {self && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">você</span>}
                </div>
                {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
              </div>
              {isAdmin && !self ? (
                <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as AppRole)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="technician">Técnico</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
              )}
              {isAdmin && !self && (
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(m.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar novo membro</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Nome completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Senha inicial *</Label>
                <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
              <div className="space-y-2"><Label>Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Técnico</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">O membro fará login com o e-mail e a senha que você definir.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Criando..." : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este membro?</AlertDialogTitle>
            <AlertDialogDescription>Acesso será revogado imediatamente. Os chamados atribuídos a ele permanecerão, mas ficarão sem responsável.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
