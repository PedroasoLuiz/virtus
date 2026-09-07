import type { ParametrosDeCobranca } from "@/shared/domain/cobranca";
/**
 * O que os documentos em PDF do sistema compartilham.
 *
 * ⚠️ Este arquivo nasceu do desmonte de `pdf.ts`.
 *
 * `pdf.ts` era a replica do documento do FlutterFlow, recusada e substituida por
 * `pdf-recibo`. Mas o arquivo ficou no repositorio sem nenhum botao chamar
 * `imprimirTicket` — e, por ter o nome mais obvio, virou o modelo que se copia
 * por engano ao escrever um documento novo. Aconteceu com o extrato.
 *
 * Aqui ficam so as duas partes que estavam vivas: o tipo do ticket, que o
 * servidor monta e o documento le, e a leitura da logo. O layout recusado saiu.
 */

type Despesa = { descricao: string; valor: number };

type Item = {
  servicoNome: string | null;
  descricao: string;
  data: string | null;
  quantidade: number;
  unidade: "UN" | "H";
  valorUnitario: number;
  desconto: number;
  acrescimo: number;
  despesas: Despesa[];
};

type Parcela = {
  numero: number | null;
  vencimento: string | null;
  valor: number;
  pago: boolean;
  /** Quanto ja entrou. E o que sobra que rende mora. Zero quando nao entrou nada. */
  recebido?: number;
  /** Data do ultimo recebimento. Em cobranca, "quanto" sem "quando" nao prova. */
  pagoEm?: string | null;
};

type Conta = { faturaId: number; pago: number; parcelas: Parcela[] };

type Endereco = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
};

/** O ticket como o documento precisa dele: montado no servidor, lido pelo PDF. */
export type { ParametrosDeCobranca };

export type TicketParaPDF = {
  id: number;
  numero: number;
  status: string;
  cancelada: boolean;
  clienteNome: string | null;
  clienteDoc: string | null;
  clienteEndereco: Endereco | null;
  /**
   * A obra do ticket.
   *
   * ⚠️ Substituiu o centro de custo, que e categoria contabil e nao diz nada a
   * quem recebe o documento. A obra diz: e por ela que o cliente reconhece o
   * trabalho.
   */
  projetoNome: string | null;
  inicio: string | null;
  fim: string | null;
  descricao: string | null;
  faturado: number;
  itens: Item[];
  faturas: Conta[];
  /**
   * A politica de multa e juros deste cliente, de `parametroscobranca`.
   *
   * ⚠️ Opcional: ticket de quem nao tem clausula nao fala em mora, e as colunas
   * somem do documento. Imprimir "0,00" sugeriria que houve calculo e deu zero.
   */
  cobranca?: ParametrosDeCobranca | null;
  empresa: {
    razaoSocial: string | null;
    endereco: string | null;
    cnpj: string | null;
    logo: string | null;
  };
};

/**
 * A logo vem de URL e o jsPDF precisa dos bytes.
 *
 * Falha em silêncio de propósito: logo que não carrega não pode impedir a
 * emissão do documento — o cabeçalho cai para o nome da empresa.
 */
export async function carregarLogo(
  url: string | null,
): Promise<{ dados: string; largura: number; altura: number } | null> {
  if (!url) return null;

  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;

    const blob = await resposta.blob();
    const dados = await new Promise<string>((ok, falha) => {
      const leitor = new FileReader();
      leitor.onload = () => ok(String(leitor.result));
      leitor.onerror = falha;
      leitor.readAsDataURL(blob);
    });

    const { largura, altura } = await new Promise<{ largura: number; altura: number }>(
      (ok, falha) => {
        const img = new Image();
        img.onload = () => ok({ largura: img.width, altura: img.height });
        img.onerror = falha;
        img.src = dados;
      },
    );

    return { dados, largura, altura };
  } catch {
    return null;
  }
}
