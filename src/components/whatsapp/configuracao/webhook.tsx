"use client";

import { useState } from "react";
import type { Duvida } from "@/components/ui/ajuda";
import { CabecalhoDeSecao } from "@/components/ui/kit";

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
    <section>
      {/*
        O titulo diz o QUE e, nao o nome do campo.

        "Callback" e o rotulo do lado da Meta, e so quem ja esta naquela tela
        entende. Quem chega aqui precisa saber para que serve; o nome tecnico
        aparece adiante, na hora de achar o campo la.
      */}
      <CabecalhoDeSecao
        titulo="Onde as mensagens chegam"
        legenda="Este é o endereço do seu sistema que a Meta procura quando alguém escreve. A mesma URL serve todos os números; o que muda entre eles é o Verify token. Assine o campo messages, senão a URL verifica e mesmo assim nada chega."
      />

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            flexShrink: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
          }}
        >
          Callback URL:
        </span>

        {/*
          A URL no verde da marca e o icone COLADO nela, e nao na outra ponta da
          linha. Na extremidade, o copiar vira um botao solto que nao se liga ao
          que copia; ao lado do texto, ele le como parte dele.
        */}
        <code
          style={{
            minWidth: 0,
            fontSize: "var(--text-sm)",
            color: "var(--primary)",
            wordBreak: "break-all",
          }}
        >
          {url}
        </code>

        {/*
          Icone sem moldura, no verde da marca: e uma acao de apoio ao lado do
          dado, e nao um botao com peso proprio. A confirmacao troca o desenho
          por um certo, porque copiar nao tem retorno visivel nenhum.
        */}
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopiada(true);
          }}
          title={copiada ? "Copiada" : "Copiar"}
          aria-label={copiada ? "Copiada" : "Copiar a URL"}
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            border: "none",
            background: "transparent",
            color: "var(--primary)",
            cursor: "pointer",
          }}
        >
          {copiada ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5.5 5.5L20 7" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="12" height="12" rx="2.5" />
              <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
            </svg>
          )}
        </button>
      </div>
    </section>
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
