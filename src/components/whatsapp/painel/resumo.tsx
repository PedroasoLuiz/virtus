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
 * Resumos que a pessoa já dispensou, por atendimento.
 *
 * ⚠️ Vive no MÓDULO, e não em estado do componente. O cartão mora dentro da
 * thread, que remonta a cada troca de contato: guardado ali, ele reabria toda
 * vez que a conversa voltava para a tela, e quem fechou uma vez fechava de novo,
 * e de novo.
 *
 * Por atendimento e não por conversa: assunto novo abre atendimento novo, e
 * resumo de assunto novo merece ser lido. Some ao recarregar a página, e está
 * certo — dispensar é "não agora", não uma preferência para guardar no banco.
 */
const dispensados = new Set<number>();

export function resumoFechado(atendimentoId: number): boolean {
  return dispensados.has(atendimentoId);
}

export function fecharResumo(atendimentoId: number) {
  dispensados.add(atendimentoId);
}

/**
 * O que o cliente quer, sem precisar reler a conversa.
 *
 * Fica colado no campo de escrita de propósito: é ali que a pessoa está olhando
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
  const tom = situacao.alerta ? "var(--warning)" : "var(--primary)";

  const lead = [
    atendimento.leadNome && { rotulo: "Nome", valor: atendimento.leadNome },
    atendimento.leadEmpresa && { rotulo: "Empresa", valor: atendimento.leadEmpresa },
    atendimento.leadEmail && { rotulo: "E-mail", valor: atendimento.leadEmail },
  ].filter(Boolean) as { rotulo: string; valor: string }[];

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
        overflow: "hidden",
        /*
         * Vidro: o fundo translucido desfoca a conversa por tras em vez de
         * tapa-la. E o que faz o cartao parecer sobreposto e temporario, que e
         * exatamente o que ele e.
         *
         * `color-mix` em vez de rgba fixo porque a cor de base muda com o tema:
         * escrito na mao, o cartao ficaria branco leitoso no modo escuro.
         */
        background: "color-mix(in srgb, var(--surface) 78%, transparent)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: `1px solid ${
          situacao.alerta
            ? "var(--warning-border)"
            : "color-mix(in srgb, var(--border) 70%, transparent)"
        }`,
        borderRadius: "var(--radius-lg)",
        // Duas sombras: a larga descola do fundo, a fina de cima desenha o
        // brilho da quina que o vidro tem quando pega luz.
        boxShadow: "var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.22)",
        animation: "fade-in 160ms var(--ease-out)",
      }}
    >
      {/*
        Faixa da cor do estado, na lateral esquerda.

        ⚠️ É o que separa "encaminhado, tudo certo" de "a IA não entendeu" num
        relance. Antes a diferença era a borda do cartão inteiro mudar de cor, e
        um contorno fino em volta de trezentos pixels não se vê.
      */}
      <div
        aria-hidden
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tom }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "11px 12px 11px 15px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--text-xs)",
              fontWeight: "var(--fw-semi)",
              color: situacao.alerta ? "var(--warning-text)" : "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {/* Faísca: é o que o sistema entendeu sozinho, e o ícone diz isso
                sem gastar a palavra "IA" numa linha de trinta caracteres. */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.85 }} aria-hidden>
              <path d="M12 2c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8z" />
            </svg>
            {situacao.texto}
          </div>

          {atendimento.intencao && (
            <div
              style={{
                marginTop: 5,
                fontSize: "var(--text-md)",
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
                marginTop: 3,
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {atendimento.resumo}
            </p>
          )}

          {/*
            Os dados do lead ficam em linha própria e ROTULADOS, não diluídos no
            resumo: quem atende precisa bater o olho e achar o e-mail, não ler
            um parágrafo até encontrar.
          */}
          {lead.length > 0 && (
            <div
              style={{
                marginTop: 9,
                display: "flex",
                flexWrap: "wrap",
                gap: "5px 6px",
              }}
            >
              {lead.map((l) => (
                <span
                  key={l.rotulo}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 5,
                    maxWidth: "100%",
                    padding: "3px 8px",
                    borderRadius: "var(--radius-full)",
                    background: "color-mix(in srgb, var(--surface-2) 70%, transparent)",
                    fontSize: "var(--text-xs)",
                  }}
                >
                  <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{l.rotulo}</span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: "var(--fw-semi)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {l.valor}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginTop: -2 }}>
          {/*
            Baixar sobe para a linha do fechar, como ícone.

            ⚠️ Embaixo, escrito, ele competia com o resumo pela leitura e era a
            última coisa que a pessoa via — sendo a que ela quase nunca quer. Na
            barra de ações ele fica à mão sem disputar nada.
          */}
          <BotaoDoCartao
            rotulo="Baixar resumo"
            onClick={() => baixarResumo(atendimento, conversa)}
          >
            <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4.5 20h15" />
          </BotaoDoCartao>

          <BotaoDoCartao rotulo="Esconder" onClick={onFechar}>
            <path d="M18 6L6 18M6 6l12 12" />
          </BotaoDoCartao>
        </div>
      </div>
    </div>
  );
}

/** Ação do cartão: só o ícone, com o nome na dica do navegador. */
function BotaoDoCartao({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      style={{
        width: 24,
        height: 24,
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        color: "var(--text-tertiary)",
        transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--surface-hover)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-tertiary)";
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
