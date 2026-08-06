"use client";

import {
  formatarTelefone,
  type AtendimentoDaConversa,
  type Conversa,
} from "@/modules/whatsapp/whatsapp.types";

/**
 * O que a triagem entendeu, colado no campo de escrita.
 *
 * ⚠️ Responde a pergunta de quem atende: "o bot disse que ia transferir,
 * transferiu mesmo?". Por isso o setor entra NOMEADO, e nao um "encaminhado"
 * que nao diz para onde.
 */

/**
 * Salva o resumo como texto puro.
 *
 * ⚠️ Montado no navegador, sem rota nova: o cartao ja tem tudo o que vai no
 * arquivo, e um endpoint so para reescrever os mesmos campos seria uma segunda
 * versao da verdade para manter em dia.
 *
 * `.txt` e nao PDF porque isto e para colar em e-mail, CRM ou tarefa. Formato
 * que abre em qualquer lugar vale mais que formato bonito.
 */
function baixarResumo(a: AtendimentoDaConversa, conversa: Conversa) {
  const situacao = rotuloDaSituacao(a);

  const linhas = [
    `Atendimento #${a.id}`,
    `Aberto em: ${new Date(a.criadoEm).toLocaleString("pt-BR")}`,
    `Situação: ${situacao.texto}`,
    "",
    `Contato: ${conversa.nome ?? "sem nome"} (${formatarTelefone(conversa.telefone)})`,
    conversa.clienteNome ? `Cadastro: ${conversa.clienteNome}` : null,
    a.leadNome ? `Nome informado: ${a.leadNome}` : null,
    a.leadEmpresa ? `Empresa informada: ${a.leadEmpresa}` : null,
    a.leadEmail ? `E-mail informado: ${a.leadEmail}` : null,
    "",
    `Pedido: ${a.intencao ?? "não identificado"}`,
    "",
    "Resumo:",
    a.resumo ?? "sem resumo",
  ].filter((l) => l !== null);

  const url = URL.createObjectURL(
    new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = `atendimento-${a.id}.txt`;
  link.click();

  // Sem isto o blob fica na memoria da aba ate ela fechar, e quem baixa varios
  // resumos numa manha acumula todos.
  URL.revokeObjectURL(url);
}
/** Como cada estado da triagem se chama para quem atende. */
function rotuloDaSituacao(a: AtendimentoDaConversa): { texto: string; alerta: boolean } {
  switch (a.situacao) {
    case "ENCAMINHADO":
      return {
        // ⚠️ O setor entra NOMEADO. A pergunta que este cartao responde e "o bot
        // disse que ia transferir, transferiu mesmo?", e "encaminhado" sozinho
        // nao responde nada.
        texto: a.setorNome ? `Encaminhado para ${a.setorNome}` : "Encaminhado",
        alerta: false,
      };
    case "HUMANO":
      return { texto: "A IA não entendeu, precisa de você", alerta: true };
    case "TRIAGEM":
      return { texto: "Em triagem", alerta: false };
    case "ACEITO":
      return { texto: "Aceito", alerta: false };
    case "RECUSADO":
      return { texto: "Recusado", alerta: false };
    case "ABANDONADO":
      return { texto: "Encerrado sem retorno", alerta: false };
  }
}
/**
 * O que o cliente quer, sem precisar reler a conversa.
 *
 * Fica colado no campo de escrita de proposito: e ali que a pessoa esta olhando
 * quando vai responder, e um resumo no topo da thread seria rolado para fora da
 * tela antes de ser lido.
 */
export function ResumoDoAtendimento({
  atendimento,
  conversa,
  onFechar,
}: {
  atendimento: AtendimentoDaConversa;
  conversa: Conversa;
  onFechar: () => void;
}) {
  const situacao = rotuloDaSituacao(atendimento);

  const lead = [
    atendimento.leadNome && `Nome: ${atendimento.leadNome}`,
    atendimento.leadEmpresa && `Empresa: ${atendimento.leadEmpresa}`,
    atendimento.leadEmail && `E-mail: ${atendimento.leadEmail}`,
  ].filter(Boolean) as string[];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 14px)",
        // Recuado dos 10 do campo de escrita: o cartao flutua, e coisa que
        // flutua nao pode ter a mesma borda de quem esta no fluxo, senao le
        // como se fizesse parte dele.
        left: 26,
        right: 26,
        zIndex: 3,
        padding: "10px 12px",
        /*
         * Vidro: o fundo translucido desfoca a conversa por tras em vez de
         * tapa-la. E o que faz o cartao parecer sobreposto e temporario, que e
         * exatamente o que ele e.
         *
         * `color-mix` em vez de rgba fixo porque a cor de base muda com o tema:
         * escrito na mao, o cartao ficaria branco leitoso no modo escuro.
         */
        background: "color-mix(in srgb, var(--surface) 72%, transparent)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${
          situacao.alerta
            ? "var(--warning)"
            : "color-mix(in srgb, var(--border) 70%, transparent)"
        }`,
        borderRadius: "var(--radius-lg)",
        // Duas sombras: a larga descola do fundo, a fina de cima desenha o
        // brilho da quina que o vidro tem quando pega luz.
        boxShadow: "var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.22)",
        animation: "fade-in 160ms var(--ease-out)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: situacao.alerta ? "var(--warning)" : "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
          >
            {situacao.texto}
          </div>

          {atendimento.intencao && (
            <div
              style={{
                marginTop: 4,
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semi)",
                lineHeight: "var(--lh-snug)",
              }}
            >
              {atendimento.intencao}
            </div>
          )}

          {atendimento.resumo && (
            <p
              style={{
                marginTop: 2,
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {atendimento.resumo}
            </p>
          )}

          {/*
            Os dados do lead ficam em linha propria, e nao diluidos no resumo:
            quem atende precisa bater o olho e achar o e-mail, nao ler um
            paragrafo ate encontrar.
          */}
          {lead.length > 0 && (
            <div
              style={{
                marginTop: 6,
                display: "flex",
                flexWrap: "wrap",
                gap: "2px 10px",
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
              }}
            >
              {lead.map((linha) => (
                <span key={linha}>{linha}</span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => baixarResumo(atendimento, conversa)}
            style={{
              marginTop: 8,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: "var(--primary)",
            }}
          >
            Baixar resumo
          </button>
        </div>

        <button
          type="button"
          onClick={onFechar}
          aria-label="Esconder o resumo"
          title="Esconder"
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "var(--text-tertiary)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
