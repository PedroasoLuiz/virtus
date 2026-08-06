"use client";

/**
 * Como um anexo se apresenta antes de ser aberto.
 *
 * PDF, planilha e imagem tem cor e rotulo proprios: numa lista de anexos, a cor
 * diz o tipo antes de o nome ser lido.
 */

/**
 * Identidade visual de um documento pelo tipo.
 *
 * A cor e a sigla saem da EXTENSAO, e nao do mime: o navegador manda mime vazio
 * ou `application/octet-stream` com frequencia, enquanto o nome do arquivo
 * praticamente sempre traz a extensao. O mime entra so como desempate.
 */
const DOCUMENTOS: { teste: RegExp; rotulo: string; cor: string }[] = [
  { teste: /\.pdf$/i, rotulo: "PDF", cor: "#d93025" },
  { teste: /\.docx?$/i, rotulo: "DOC", cor: "#2b579a" },
  { teste: /\.(xlsx?|csv)$/i, rotulo: "XLS", cor: "#1d7044" },
  { teste: /\.pptx?$/i, rotulo: "PPT", cor: "#c43e1c" },
  { teste: /\.(zip|rar|7z|gz)$/i, rotulo: "ZIP", cor: "#7a5ea8" },
  { teste: /\.(txt|md|log)$/i, rotulo: "TXT", cor: "#5f6368" },
  { teste: /\.(xml|json|html?)$/i, rotulo: "WEB", cor: "#b06000" },
];
export function documentoDe(nome: string | null, mime: string | null): { rotulo: string; cor: string } {
  const arquivo = nome ?? "";

  const conhecido = DOCUMENTOS.find((d) => d.teste.test(arquivo));
  if (conhecido) return { rotulo: conhecido.rotulo, cor: conhecido.cor };

  if (mime?.includes("pdf")) return { rotulo: "PDF", cor: "#d93025" };

  // Extensao desconhecida ainda diz mais que um rotulo generico: quem recebeu
  // um `.dwg` prefere ler DWG a ler "arquivo".
  const extensao = arquivo.split(".").pop() ?? "";
  const util = /^[a-z0-9]{1,4}$/i.test(extensao) && extensao !== arquivo;

  return { rotulo: util ? extensao.toUpperCase() : "DOC", cor: "#5f6368" };
}
/** Folha com a ponta dobrada e a sigla numa faixa colorida, como no WhatsApp. */
export function IconeDeDocumento({
  nome,
  mime,
  tamanho = 40,
}: {
  nome: string | null;
  mime: string | null;
  tamanho?: number;
}) {
  const { rotulo, cor } = documentoDe(nome, mime);

  return (
    <svg
      width={tamanho}
      height={tamanho * 1.22}
      viewBox="0 0 34 42"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <path
        d="M2 3.5A2.5 2.5 0 0 1 4.5 1H22l10 10v27.5a2.5 2.5 0 0 1-2.5 2.5h-25A2.5 2.5 0 0 1 2 38.5z"
        fill="var(--surface)"
        stroke="var(--border-strong)"
        strokeWidth="1.4"
      />
      {/* A dobra: sem ela a silhueta e um retangulo qualquer. */}
      <path d="M22 1l10 10h-8a2 2 0 0 1-2-2z" fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="1.4" strokeLinejoin="round" />

      <rect x="2" y="22" width="30" height="13" rx="2" fill={cor} />
      <text
        x="17"
        y="31.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="9"
        fontWeight="700"
        fontFamily="var(--font)"
        letterSpacing="0.3"
      >
        {rotulo}
      </text>
    </svg>
  );
}
export function tamanhoEmTexto(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
