"use client";

import { useState } from "react";
import type { CobrancaCompartilhada } from "@/modules/publico/publico.types";
import { periodoEmMeses } from "@/shared/utils/datas";
import { FolhaAjustada } from "./pecas";
import { MolduraPublica } from "./moldura";
import { BotaoDeDownloads } from "./downloads";
import { BotaoDeTickets } from "./tickets-flutuante";
import { FolhaDaConta } from "./folha-conta";

/**
 * A página que o cliente abre pelo link da cobrança.
 *
 * ⚠️ Ela mostra a CONTA A RECEBER, e não uma folha por ticket.
 *
 * O link é de uma PARCELA, e parcela pertence à conta. Antes a página abria uma
 * folha para cada ticket da conta e repetia dentro de todas as mesmas parcelas:
 * numa conta de dois tickets, o cliente recebia dois documentos que diziam
 * coisas diferentes sobre quanto ele devia — porque nenhum ticket sozinho
 * responde por uma conta que reúne vários (`faturasorigens` é N para 1).
 *
 * O detalhe do serviço não se perdeu: cada número na composição é link para a
 * folha daquele ticket, em `/p/<token>/t/<numero>`, que abre em outra aba.
 * Conferir a cobrança e conferir um serviço são perguntas diferentes, e agora
 * cada uma tem sua página.
 */

/** jsPDF pesa ~400 KB e so serve a quem clica em baixar. */
const carregarPdf = () => import("@/app/(app)/faturas/pdf-recibo-pagamento");

export function CobrancaPublicaView({
  cobranca,
  token,
}: {
  cobranca: CobrancaCompartilhada;
  token: string;
}) {
  const [gerando, setGerando] = useState(false);

  /**
   * O PDF da conta — o MESMO gerador do resumo que sai de dentro do sistema.
   *
   * ⚠️ Nada de um segundo desenho para o cliente. Dois geradores da mesma conta
   * divergem na primeira correção que só um deles receber, e a divergência
   * aparece com o documento já na mão de quem paga.
   */
  async function baixarAConta() {
    setGerando(true);
    try {
      const { imprimirResumoDaConta } = await carregarPdf();
      const c = cobranca.conta;

      await imprimirResumoDaConta(
        {
          numeroConta: c.numero,
          situacao: c.situacao,
          competencia: periodoEmMeses(c.inicio, c.fim),
          clienteNome: c.cliente.nome,
          clienteDoc: c.cliente.doc,
          clienteEndereco: c.cliente.endereco,
          /* As obras que esta conta cobre, sem repetir. Uma conta junta tickets
             de projetos diferentes, e nome repetido não informa duas vezes. */
          clienteProjetos: [
            ...new Set(c.tickets.map((t) => t.projetoNome).filter((n): n is string => !!n)),
          ],
          total: c.total,
          pago: c.parcelas.reduce((s, p) => s + p.recebido, 0),
          desconto: c.parcelas.reduce((s, p) => s + p.desconto, 0),
          tickets: c.tickets.map((t) => ({
            numero: t.numero,
            titulo: t.titulo,
            valor: t.valor,
            data: t.data,
            projetoNome: t.projetoNome,
          })),
          parcelas: c.parcelas.map((p) => ({
            numero: p.numero,
            vencimento: p.vencimento,
            total: p.total,
            desconto: p.desconto,
            pago: p.pago,
            recebido: p.recebido,
            pagoEm: p.pagoEm,
          })),
          cobranca: cobranca.cobranca,
          emitente: {
            razaoSocial: cobranca.empresa.razaoSocial,
            endereco: cobranca.empresa.endereco,
            cnpj: cobranca.empresa.cnpj,
            logo: cobranca.empresa.logo,
          },
        },
        cobranca.empresa.razaoSocial ?? "",
        // A pagina do cliente BAIXA. Imprimir e o gesto do sistema, nao o dele.
        "baixar",
      );
    } finally {
      setGerando(false);
    }
  }

  return (
    <MolduraPublica>
      <div style={{ marginBottom: 20 }}>
        <FolhaAjustada>
          <FolhaDaConta
            conta={cobranca.conta}
            empresa={cobranca.empresa}
            cobranca={cobranca.cobranca}
            linkDoTicket={(numero) => `/p/${token}/t/${numero}`}
          />
        </FolhaAjustada>
      </div>

      {/* A porta visível para as folhas dos tickets. O link no número da
          composição continua lá; este botão é o que anuncia que ele existe. */}
      <BotaoDeTickets
        tickets={cobranca.conta.tickets}
        linkDoTicket={(numero) => `/p/${token}/t/${numero}`}
      />

      {/*
       * ⚠️ Os downloads sairam do fim da pagina e viraram um botao FIXO.
       *
       * Empilhados abaixo da folha, eles so existiam para quem rolava ate o
       * fim — e a folha tem 297mm, entao no celular sao varias telas de rolagem
       * antes de aparecer o boleto. O documento e para ler; baixar e para poder
       * fazer a qualquer momento.
       */}
      <BotaoDeDownloads
        token={token}
        temBoleto={cobranca.temBoleto}
        temNfs={cobranca.temNfs}
        documento={{ rotulo: "Baixar a fatura em PDF", baixar: baixarAConta }}
        gerando={gerando}
      />
    </MolduraPublica>
  );
}
