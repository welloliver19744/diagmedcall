import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignaturePad } from "@/components/SignaturePad";
import { generateServiceCallPDF } from "@/lib/pdf";
import { toast } from "sonner";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import logoUrl from "@/assets/diagnostic-logo.jpg";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function ClientPortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [signature, setSignature] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/get-service-call-by-token?token=${token}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao carregar relatório");
      setData(json);
      if (json.service_call?.client_signature) setSignature(json.service_call.client_signature);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const handleSign = async () => {
    if (!signature) { toast.error("Desenhe sua assinatura primeiro"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/submit-client-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signature }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro");
      toast.success("Assinatura registrada!");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!data) return;
    try {
      // Prioriza a assinatura do estado local (recém-feita) ou a do banco
      const currentSignature = signature || data.service_call?.client_signature;
      
      const sc = { ...data.service_call, client_signature: currentSignature };
      await generateServiceCallPDF(sc, {
        techName: data.technician?.full_name,
        techSignatureUrl: data.technician?.signature_url,
      });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md"><CardContent className="pt-6 text-center">
        <p className="text-destructive font-medium">Link inválido ou expirado</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </CardContent></Card>
    </div>
  );

  const sc = data.service_call;
  const alreadySigned = !!data.service_call?.client_signature;

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <img src={logoUrl} alt="Logo" className="h-12 w-auto" />
          <div>
            <h1 className="font-bold text-lg">Relatório de Serviço</h1>
            <p className="text-xs text-muted-foreground">Diagnostic Medical</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">{sc.client_name}</CardTitle>
              <Badge variant="outline" className={
                sc.status === "completed" ? "bg-success/10 text-success border-success/30" : 
                sc.status === "in_progress" ? "bg-primary/10 text-primary border-primary/30" :
                sc.status === "waiting_parts" ? "bg-destructive/10 text-destructive border-destructive/30" :
                "bg-warning/10 text-warning border-warning/30"
              }>
                {sc.status === "completed" ? "Finalizado" : 
                 sc.status === "in_progress" ? "Em execução" : 
                 sc.status === "waiting_parts" ? "Aguardando peça" : 
                 "Aberto"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Relatório Nº" value={sc.report_number} />
            <Row label="Data" value={new Date(sc.service_date + "T00:00").toLocaleDateString("pt-BR")} />
            <Row label="Equipamento" value={sc.equipment_type} />
            <Row label="Nº de Série" value={sc.equipment_serial} />
            <Row label="Técnico" value={data.technician?.full_name || sc.technician} />
            <Row label="Defeito relatado" value={sc.reported_defect} multiline />
            <Row label="Serviço executado" value={sc.service_performed} multiline />
            {sc.parts_replaced && <Row label="Peças trocadas" value={sc.parts_replaced} multiline />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Sua assinatura</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {alreadySigned ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Assinatura já registrada
                </div>
                <img src={data.service_call.client_signature} alt="Assinatura" className="border rounded bg-white max-h-32" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Desenhe sua assinatura abaixo para confirmar o serviço.</p>
                <SignaturePad value={signature} onChange={setSignature} />
                <Button onClick={handleSign} disabled={submitting || !signature} className="w-full">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar assinatura
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleDownload} variant="outline" className="w-full" size="lg">
          <Download className="mr-2 h-4 w-4" /> Baixar PDF do relatório
        </Button>

        <p className="text-xs text-center text-muted-foreground pt-4">
          Diagnostic Medical · Relatório F:024
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className={multiline ? "" : "flex justify-between gap-4"}>
      <span className="text-muted-foreground text-xs uppercase font-medium">{label}</span>
      <span className={multiline ? "block mt-1 whitespace-pre-wrap" : "text-right"}>{value || "—"}</span>
    </div>
  );
}
