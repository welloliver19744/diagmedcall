import { useEffect, useRef } from "react";
import SignaturePadLib from "signature_pad";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface Props {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

export const SignaturePad = ({ value, onChange, height = 160 }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      // Só redimensiona se o tamanho realmente mudou (evita bugs em mobile ao rolar a página)
      if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
        const data = padRef.current?.toDataURL(); // Salva o que já foi desenhado
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.getContext("2d")!.scale(ratio, ratio);
        padRef.current?.clear();
        if (data) padRef.current?.fromDataURL(data); // Restaura após o resize
        else if (value) padRef.current?.fromDataURL(value);
      }
    };
    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: "rgba(255,255,255,1)",
      penColor: "#0a0a0a",
    });
    padRef.current.addEventListener("endStroke", () => {
      onChange(padRef.current!.isEmpty() ? null : padRef.current!.toDataURL("image/png"));
    });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => { padRef.current?.clear(); onChange(null); };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-white overflow-hidden" style={{ height }}>
        <canvas ref={canvasRef} className="w-full h-full touch-none" />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clear}>
        <Eraser className="w-3.5 h-3.5 mr-1" /> Limpar assinatura
      </Button>
    </div>
  );
};
