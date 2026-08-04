import { carteira } from "@/modules/portal/portal.service";
import { CobrancasTabela } from "./cobrancas-tabela";
import { SemAcesso } from "./sem-acesso";

/**
 * O que o cliente deve, e onde ele pega o documento.
 *
 * Server Component chamando o serviço direto. Não há rota de API para o portal:
 * ela seria uma segunda porta para o mesmo dado, e cada porta é uma superfície a
 * mais para conferir.
 */
export default async function PortalPage() {
  const { clientes, emitentes, parcelas, emAberto, vencido } = await carteira();

  if (clientes.length === 0) return <SemAcesso />;

  return (
    <CobrancasTabela
      parcelas={parcelas}
      emitentes={emitentes}
      emAberto={emAberto}
      vencido={vencido}
    />
  );
}
