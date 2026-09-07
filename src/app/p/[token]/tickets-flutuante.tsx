"use client";

import { useState } from "react";
import type { CobrancaCompartilhada } from "@/modules/publico/publico.types";
import { formatarSemSimbolo } from "@/shared/utils/money";
import { AZUL, CINZA, ItemDeMenu, REGUA, TINTA } from "./pecas";

/**
 * O menu dos tickets que compõem esta fatura.
 *
 * ⚠️ Existe porque o link do número, sozinho, não se anuncia.
 *
 * Na composição o número já é clicável, mas azul numa tabela de números não
 * diz "clique": o leitor não tem por que supor que aquela célula leva a algum
 * lugar, e o detalhe do serviço ficava a um clique que ninguém dava. Um botão
 * fixo é uma porta visível, e não uma dica escondida na tabela.
 *
 * ⚠️ Canto inferior ESQUERDO — irmão do de downloads, no canto oposto. Mesmo
 * raio, mesma sombra, mesmo cartão: são dois menus da mesma página, e no mesmo
 * canto um cobriria o outro.
 *
 * ⚠️ Aparece mesmo com um ticket só. Ele não existe para escolher entre vários:
 * existe para dizer que há o que ver.
 */
export function BotaoDeTickets({
  tickets,
  linkDoTicket,
}: {
  tickets: CobrancaCompartilhada["conta"]["tickets"];
  linkDoTicket: (numero: number) => string;
}) {
  const [aberto, setAberto] = useState(false);

  if (tickets.length === 0) return null;

  return (
    <div style={{ position: "fixed", left: 20, bottom: 20, zIndex: 60 }}>
      {aberto && (
        /* Camada que fecha ao clicar fora. Transparente: o cartao e pequeno, e
           escurecer a pagina inteira por causa dele seria peso demais. */
        <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: -1 }} />
      )}

      {aberto && (
        <div
          className="cartao-downloads"
          style={{
            position: "absolute",
            left: 0,
            bottom: 66,
            minWidth: 250,
            maxWidth: 320,
            maxHeight: "60vh",
            overflowY: "auto",
            padding: 6,
            borderRadius: 14,
            background: "#ffffff",
            border: `1px solid ${REGUA}`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
          }}
        >
          <div
            style={{
              padding: "8px 10px 6px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: CINZA,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            {tickets.length === 1 ? "Serviço da fatura" : "Serviços da fatura"}
          </div>

          {tickets.map((t) => (
            <ItemDeMenu
              key={t.numero}
              rotulo={`Ticket ${t.numero}`}
              /* O título e o valor embaixo do número: numa fatura de vários, "Ticket
                 160" e "Ticket 161" não se distinguem por nada. */
              abaixo={`${t.titulo} · ${formatarSemSimbolo(t.valor)}`}
              onClick={() => {
                window.open(linkDoTicket(t.numero), "_blank", "noopener");
                setAberto(false);
              }}
              icone={
                <>
                  <path d="M3.5 2h6l3 3v9h-9z" />
                  <path d="M5.5 8h5M5.5 10.5h3" />
                </>
              }
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-label={aberto ? "Fechar a lista de serviços" : "Ver os serviços desta fatura"}
        aria-expanded={aberto}
        title="Ver os serviços desta fatura"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `1px solid ${REGUA}`,
          /* ⚠️ Branco, e nao azul. O de downloads e a acao principal da pagina —
             o cliente veio pegar o boleto. Este e consulta, e dois circulos
             azuis nas duas pontas disputariam a mesma atencao. */
          background: "#ffffff",
          color: aberto ? AZUL : TINTA,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
          transition: "transform 160ms cubic-bezier(0.2, 0, 0, 1)",
          transform: aberto ? "rotate(90deg)" : "none",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {aberto ? (
            <path d="M4 4l8 8M12 4l-8 8" />
          ) : (
            <>
              <path d="M6 4.5h7M6 8h7M6 11.5h7" />
              <path d="M3 4.5h.01M3 8h.01M3 11.5h.01" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
