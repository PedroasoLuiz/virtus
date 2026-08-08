import { handler } from "@/shared/http/handler";
import * as controller from "@/modules/clientes/clientes.controller";
import { porDocumentoQuerySchema } from "@/modules/clientes/clientes.schema";

/**
 * /api/v1/clientes/documento?documento=00000000000
 *
 * Quem ja tem este CPF ou CNPJ nesta empresa.
 *
 * ⚠️ Rota propria em vez de um filtro na listagem. A listagem faz `ilike` em seis
 * colunas e devolve pagina com contagem; aqui o que se quer e uma igualdade e um
 * nome. Passando pela listagem, digitar um documento parcial casaria com o
 * cadastro de outra pessoa e a tela acusaria duplicidade que nao existe.
 *
 * ⚠️ Devolve o MINIMO: id e nome. A tela so precisa dizer "ja existe, e e este".
 * Mandando o cadastro inteiro, um endpoint de conferencia viraria um jeito de ler
 * ficha de gente por tentativa de documento.
 */
export const GET = handler(
  { query: porDocumentoQuerySchema, requerModulo: "financeiro" },
  controller.porDocumento,
);
