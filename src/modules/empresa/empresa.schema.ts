import { z } from "zod";
import { documentoValido, limparDocumento } from "@/shared/domain/documento";

/**
 * Contrato de entrada do cadastro da empresa.
 *
 * ⚠️ Quase tudo e OPCIONAL, e de proposito.
 *
 * O cadastro vem do sistema legado e ha empresa em uso com metade das colunas
 * vazias. Exigir aqui o que o banco nunca exigiu travaria a gaveta para quem so
 * queria corrigir o telefone: a pessoa abriria para mudar um campo e sairia com
 * seis erros vermelhos de dados que nunca existiram.
 *
 * ⚠️ A razao social e a excecao. Ela e o nome que sai no cabecalho de TODO PDF
 * do sistema, e documento que chega ao cliente sem quem o emitiu nao se explica.
 */

/** Texto opcional: em branco vira string vazia, e nunca `null`. */
const texto = (max: number) => z.string().trim().max(max).default("");

export const cadastroDaEmpresaSchema = z.object({
  razaoSocial: z
    .string()
    .trim()
    .min(2, "Informe a razão social")
    .max(160, "Razão social muito longa"),
  fantasia: texto(160),
  apelido: texto(80),

  /*
   * ⚠️ Valida so quando PREENCHIDO, e aceita o formato novo.
   *
   * `documentoValido` conhece o CNPJ alfanumerico que passou a valer em
   * 31/07/2026. Recusar em branco impediria de gravar qualquer outra correcao
   * numa empresa cujo CNPJ nunca foi digitado, que e o caso de varias vindas do
   * legado.
   */
  cnpj: texto(20).refine((v) => v === "" || documentoValido(v), "CNPJ inválido"),
  ie: texto(30),
  inscricaoMunicipal: texto(30),

  /* `z.email()` recusaria a string vazia, que aqui significa "nao informou". */
  email: texto(160).refine((v) => v === "" || z.string().email().safeParse(v).success, "E-mail inválido"),
  contato: texto(30),

  cep: texto(12).refine(
    (v) => v === "" || v.replace(/\D/g, "").length === 8,
    "CEP incompleto",
  ),
  logradouro: texto(160),
  numero: texto(20),
  complemento: texto(80),
  bairro: texto(80),
  cidade: texto(80),
  /* Duas letras, e em caixa alta: o codigo IBGE e as consultas do sistema leem
     a UF, e "sp" nao casaria com "SP" em lugar nenhum. */
  estado: texto(2).transform((v) => v.toUpperCase()),
  codigoIbge: texto(10),
});

export type EntradaDoCadastro = z.infer<typeof cadastroDaEmpresaSchema>;

/** O CNPJ vai limpo para o banco: a mascara e coisa de tela. */
export function cnpjParaBanco(bruto: string): string {
  return bruto ? limparDocumento(bruto) : "";
}
