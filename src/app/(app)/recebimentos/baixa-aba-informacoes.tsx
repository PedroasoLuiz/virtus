"use client";

import {
  CampoBloqueado,
  CampoNumerico,
  Field,
  inputStyle,
  selectStyle,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { formatarSemSimbolo, type Centavos } from "@/shared/utils/money";
import { TIPOS_DE_RECEBIMENTO, type TipoDeRecebimento } from "@/modules/faturas/faturas.types";
import { creditaNoMesmoDia, temTaxaDeCostume } from "@/shared/domain/recebimento";

/**
 * O lancamento: de quem veio o dinheiro, quando, por qual forma e onde caiu.
 *
 * ⚠️ Nao guarda estado. Todo campo aqui pertence a baixa inteira e e lido pela
 * outra aba — o total sai do que foi distribuido la, e a data daqui recalcula o
 * acrescimo de la. Com estado proprio, as duas abas teriam versoes diferentes do
 * mesmo lancamento e quem salvasse escolheria uma delas no escuro.
 */
export function AbaDeInformacoes({
  campos,
  totais,
  contas,
  clienteTravado,
  buscarClientes,
  aoEscolherCliente,
  aoMudarData,
  aoMudarTipo,
  aoMudarConta,
  aoMudarCredito,
  aoMudarTaxa,
  aoMudarObservacoes,
}: {
  campos: {
    clienteId: string;
    nomeDoCliente: string | null;
    data: string;
    tipo: string;
    contaId: string;
    dataCredito: string;
    taxa: number;
    observacoes: string;
  };
  totais: { total: Centavos; abatido: Centavos; acrescimo: Centavos };
  contas: { id: number; nome: string }[];
  clienteTravado: boolean;
  buscarClientes: (termo: string) => Promise<{ id: number; nome: string }[]>;
  aoEscolherCliente: (c: { id: number; nome: string } | null) => void;
  aoMudarData: (v: string) => void;
  aoMudarTipo: (v: string) => void;
  aoMudarConta: (v: string) => void;
  aoMudarCredito: (v: string) => void;
  aoMudarTaxa: (v: number) => void;
  aoMudarObservacoes: (v: string) => void;
}) {
  const tipoAtual = campos.tipo as TipoDeRecebimento;

  return (
    <>
      {/*
        ⚠️ BUSCA, e nao lista pronta.

        Um `<select>` carrega tudo antes de mostrar qualquer coisa: numa base
        com vinte mil clientes ativos, sao vinte mil linhas no HTML da pagina
        para escolher uma, e a tela trava antes de aparecer. Aqui a pergunta vai
        ao servidor com o que ja foi digitado.
      */}
      <Field
        label="Cliente"
        required
        hint="De quem veio o dinheiro. Um pagamento é de um pagador só."
      >
        <SeletorBuscavel
          valor={campos.clienteId ? Number(campos.clienteId) : null}
          rotulo={campos.nomeDoCliente}
          // Vindo de uma conta, o pagador ja esta decidido: trocar aqui abriria
          // parcelas de outro cliente na tela que existe para baixar ESTA.
          desabilitado={clienteTravado}
          buscar={buscarClientes}
          aoEscolher={aoEscolherCliente}
        />
      </Field>

      <Field
        label="Cliente pagou em"
        required
        hint="O dia em que o cliente pagou. É ele que fecha a parcela, mesmo que o dinheiro só caia depois."
      >
        <input
          type="date"
          value={campos.data}
          onChange={(e) => aoMudarData(e.target.value)}
          style={inputStyle}
        />
      </Field>

      <Field
        label="Forma"
        required
        hint="Lista fechada de propósito: no legado o mesmo PIX aparece com quatro grafias diferentes, e nenhum relatório consegue agrupar."
      >
        <select
          value={campos.tipo}
          onChange={(e) => aoMudarTipo(e.target.value)}
          style={selectStyle}
        >
          {TIPOS_DE_RECEBIMENTO.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Conta" required hint="Onde o dinheiro caiu. É o que liga o recebimento ao extrato.">
        <select value={campos.contaId} onChange={(e) => aoMudarConta(e.target.value)} style={selectStyle}>
          <option value="">Escolher…</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Field>

      {/*
        ⚠️ Duas datas, e nao uma.

        O cliente passa o cartao no dia 20 e a parcela fecha ali: ele pagou, nao
        deve mais. O dinheiro so aparece no extrato trinta dias depois, e ate la
        nao esta na conta. Com uma data so, ou a cobranca fica aberta um mes
        depois de paga, ou o caixa promete dinheiro que ainda nao existe.

        A previsao vem preenchida pelo prazo da forma escolhida, e vira "na mao"
        no primeiro toque: cada contrato com a adquirente tem o seu prazo, e
        antecipacao muda tudo.
      */}
      <Field
        label="Dinheiro cai em"
        required
        hint={
          creditaNoMesmoDia(tipoAtual)
            ? "Nesta forma o dinheiro entra no mesmo dia."
            : "Cartão credita em D+30, boleto no dia útil seguinte. Corrija se o seu contrato for outro."
        }
      >
        <input
          type="date"
          value={campos.dataCredito}
          min={campos.data}
          onChange={(e) => aoMudarCredito(e.target.value)}
          style={inputStyle}
        />
      </Field>

      {/*
        ⚠️ A taxa aparece só onde ela é o normal, e não em todo recebimento.

        Perguntar taxa em cada PIX é pedir para preencher zero cinquenta vezes
        por semana. Onde ela existe — cartão, boleto —, ela é a regra e o campo
        já vem aberto.
      */}
      {temTaxaDeCostume(tipoAtual) && (
        <Field
          label="Taxa retida"
          hint="O que a adquirente ou o banco ficou. Não é desconto: o cliente pagou o valor cheio, e isto vira uma despesa própria no seu resultado."
        >
          <CampoNumerico valor={campos.taxa} aoMudar={aoMudarTaxa} escala={100} />
        </Field>
      )}

      {/*
        ⚠️ Os tres numeros viraram CAMPO, e sairam do rodape.

        No rodape eram numeros soltos com rotulo miudo, e o que entra no banco —
        que e o unico que precisa bater com o extrato — ficava do tamanho de um
        detalhe. Como campo, cada um tem o rotulo a esquerda como todo dado da
        tela, da para copiar, e os tres ficam onde a leitura ja esta: logo
        acima do que se digita por ultimo.

        ⚠️ Dívida e acréscimo so aparecem quando ha acréscimo. Sem juros nem
        multa, "entrando" e "dívida" sao o mesmo numero, e repetir e fazer
        procurar a diferenca que nao existe.
      */}
      <Field label="Entrando na conta" hint="É este valor que vai aparecer no extrato do banco.">
        <CampoBloqueado valor={formatarSemSimbolo(totais.total)} />
      </Field>

      {totais.acrescimo > 0 && (
        <>
          <Field label="Abate de dívida">
            <CampoBloqueado valor={formatarSemSimbolo(totais.abatido)} />
          </Field>

          <Field label="Juros e multa">
            <CampoBloqueado valor={formatarSemSimbolo(totais.acrescimo)} />
          </Field>
        </>
      )}

      <Field label="Observações">
        <textarea
          value={campos.observacoes}
          onChange={(e) => aoMudarObservacoes(e.target.value)}
          rows={2}
          placeholder="Ex.: PIX único do mês, cliente pediu recibo por conta"
          maxLength={400}
          style={{ ...inputStyle, height: "auto", padding: 8, resize: "vertical" }}
        />
      </Field>
    </>
  );
}
