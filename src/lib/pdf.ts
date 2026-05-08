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

export async function generateServiceCallPDF(c: SC) {
  // Load technician signature from assigned profile
  let techSignature: string | null = null;
  let techName = c.technician ?? "";
  if ((c as any).assigned_to) {
    const { data } = await supabase.from("profiles").select("full_name, signature_url").eq("id", (c as any).assigned_to).maybeSingle();
    if (data) {
      techName = techName || data.full_name || "";
      if ((data as any).signature_url) techSignature = await urlToDataUrl((data as any).signature_url);
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  const M = 10;
  const RW = W - 2 * M;

  // ---- Header ----
  doc.setDrawColor(0); doc.setLineWidth(0.3);
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
  doc.line(rx + 25, M, rx + 25, M + 22);
  doc.line(rx, M + 8, rx + 50, M + 8);
  doc.line(rx, M + 15, rx + 50, M + 15);
  doc.setFont("helvetica", "bold");
  doc.text("Versão", rx + 12.5, M + 5, { align: "center" });
  doc.text("Revisão", rx + 37.5, M + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("002", rx + 12.5, M + 12, { align: "center" });
  doc.text("005", rx + 37.5, M + 12, { align: "center" });
  doc.text("25/07/2021", rx + 12.5, M + 19, { align: "center" });
  doc.text("05/06/2024", rx + 37.5, M + 19, { align: "center" });

  // Title bar
  let y = M + 22;
  doc.rect(M, y, RW, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("F: 024 — RELATÓRIO DE CHAMADA DE SERVIÇO (AT)", M + 2, y + 5.5);
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Nº página: 1/1", W - M - 2, y + 5.5, { align: "right" });
  y += 8;

  // Helper: row of cells
  const cellH = 9;
  doc.setFontSize(8);

  const drawCell = (x: number, yy: number, w: number, h: number, label: string, value?: string | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
    doc.text(label, x + 1.2, yy + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
    const lines = doc.splitTextToSize(value ?? "", w - 2.4);
    doc.text(lines.slice(0, 2), x + 1.2, yy + 7);
  };

  const drawCheckCell = (x: number, yy: number, w: number, h: number, label: string, val?: boolean | null) => {
    doc.rect(x, yy, w, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
    const labelLines = doc.splitTextToSize(label, w - 16);
    doc.text(labelLines, x + 1.2, yy + 3);
    doc.setTextColor(0);
    // checkboxes
    const cy = yy + h / 2 + 0.5;
    const cx = x + w - 14;
    doc.rect(cx, cy - 2, 2.5, 2.5);
    if (val === true) doc.text("X", cx + 0.4, cy + 0.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("SIM", cx + 3.5, cy + 0.2);
    doc.setFont("helvetica", "bold");
    doc.rect(cx + 7, cy - 2, 2.5, 2.5);
    if (val === false) doc.text("X", cx + 7.4, cy + 0.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text("NÃO", cx + 10.5, cy + 0.2);
  };

  // Row 1: Técnico + Endereço
  drawCell(M, y, RW * 0.5, cellH, "Técnico executor:", techName);
  drawCell(M + RW * 0.5, y, RW * 0.5, cellH, "Endereço:", c.address);
  y += cellH;

  // Row 2: Cliente + Data + Relatório nº
  drawCell(M, y, RW * 0.5, cellH, "Cliente:", c.client_name);
  drawCell(M + RW * 0.5, y, RW * 0.2, cellH, "Data:", fmtDate(c.service_date));
  drawCell(M + RW * 0.7, y, RW * 0.3, cellH, "Relatório Nº:", c.report_number ?? "");
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

  // Block: descrição do problema
  const drawTextBlock = (label: string, value: string | null | undefined, h: number) => {
    doc.rect(M, y, RW, h);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
    doc.text(label, M + 1.2, y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(0);
    const lines = doc.splitTextToSize(value ?? "", RW - 2.4);
    doc.text(lines, M + 1.2, y + 7);
    y += h;
  };

  drawTextBlock("Descrição do problema:", c.reported_defect, 22);
  drawTextBlock("Causa do problema diagnosticado pelo técnico e ação corretiva de serviço ou reparo realizado:", c.service_performed, 28);

  drawCheckCell(M, y, RW, cellH, "Verificado e testado? (Indicar nº do Relatório de Resultados de teste com base nas especificações do produto)", c.verified_tested);
  y += cellH;
  drawCheckCell(M, y, RW, cellH, "O equipamento voltou a funcionar após o reparo?", c.working_after);
  y += cellH;

  // Parts tables for laser
  const isLaser = c.report_type === "laser";
  if (isLaser) {
    const drawPartsTable = (title: string, rows: any[], extraRight?: string) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.rect(M, y, RW, 6);
      doc.text(title, M + 1.5, y + 4);
      if (extraRight) doc.text(extraRight, W - M - 1.5, y + 4, { align: "right" });
      y += 6;
      // header row
      const cw = [RW * 0.15, RW * 0.55, RW * 0.12, RW * 0.18];
      let hx = M;
      ["Número", "Descrição", "Qtd.", "NR / OP"].forEach((h, i) => {
        doc.rect(hx, y, cw[i], 5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.text(h, hx + 1.5, y + 3.5);
        hx += cw[i];
      });
      y += 5;
      const dataRows = rows && rows.length ? rows : [{}, {}, {}];
      dataRows.forEach((r: any) => {
        let hx2 = M;
        const vals = [r.number ?? "", r.description ?? "", r.qty ?? "", r.nr_op ?? ""];
        vals.forEach((v, i) => {
          doc.rect(hx2, y, cw[i], 5);
          doc.setFont("helvetica", "normal"); doc.setFontSize(8);
          const lns = doc.splitTextToSize(String(v), cw[i] - 2);
          doc.text(lns.slice(0, 1), hx2 + 1.2, y + 3.5);
          hx2 += cw[i];
        });
        y += 5;
      });
    };
    drawPartsTable("Peças Utilizadas do Estoque", Array.isArray(c.parts_used) ? c.parts_used : []);
    const prio = c.parts_priority === "urgente" ? "Urgente [X]   Padrão [ ]" : c.parts_priority === "padrao" ? "Padrão [X]   Urgente [ ]" : "Padrão [ ]   Urgente [ ]";
    drawPartsTable("Peças a serem requisitadas", Array.isArray(c.parts_requested) ? c.parts_requested : [], prio);
  } else if (c.parts_replaced) {
    drawTextBlock("Peças trocadas:", c.parts_replaced, 14);
  }

  drawTextBlock("Observações:", c.notes, 18);

  // Aprovado por
  drawCell(M, y, RW, cellH, "Relatório aprovado por:", c.approved_by);
  y += cellH;

  // Signatures area
  const sigH = 30;
  doc.rect(M, y, RW * 0.5, sigH);
  doc.rect(M + RW * 0.5, y, RW * 0.5, sigH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
  doc.text("Assinatura do técnico:", M + 1.2, y + 3);
  doc.text("Assinatura do cliente:", M + RW * 0.5 + 1.2, y + 3);
  doc.setTextColor(0);

  if (techSignature) {
    try { doc.addImage(techSignature, "PNG", M + 4, y + 5, RW * 0.5 - 8, sigH - 10); } catch {}
  }
  if (c.client_signature) {
    try { doc.addImage(c.client_signature, "PNG", M + RW * 0.5 + 4, y + 5, RW * 0.5 - 8, sigH - 10); } catch {}
  }
  // Name lines
  doc.setFontSize(8);
  doc.text(techName || "—", M + RW * 0.25, y + sigH - 2, { align: "center" });
  doc.text(c.client_name || "—", M + RW * 0.75, y + sigH - 2, { align: "center" });
  y += sigH;

  // Investigação box
  drawTextBlock("INVESTIGAÇÃO (PARA USO DA GESTÃO DA QUALIDADE):", "", 18);
  doc.rect(M, y, RW, cellH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(80);
  doc.text("Realizou Ação Corretiva/Preventiva?   [ ] NÃO   [ ] SIM     Nº: ____________     Data: ___/___/______", M + 1.2, y + 5.5);
  y += cellH;

  doc.save(`Relatorio-${(c.report_type || "OS").toUpperCase()}-${(c.client_name || "cliente").replace(/\s+/g, "_")}-${c.service_date}.pdf`);
}
