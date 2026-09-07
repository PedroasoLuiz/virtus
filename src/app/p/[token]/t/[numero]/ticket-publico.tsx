"use client";

import { useState } from "react";
import type { CobrancaCompartilhada, TicketPublico } from "@/modules/publico/publico.types";
import { FolhaAjustada, REGUA, TINTA } from "../../pecas";
import { MolduraPublica } from "../../moldura";
import { BotaoDeDownloads } from "../../downloads";
import { FolhaDoTicket } from "../../folha-ticket";

/**
 * A folha de UM ticket da conta, aberta pelo número na composição.
 *
 * ⚠️ Mesmo token da conta, e nenhum outro. O link não expõe nada que a página da
 * conta já não mostrasse — o ticket é origem dela, e quem tem o token da parcela
 * tem direito a ver de onde o valor veio. Um token próprio por ticket seria mais
 * um segredo para revogar, protegendo o que já estava visível.
 *
 * ⚠️ Sem boleto e sem nota fiscal no botão. Eles são da COBRANÇA, e a cobrança é
 * da conta: oferecê-los aqui devolveria a esta folha o papel que ela acabou de
 * perder.
 */

/** jsPDF pesa ~400 KB e so serve a quem clica em baixar. */
const carregarPdf = () => import("@/app/(app)/tickets/pdf-recibo");

export function TicketPublicoView({
  ticket,
  empresa,
  conta,
  token,
}: {
  ticket: TicketPublico;
  empresa: CobrancaCompartilhada["empresa"];
  conta: number;
  token: string;
}) {
  const [gerando, setGerando] = useState(false);

  async function baixarOTicket() {
    setGerando(true);
    try {
      const { imprimirRecibo } = await carregarPdf();

      await imprimirRecibo(
        {
          id: ticket.numero,
          numero: ticket.numero,
          status: ticket.situacao,
          cancelada: false,
          clienteNome: ticket.cliente.nome,
          clienteDoc: ticket.cliente.doc,
          /* O endereço já vem montado em duas linhas pela RPC, e o PDF quer os
             campos separados. Só o que ele sabe usar entra; o resto do endereço
             já está na folha da tela. */
          clienteEndereco: null,
          projetoNome: ticket.projeto,
          inicio: ticket.inicio,
          fim: ticket.fim,
          descricao: ticket.descricao,
          itens: ticket.itens.map((i) => ({
            servicoNome: i.servico,
            descricao: i.descricao ?? "",
            data: i.data,
            quantidade: i.quantidade,
            unidade: i.unidade,
            valorUnitario: i.valor,
            desconto: i.desconto,
            acrescimo: i.acrescimo,
            despesas: i.despesas.map((d) => ({ descricao: d.descricao ?? "", valor: d.valor })),
          })),
          empresa: {
            razaoSocial: empresa.razaoSocial,
            endereco: empresa.endereco,
            cnpj: empresa.cnpj,
            logo: empresa.logo,
          },
        },
        empresa.razaoSocial ?? "",
        // A pagina do cliente BAIXA. Imprimir e o gesto do sistema, nao o dele.
        "baixar",
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <MolduraPublica>
      {/*
        A volta para a fatura.
        ⚠️ Botão FLUTUANTE, e não um link de texto acima da folha.

        Como texto solto ele ficava fora do documento e fora da interface: uma
        linha azul sublinhada boiando sobre o cinza, que não é a linguagem de
        nenhuma das duas. Flutuante, ele é irmão do botão de downloads — mesmo
        raio, mesma sombra, canto oposto —, e some do caminho da leitura.
      */}
      <a
        href={`/p/${token}`}
        aria-label={`Voltar para a fatura ${conta}`}
        title={`Voltar para a fatura ${conta}`}
        style={{
          position: "fixed",
          left: 20,
          top: 20,
          zIndex: 60,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#ffffff",
          border: `1px solid ${REGUA}`,
          boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
          display: "grid",
          placeItems: "center",
          color: TINTA,
          textDecoration: "none",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.5 3.5L5 8l4.5 4.5" />
        </svg>
      </a>

      <div style={{ marginBottom: 20 }}>
        <FolhaAjustada>
          <FolhaDoTicket ticket={ticket} empresa={empresa} conta={conta} />
        </FolhaAjustada>
      </div>

      <BotaoDeDownloads
        token={token}
        temBoleto={false}
        temNfs={false}
        documento={{ rotulo: "Baixar ticket em PDF", baixar: baixarOTicket }}
        gerando={gerando}
      />
    </MolduraPublica>
  );
}
