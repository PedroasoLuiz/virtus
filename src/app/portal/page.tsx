import { carteira } from "@/modules/portal/portal.service";
import { CobrancasQuadro } from "./cobrancas-quadro";
import { SemAcesso } from "./sem-acesso";
import { emitenteEscolhido } from "./emitente";

/**
 * O que o cliente deve, e onde ele pega o documento.
 *
 * Server Component chamando o serviço direto. Não há rota de API para o portal:
 * ela seria uma segunda porta para o mesmo dado, e cada porta é uma superfície a
 * mais para conferir.
 */
export default async function PortalPage() {
  const { clientes, parcelas, orcamentos } = await carteira(await emitenteEscolhido());

  if (clientes.length === 0) return <SemAcesso />;

  return (
    <CobrancasQuadro parcelas={parcelas} orcamentos={orcamentos} />
  );
}
