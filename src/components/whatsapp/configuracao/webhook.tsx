"use client";

import { useState } from "react";
import type { Duvida } from "@/components/ui/ajuda";

/**
 * O que a pessoa precisa levar ao painel da Meta.
 *
 * Fica junto do cadastro de numeros porque e ali que a duvida acontece: a URL
 * de callback e o passo a passo so importam com o formulario aberto na frente.
 */

const URL_WEBHOOK = "/api/v1/whatsapp/webhook";

export function UrlDeCallback() {
  const [copiada, setCopiada] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${URL_WEBHOOK}`;

  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--primary-subtle)",
        border: "1px solid var(--primary-border)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--lh-snug)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className="rotulo" style={{ flex: 1, color: "var(--primary)" }}>
          URL de callback na Meta
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopiada(true);
          }}
          style={{
            border: "1px solid var(--primary-border)",
            background: "var(--surface)",
            color: "var(--primary)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          {copiada ? "Copiada" : "Copiar"}
        </button>
      </div>

      <code
        style={{
          display: "block",
          fontSize: "var(--text-sm)",
          wordBreak: "break-all",
          color: "var(--text-primary)",
        }}
      >
        {url}
      </code>

      <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
        A mesma URL serve todos os números. Assine o campo <strong>messages</strong>,
        senão a URL verifica e mesmo assim nada chega.
      </div>
    </div>
  );
}

/**
 * Como conectar, em cinco passos.
 *
 * Sem cartao e sem moldura: e texto de apoio, nao dado. Uma linha divisoria
 * entre os itens basta para separa-los, e a primeira e a ultima ficam sem para o
 * bloco nao virar uma caixa por acidente.
 *
 * Minimalista de proposito: cada passo diz onde clicar e leva ao documento da
 * Meta. Reescrever a documentacao deles aqui envelheceria em duas semanas.
 */

/**
 * Como conectar, em cinco passos.
 *
 * Sem cartao e sem moldura: e texto de apoio, nao dado. Uma linha divisoria
 * entre os itens basta para separa-los, e a primeira e a ultima ficam sem para o
 * bloco nao virar uma caixa por acidente.
 *
 * Minimalista de proposito: cada passo diz onde clicar e leva ao documento da
 * Meta. Reescrever a documentacao deles aqui envelheceria em duas semanas.
 */
/**
 * Os passos para ligar um numero, na ordem em que se faz.
 *
 * ⚠️ Sao dados, e nao componente: eles entram na MESMA sanfona das duvidas, ao
 * lado delas. Passo a passo e pergunta frequente sao a mesma coisa para quem
 * le — o que fazer, por que, e para onde ir — e duas sanfonas diferentes so
 * criariam dois lugares para procurar a mesma resposta.
 *
 * Minimalista de proposito: cada passo diz onde clicar e leva ao documento da
 * Meta. Reescrever a documentacao deles aqui envelheceria em duas semanas.
 */
export const PASSOS_PARA_CONECTAR: Duvida[] = [
  {
    pergunta: "1. Criar o app na Meta",
    resposta: "No painel de apps, tipo Empresa, com o produto WhatsApp adicionado.",
    href: "https://developers.facebook.com/apps",
    rotuloDoLink: "Abrir o painel de apps",
  },
  {
    pergunta: "2. Pegar as identificações",
    resposta:
      "Em WhatsApp, Configuração da API. Copie o Phone number ID e o WhatsApp Business Account ID.",
    href: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    rotuloDoLink: "Ver onde ficam",
  },
  {
    pergunta: "3. Gerar o token permanente",
    resposta:
      "Em Usuários do sistema, no Business Manager. O token do API Setup expira em 24 horas e o envio para sem aviso.",
    href: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
    rotuloDoLink: "Ver como gerar",
  },
  {
    pergunta: "4. Pegar o App Secret",
    resposta:
      "Em Configurações do app, aba Básico. É ele que prova que o webhook veio mesmo da Meta.",
    href: "https://developers.facebook.com/docs/facebook-login/security",
    rotuloDoLink: "Ver onde fica",
  },
  {
    pergunta: "5. Ligar o webhook",
    resposta:
      "Cole a URL verde acima e o mesmo Verify token que você escreveu aqui, e assine o campo messages. Sem assinar, a Meta aceita o cadastro e não entrega nada.",
    href: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started",
    rotuloDoLink: "Ver o passo a passo",
  },
];
