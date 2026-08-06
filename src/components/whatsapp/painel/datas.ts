import type { Mensagem } from "@/modules/whatsapp/whatsapp.types";

/**
 * Como o painel escreve tempo.
 *
 * ⚠️ Nada aqui usa `toLocaleString` cru: a lista quer "ontem" e "14:02", nao a
 * data inteira, e a thread quer o dia por extenso no separador. Sao regras de
 * leitura, e nao formatacao de dado.
 */

export function rotuloDaMidia(m: Mensagem): string {
  if (m.midiaNome) return m.midiaNome;

  const porTipo: Record<string, string> = {
    image: "Imagem",
    audio: "Áudio",
    video: "Vídeo",
    document: "Documento",
    sticker: "Figurinha",
  };

  return porTipo[m.tipo] ?? "Anexo";
}
/** Hoje mostra a hora; antes disso, a data. É o que a lista precisa distinguir. */
export function quando(iso: string | null): string {
  if (!iso) return "";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}
export function rotuloDoDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: d.getFullYear() === hoje.getFullYear() ? undefined : "numeric",
  }).format(d);
}
export function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
