"use client";

import { useState } from "react";

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
export function ComoConectar() {
  const passos = [
    {
      titulo: "Criar o app",
      texto: "No painel de apps da Meta, tipo Empresa, com o produto WhatsApp.",
      href: "https://developers.facebook.com/apps",
    },
    {
      titulo: "Pegar as identificações",
      texto: "Em WhatsApp, Configuração da API. Copie o Phone number ID e o da conta.",
      href: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    },
    {
      titulo: "Gerar o token permanente",
      texto: "Em Usuários do sistema, no Business Manager. O do API Setup expira em 24 horas.",
      href: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
    },
    {
      titulo: "Pegar a chave secreta",
      texto: "Em Configurações do app, aba Básico.",
      href: "https://developers.facebook.com/docs/facebook-login/security",
    },
    {
      titulo: "Ligar o webhook",
      texto: "Cole a URL verde acima e o token de verificação, e assine o campo messages.",
      href: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started",
    },
  ];

  return (
    <section style={{ marginTop: 10 }}>
      <div className="rotulo" style={{ marginBottom: 2 }}>
        Como conectar
      </div>

      {passos.map((p, i) => (
        <a
          key={p.titulo}
          href={p.href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            padding: "9px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {/*
            O icone vai no TITULO, e nao num "Ver mais" abaixo: ele ja diz que
            abre fora, e a linha inteira e clicavel. Um link extra so repetiria
            o gesto que o titulo ja oferece.
          */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              color: "var(--primary)",
            }}
          >
            {p.titulo}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M14 4h6v6" />
              <path d="M20 4 10 14" />
              <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
            </svg>
          </span>

          <span
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
              marginTop: 2,
            }}
          >
            {p.texto}
          </span>
        </a>
      ))}
    </section>
  );
}
