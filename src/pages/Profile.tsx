import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/AppLayout";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export default function Profile() {
  const [userId, setUserId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "FixFlow — Meu Perfil";
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: p } = await supabase.from("profiles").select("full_name, phone, signature_url").eq("id", data.user.id).maybeSingle();
      if (p) {
        setFullName(p.full_name ?? "");
        setPhone(p.phone ?? "");
        setSignatureUrl((p as any).signature_url ?? null);
      }
    })();
  }, []);

  const uploadSignature = async (blob: Blob) => {
    const path = `${userId}/signature-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from("signatures").getPublicUrl(path);
    return data.publicUrl;
  };

  const save = async () => {
    setSaving(true);
    try {
      let url = signatureUrl;
      if (drawn) {
        const blob = await (await fetch(drawn)).blob();
        url = await uploadSignature(blob);
      }
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone, signature_url: url } as any).eq("id", userId);
      if (error) throw error;
      setSignatureUrl(url);
      setDrawn(null);
      toast.success("Perfil salvo");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadSignature(file);
    if (url) {
      await supabase.from("profiles").update({ signature_url: url } as any).eq("id", userId);
      setSignatureUrl(url);
      toast.success("Assinatura enviada");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <PageHeader title="Meu Perfil" subtitle="Suas informações e assinatura digital usada nos relatórios" />

      <Card className="p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-2"><Label>Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div>
            <Label className="text-base">Assinatura digital do técnico</Label>
            <p className="text-xs text-muted-foreground mt-1">Esta assinatura aparecerá automaticamente em todos os relatórios PDF que você gerar.</p>
          </div>

          {signatureUrl && (
            <div className="rounded-lg border border-border p-3 bg-white inline-block">
              <img src={signatureUrl} alt="Assinatura atual" className="h-20 object-contain" />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Desenhar nova assinatura</Label>
            <SignaturePad value={drawn} onChange={setDrawn} height={180} />
          </div>

          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Enviar imagem digitalizada
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</Button>
        </div>
      </Card>
    </div>
  );
}
