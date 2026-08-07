"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Avatar } from "@/components/ui/avatar";
import { ColunaDeModelos, EnvioDoModelo, useModelos } from "@/components/whatsapp/painel/modelo";
import {
  formatarTelefone,
  type ContatoDoPainel,
  type Modelo,
} from "@/modules/whatsapp/whatsapp.types";

/**
 * A conversa que ainda não existe: o contato escolhido, esperando o primeiro
 * modelo.
 *
 * ⚠️ Ocupa o lugar da thread, com o mesmo cabeçalho e a mesma coluna de modelos.
 * É a mesma tela de sempre, só que sem histórico — e ela nasce de verdade quando
 * a mensagem sai.
 *
 * ⚠️ Só por MODELO, e a tela diz isso em vez de esconder. Não há janela de 24
 * horas aberta, porque o contato nunca escreveu: um campo de texto livre aqui
 * produziria erro em todo envio.
 */
export function Rascunho({
  contato,
  contaId,
  onEnviou,
  onCancelar,
  onVoltar,
}: {
  contato: ContatoDoPainel;
  contaId: number;
  /** Abre a conversa recém-criada no painel. */
  onEnviou: (conversaId: number) => void;
  onCancelar: () => void;
  /** Volta para a agenda. `null` quando as duas colunas estão na tela. */
  onVoltar: (() => void) | null;
}) {
  const { avisar } = useAvisos();
  const [escolhido, setEscolhido] = useState<Modelo | null>(null);

  /*
   * Os modelos vêm por CONTA, e não por conversa: ela ainda não existe. É a
   * única tela do painel onde a rota antiga continua sendo a certa.
   */
  const lista = useModelos(contaId, true, `/api/v1/whatsapp/modelos?contaId=${contaId}`);

  const titulo = contato.nome || formatarTelefone(contato.telefone);

  async function enviar(modelo: string, parametros: string[], urlDoBotao?: string) {
    const r = await fetch("/api/v1/whatsapp/conversas/nova", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contaId,
        telefone: contato.telefone,
        nome: contato.nome || undefined,
        modelo,
        parametros,
        urlDoBotao,
      }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "Não foi possível enviar");
      return;
    }

    avisar("sucesso", "Modelo enviado.");
    onEnviou(corpo.data.conversaId);
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          // 48 a direita: o X do painel flutua ali por cima.
          padding: "10px 48px 10px 16px",
        }}
      >
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            aria-label="Voltar para a agenda"
            title="Voltar"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              marginLeft: -4,
              display: "grid",
              placeItems: "center",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-secondary)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <Avatar nome={titulo} semente={contato.telefone} foto={contato.icone} tamanho={34} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "var(--text-md)",
              fontWeight: "var(--fw-semi)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {titulo}
          </div>
          <div
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              marginTop: 1,
            }}
          >
            {formatarTelefone(contato.telefone)} · conversa nova
          </div>
        </div>

        <button
          type="button"
          onClick={onCancelar}
          style={{
            flexShrink: 0,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "var(--font)",
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          Cancelar
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              placeItems: "center",
              padding: 24,
              margin: "0 10px 4px",
              borderRadius: "var(--radius-lg)",
              background:
                "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
            }}
          >
            <p
              style={{
                maxWidth: 300,
                textAlign: "center",
                fontSize: "var(--text-sm)",
                color: "var(--text-tertiary)",
                lineHeight: "var(--lh-snug)",
              }}
            >
              {contato.nome ? `${contato.nome} nunca` : "Este número nunca"} escreveu por aqui. Para
              falar primeiro, a Meta só aceita um modelo aprovado — escolha um ao lado.
            </p>
          </div>

          {escolhido && (
            <EnvioDoModelo
              key={escolhido.nome}
              modelo={escolhido}
              onEnviar={enviar}
              onTrocar={() => setEscolhido(null)}
            />
          )}
        </div>

        {/*
          A coluna fica SEMPRE aberta aqui, e não fecha ao escolher como na
          conversa normal: ali a lista era um desvio no meio de um chat que já
          existia; aqui ela é a própria tarefa, e sem ela a tela fica vazia.
        */}
        <ColunaDeModelos
          lista={lista}
          escolhido={escolhido?.nome ?? null}
          onEscolher={setEscolhido}
          onFechar={onCancelar}
        />
      </div>
    </div>
  );
}
