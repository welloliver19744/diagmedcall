import jsPDF from "jspdf";
import logoUrl from "@/assets/diagnostic-logo.jpg";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SC = Tables<"service_calls"> & {
  report_type?: string | null;
  report_number?: string | null;
  equipment_type?: string | null;
  equipment_serial?: string | null;
  responsible_employee?: string | null;
  installed_at?: string | null;
  in_warranty?: boolean | null;
  in_contract?: boolean | null;
  transformer_serial?: string | null;
  counter_odometer?: string | null;
  lot_number?: string | null;
  working_before?: boolean | null;
  verified_tested?: boolean | null;
  working_after?: boolean | null;
  approved_by?: string | null;
  client_signature?: string | null;
  parts_used?: any;
  parts_requested?: any;
  parts_priority?: string | null;
};

const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00").toLocaleDateString("pt-BR") : "";

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); });
  } catch { return null; }
}

export async function generateServiceCallPDF(
  c: SC,
  preloaded?: { techName?: string | null; techSignatureUrl?: string | null }
) {
  let techSignature: string | null = null;
  let clientSignature: string | null = null;
  let techName = c.technician ?? "";

  // Preload technician signature
  if (preloaded) {
    techName = techName || preloaded.techName || "";
    if (preloaded.techSignatureUrl) techSignature = await urlToDataUrl(preloaded.techSignatureUrl);
  } else {
    // Tenta pegar do usuário atual logado primeiro (fallback mais seguro)
    const { data: authData } = await supabase.auth.getUser();
    const currentUser = authData.user;
    
    if (currentUser && (!c.technician || c.technician === currentUser.user_metadata?.full_name)) {
      techName = techName || currentUser.user_metadata?.full_name || "";
      const sig = currentUser.user_metadata?.signature_url;
      if (sig) {
        techSignature = sig.startsWith("http") ? await urlToDataUrl(sig) : sig;
      }
    }

    // Se não pegou do user atual ou precisa de outro técnico, tenta a tabela profiles
    if (!techSignature && (c as any).assigned_to) {
      const { data } = await supabase.from("profiles").select("full_name, signature_url").eq("id", (c as any).assigned_to).maybeSingle();
      if (data) {
        techName = techName || data.full_name || "";
        const sig = (data as any).signature_url;
        if (sig) {
          techSignature = sig.startsWith("http") ? await urlToDataUrl(sig) : sig;
        }
      }
    }
  }

  // Preload client signature if it's a URL (from Supabase storage)
  if (c.client_signature) {
    if (c.client_signature.startsWith("http")) {
      clientSignature = await urlToDataUrl(c.client_signature);
    } else {
      clientSignature = c.client_signature; // already a dataUrl
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const M = 10;
  const RW = W - 2 * M;
  const MAX_Y = H - M; // 287mm

  // ---- Main Page Border ----
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(M, M, RW, H - 2 * M);

  // ---- Header ----
  doc.rect(M, M, RW, 22);
  // Logo
  try { doc.addImage(logoUrl, "JPEG", M + 1, M + 1, 30, 20); } catch {}
  // Center text
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("SISTEMA DE GESTÃO DA QUALIDADE", W / 2, M + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text("Setor: Administrativo / Assistência Técnica", W / 2, M + 12, { align: "center" });
  // Right - version table
  const rx = W - M - 50;
  doc.setFontSize(7);
  doc.rect(rx, M, 50, 22);
  doc.line(rx + 25, M, rx + 25, M + 15); // vertical line for version/revision
  doc.line(rx, M + 8, rx + 50, M + 8); // horizontal line below labels
  doc.line(rx, M + 15, rx + 50, M + 15); // horizontal line below dates
  
  doc.setFont("helvetica", "bold");
  doc.text("Versão", rx + 12.5, M + 4, { align: "center" });
  doc.text("002", rx + 19, M + 4, { align: "left" });
  doc.text("Revisão", rx + 37.5, M + 4, { align: "center" });
  doc.text("005", rx + 44, M + 4, { align: "left" });
  
  doc.setFont("helvetica", "bold");
  doc.text("25/07/ 2021", rx + 12.5, M + 12, { align: "center" });
  doc.text("05/06/2024", rx + 37.5, M + 12, { align: "center" });
  
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Datas", rx + 25, M + 20, { align: "center" });

  // Title bar
  let y = M + 22;
  doc.rect(M, y, RW, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Título: F: 024; RELATÓRIO DE CHAMADA DE SERVIÇO (AT)", M + 20, y + 5.5);
  
  // Page number box
  const pgW = 25;
  doc.rect(W - M - pgW, y, pgW, 8);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Nº página", W - M - pgW + 2, y + 5.5);
  doc.setFont("helvetica", "bold");
  doc.text("1/1", W - M - 2, y + 5.5, { align: "right" });
  y += 8;

  // Helper: row of cells
  const cellH = 9; // Reduzi um pouco a altura das células padrão
  doc.setFontSize(8);

  const drawCell = (x: number, yy: number, w: number, h: number, label: string, value?: string | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6); doc.setTextColor(80);
    doc.text(label, x + 1.2, yy + 2.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0);
    const lines = doc.splitTextToSize(value ?? "", w - 2.4);
    doc.text(lines.slice(0, 1), x + 1.2, yy + 6.5); // Limitei a 1 linha para economizar espaço
  };

  const drawCheckCell = (x: number, yy: number, w: number, h: number, label: string, val?: boolean | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(0);
    doc.text(label, x + 1.2, yy + h / 2 + 1);
    
    const textW = doc.getTextWidth(label);
    const boxSize = 2.4;
    const boxY = yy + h / 2 - boxSize / 2;
    const textY = yy + h / 2 + 1;

    // SIM
    const simBoxX = x + textW + 3;
    doc.setLineWidth(0.2);
    doc.rect(simBoxX, boxY, boxSize, boxSize);
    doc.text("SIM", simBoxX + boxSize + 1, textY);
    if (val === true) doc.text("X", simBoxX + 0.5, textY);

    // NÃO
    const naoBoxX = simBoxX + 10;
    doc.rect(naoBoxX, boxY, boxSize, boxSize);
    doc.text("NÃO", naoBoxX + boxSize + 1, textY);
    if (val === false) doc.text("X", naoBoxX + 0.5, textY);
  };

  // Row 1: Técnico + Endereço
  drawCell(M, y, RW * 0.45, cellH, "Técnico executor:", techName);
  drawCell(M + RW * 0.45, y, RW * 0.55, cellH, "Endereço:", c.address);
  y += cellH;

  // Row 2: Cliente + Data + Relatório nº
  drawCell(M, y, RW * 0.5, cellH, "Cliente:", c.client_name);
  drawCell(M + RW * 0.5, y, RW * 0.22, cellH, "Data:", fmtDate(c.service_date));
  
  // Relatório nº box
  const relBoxX = M + RW * 0.72;
  const relBoxW = RW * 0.28;
  doc.rect(relBoxX, y, relBoxW, cellH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("RELATÓRIO", relBoxX + relBoxW / 2, y + 3.5, { align: "center" });
  doc.text(`Nº ${c.report_number || "—"}`, relBoxX + relBoxW / 2, y + 7.5, { align: "center" });
  y += cellH;

  // Row 3: Tipo equip + nº série
  drawCell(M, y, RW * 0.5, cellH, "Tipo de equipamento:", c.equipment_type);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Número de série:", c.equipment_serial);
  y += cellH;

  // Row 4: colaborador + instalado em
  drawCell(M, y, RW * 0.5, cellH, "Colaborador responsável em atender:", c.responsible_employee);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Instalado em:", fmtDate(c.installed_at));
  y += cellH;

  // Row 5: garantia + contrato
  drawCheckCell(M, y, RW * 0.5, cellH, "Em garantia:", c.in_warranty);
  drawCheckCell(M + RW * 0.5, y, RW * 0.5, cellH, "Em contrato de manutenção:", c.in_contract);
  y += cellH;

  // Row 6: transformador + odômetro
  drawCell(M, y, RW * 0.5, cellH, "Nº de Série do Transformador Principal:", c.transformer_serial);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Contador / Odômetro:", c.counter_odometer);
  y += cellH;

  // Row 7: lote (full)
  drawCell(M, y, RW, cellH, "Para o caso de problemas com consumíveis especificar o número do lote:", c.lot_number);
  y += cellH;

  // Row 8: funcionando antes
  drawCheckCell(M, y, RW, cellH, "O equipamento estava em funcionamento antes do reparo?", c.working_before);
  y += cellH;

  // Helper for dynamic multi-line blocks
  const drawDynamicBlock = (label: string, value: string | null | undefined, minH: number) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(value ?? "", RW - 4);
    const textH = lines.length * 4.2;
    const h = Math.min(minH + 10, Math.max(minH, textH + 7)); // Limitei o crescimento máximo
    
    doc.rect(M, y, RW, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.text(label, M + 1.2, y + 3.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(lines.slice(0, 10), M + 1.2, y + 8, { lineHeightFactor: 1.1 }); // Limitei a 10 linhas
    y += h;
  };

  // Blocos principais
  drawDynamicBlock("Descrição do problema:", c.reported_defect, 22);
  drawDynamicBlock("Causa do problema diagnosticado pelo técnico e ação corretiva de serviço ou reparo realizado:", c.service_performed, 35);

  // Verificações
  doc.rect(M, y, RW, 10);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("Verificado e testado?", M + 1.2, y + 4);
  const simX = M + 35;
  doc.rect(simX, y + 2, 2.4, 2.4);
  doc.text("SIM", simX + 3.5, y + 4);
  if (c.verified_tested === true) doc.text("X", simX + 0.6, y + 3.9);
  doc.rect(simX + 12, y + 2, 2.4, 2.4);
  doc.text("NÃO", simX + 15.5, y + 4);
  if (c.verified_tested === false) doc.text("X", simX + 12.6, y + 3.9);
  doc.setFontSize(6); doc.setFont("helvetica", "normal");
  doc.text("(Indicar o número do Relatório de Resultados de teste com base nas especificações do produto)", simX + 30, y + 4);
  y += 10;

  doc.rect(M, y, RW, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("O equipamento voltou a funcionar após o reparo?", M + 1.2, y + 5);
  const simX2 = M + 75;
  doc.rect(simX2, y + 3, 2.4, 2.4);
  doc.text("SIM", simX2 + 3.5, y + 5);
  if (c.working_after === true) doc.text("X", simX2 + 0.6, y + 4.9);
  doc.rect(simX2 + 12, y + 3, 2.4, 2.4);
  doc.text("NÃO", simX2 + 15.5, y + 5);
  if (c.working_after === false) doc.text("X", simX2 + 12.6, y + 4.9);
  y += 8;

  // Peças e Observações
  if (isLaser) {
    // Tabela de peças simplificada para caber
    const drawPartsTable = (title: string, rows: any[]) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.rect(M, y, RW, 5);
      doc.text(title, M + 1.2, y + 3.5);
      y += 5;
      const dataRows = (rows && rows.length ? rows : [{}, {}]).slice(0, 2);
      dataRows.forEach((r: any) => {
        doc.rect(M, y, RW, 4.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
        doc.text(`${r.number ?? ""} - ${r.description ?? ""} (${r.qty ?? ""})`, M + 1.2, y + 3.2);
        y += 4.5;
      });
    };
    drawPartsTable("Peças Utilizadas do Estoque", Array.isArray(c.parts_used) ? c.parts_used : []);
    drawPartsTable("Peças a serem requisitadas", Array.isArray(c.parts_requested) ? c.parts_requested : []);
  } else if (c.parts_replaced) {
    drawDynamicBlock("Peças trocadas:", c.parts_replaced, 12);
  }

  drawDynamicBlock("Observações:", c.notes, 12);

  // ---- Footer fixo (sempre no final da página) ----
  const footerY = H - M - 45; // Posiciona as assinaturas e investigação fixas no rodapé
  y = footerY;

  // Linha do Técnico (Nome centralizado na linha)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Relatório aprovado por:", M, y + 5);
  const approvalLineStart = M + 38;
  const approvalLineEnd = M + 110;
  doc.setFont("helvetica", "normal");
  doc.text(techName || "—", approvalLineStart + 36, y + 5, { align: "center" });
  doc.line(approvalLineStart, y + 5.5, approvalLineEnd, y + 5.5);
  
  y += 18;

  // Signatures area
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Assinatura do técnico:", M, y + 5);
  doc.line(M + 35, y + 5.5, M + 100, y + 5.5);
  
  doc.text("Assinatura do cliente:", M + 105, y + 5);
  doc.line(M + 140, y + 5.5, M + 195, y + 5.5);

  if (techSignature) {
    try { doc.addImage(techSignature, "PNG", M + 45, y - 12, 45, 16); } catch {}
  }
  if (clientSignature) {
    try { doc.addImage(clientSignature, "PNG", M + 145, y - 12, 45, 16); } catch {}
  }
  
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text(c.client_name || "—", M + 167.5, y + 9, { align: "center" });
  
  y += 12;

  // Investigação box (Fixo no final)
  doc.rect(M, y, RW, 15);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("INVESTIGAÇÃO (PARA USO DA GESTÃO DA QUALIDADE):", M + 1.2, y + 3.5);
  
  y += 15;
  doc.rect(M, y, RW, 7);
  doc.text("Realizou Ação Corretiva/Preventiva?", M + 1.2, y + 5);
  const invX = M + 55;
  doc.rect(invX, y + 2, 2.4, 2.4);
  doc.text("NÃO", invX + 3.5, y + 5);
  doc.rect(invX + 12, y + 2, 2.4, 2.4);
  doc.text("SIM", invX + 15.5, y + 5);
  doc.text("Nº:", invX + 25, y + 5);
  doc.line(invX + 30, y + 5.5, invX + 60, y + 5.5);
  doc.text("Data: ___/___/______", invX + 65, y + 5);

  doc.save(`Relatorio-${(c.report_type || "OS").toUpperCase()}-${(c.client_name || "cliente").replace(/\s+/g, "_")}-${c.service_date}.pdf`);
}
