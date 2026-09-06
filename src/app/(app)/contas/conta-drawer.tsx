"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  ActiveToggle,
  Button,
  CampoBloqueado,
  CampoNumerico,
  CampoPercentual,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";
import { centavos, formatarSemSimbolo, ZERO } from "@/shared/utils/money";
import {
  TIPOS_DE_CONTA,
  type ContaBancaria,
} from "@/modules/contas/contas.types";

/**
 * Cadastro de conta bancaria.
 *
 * Um componente para incluir e editar: os campos e as regras sao os mesmos, e
 * dois arquivos divergiriam no primeiro campo novo. O que muda e para onde o
 * salvar aponta.
 */

export function ContaDrawer({
  conta,
  aoSalvar,
  onClose,
}: {
  /** Nulo = incluindo. */
  conta: ContaBancaria | null;
  aoSalvar: () => void;
  onClose: () => void;
}) {
  const { avisar } = useAvisos();

  const [apelido, setApelido] = useState(conta?.apelido ?? "");
  const [banco, setBanco] = useState(conta?.banco ?? "");
  const [agencia, setAgencia] = useState(conta?.agencia ?? "");
  const [numero, setNumero] = useState(conta?.conta ?? "");
  const [tipo, setTipo] = useState(conta?.tipo ?? "");
  const [ativo, setAtivo] = useState(conta?.ativo ?? true);
  const [limite, setLimite] = useState(conta?.limite ?? 0);
  const [aceitaCartao, setAceitaCartao] = useState(
    conta?.aceitaCartao ?? false,
  );
  const [taxaDebito, setTaxaDebito] = useState(conta?.taxaDebito ?? null);
  const [taxaCredito, setTaxaCredito] = useState(conta?.taxaCredito ?? null);
  const [taxaParcelado, setTaxaParcelado] = useState(
    conta?.taxaParcelado ?? null,
  );
  const [prazoCredito, setPrazoCredito] = useState(
    conta?.prazoCreditoDias ?? null,
  );
  const [tarifaBoleto, setTarifaBoleto] = useState(conta?.tarifaBoleto ?? null);
  const [salvando, setSalvando] = useState(false);

  const identificavel = Boolean(
    apelido.trim() || banco.trim() || numero.trim(),
  );

  async function salvar() {
    setSalvando(true);

    const r = await fetch(
      conta ? `/api/v1/contas/${conta.id}` : "/api/v1/contas",
      {
        method: conta ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apelido: apelido.trim() || null,
          banco: banco.trim() || null,
          agencia: agencia.trim() || null,
          conta: numero.trim() || null,
          tipo: tipo || null,
          ativo,
          limite,
          /*
           * ⚠️ O saldo inicial vai como VEIO, e a tela nao o edita.
           *
           * Ele e a partida do saldo e se define na inicializacao de saldo, que e
           * onde se confere contra o extrato numa data de corte. Editavel aqui,
           * seria um segundo caminho para o mesmo numero, sem a conferencia — e o
           * saldo de hoje mudaria inteiro por causa de um campo mexido de passagem.
           */
          saldoInicial: conta?.saldoInicial ?? 0,
          aceitaCartao,
          taxaDebito,
          taxaCredito,
          taxaParcelado,
          prazoCreditoDias: prazoCredito,
          tarifaBoleto,
        }),
      },
    );

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      const detalhe = dados?.error?.details?.[0];
      avisar(
        "atencao",
        dados?.error?.message ?? "Não foi possível salvar a conta",
        detalhe ? `${detalhe.campo}: ${detalhe.mensagem}` : undefined,
      );
      return;
    }

    avisar("sucesso", conta ? "Conta atualizada" : "Conta criada");
    aoSalvar();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      /*
        ⚠️ Sem o apelido no titulo: ele e o PRIMEIRO campo do formulario, logo
        abaixo. Escrito nos dois lugares, a mesma informacao aparece duas vezes
        na primeira dobra — e a do titulo e a pior das duas, porque nao se copia
        e nao se edita. Mesma decisao da conta a receber e do recebimento.
      */
      title={conta ? "Conta" : "Nova conta"}
      acoes={
        <Button
          size="xs"
          variant="primary"
          disabled={salvando || !identificavel}
          title={
            !identificavel
              ? "Informe ao menos o apelido, o banco ou o número da conta"
              : undefined
          }
          onClick={salvar}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      {/*
        ⚠️ A anatomia e a do resto do sistema: `Formulario` e `GrupoDeCampos`,
        com o vao entre campos vindo do token. Havia um `gap: 3` escrito a mao,
        que acertava o vao dos campos por coincidencia e errava o de um bloco
        para o outro.
      */}
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Identificação"
          legenda="Como esta conta é reconhecida nas telas e nos relatórios. O número na frente do banco é o que separa duas contas da mesma instituição."
        >
          <Field
            label="Apelido"
            hint="Como esta conta aparece na hora de escolher onde o dinheiro caiu."
          >
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Ex.: Cresol movimento"
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Banco">
            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Agência">
            <input
              value={agencia}
              onChange={(e) => setAgencia(e.target.value)}
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Conta">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              maxLength={120}
              style={inputStyle}
            />
          </Field>

          <Field label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={selectStyle}
            >
              <option value="">Escolher…</option>
              {TIPOS_DE_CONTA.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {/* Desativar é o caminho para conta que não se usa mais: excluir levaria
            junto o "onde" de todo lançamento que já passou por ela. */}
          <Field
            label="Ativa"
            hint="Conta inativa some das listas de escolha e sai do consolidado."
          >
            {/*
            ⚠️ O interruptor do KIT, e nao uma caixa de marcar escrita aqui.

            Era um `<input type="checkbox">` com rotulo proprio, alinhado a mao
            pela altura do campo. O mesmo gesto ja tem desenho no sistema, e dois
            desenhos para ligar e desligar fazem a pessoa aprender duas vezes.
          */}
            <ActiveToggle active={ativo} onChange={() => setAtivo((a) => !a)} />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="Saldo"
          legenda="A partida de onde o saldo de hoje é calculado. Nada aqui é lançamento: o histórico soma por cima deste ponto."
        >
          {/*
            ⚠️ SEM "Saldo atual" aqui.

            Ele veio do rodape para ca, e agora saiu de vez: a listagem deixou de
            calcular saldo — `vwsaldo` varre `pagamentos` inteiro a cada chamada
            — e este drawer recebe a conta VINDA da listagem, entao o numero
            chegaria nulo. Buscar a conta de novo so para exibi-lo seria uma
            consulta pesada por abertura de cadastro, para um dado que nao se
            edita aqui.

            Ele nao se perdeu: o extrato, a um clique, abre com abertura,
            entradas, saidas e fecho — e ali a conta e de UMA conta so.
          */}
          {/*
            ⚠️ O saldo inicial aparece, mas NAO se edita aqui.

            Ele e a partida de onde todo o saldo sai, e se define na
            inicializacao de saldo — que existe justamente para conferir contra o
            extrato numa data de corte. Um segundo campo editavel para o mesmo
            numero, sem essa conferencia, faria o saldo de hoje mudar inteiro por
            causa de um valor corrigido de passagem. Continua a vista porque e
            ele que explica o saldo atual logo acima.
          */}
          <Field
            label="Saldo inicial"
            hint="O que havia na conta antes do primeiro lançamento. Definido na inicialização de saldo, onde se confere contra o extrato numa data de corte."
          >
            <CampoBloqueado
              valor={formatarSemSimbolo(conta?.saldoInicial ?? ZERO)}
            />
          </Field>

          <Field
            label="Limite"
            hint="Cheque especial. Não entra no saldo, só serve de referência."
          >
            <CampoNumerico valor={limite} escala={100} aoMudar={setLimite} />
          </Field>
        </GrupoDeCampos>

        {/*
          ⚠️ O que a conta COBRA para receber, e nao o que ela tem.

          A taxa da adquirente e do contrato: muda uma vez por ano e vale para
          todas as vendas daquela maquininha. Perguntada a cada baixa — que e o
          que a tela de recebimento faz hoje —, ela e refeita de cabeca, e cada
          pessoa chega a um numero. Aqui ela se responde uma vez.
        */}
        <GrupoDeCampos
          titulo="Recebimento"
          legenda="O que esta conta cobra para receber, e em quanto tempo o dinheiro cai. É daqui que a baixa vai sugerir a taxa em vez de perguntar."
        >
          <Field
            label="Recebe com cartão"
            hint="Marque se esta conta é a da maquininha. Sem isto, a baixa não tem por que perguntar taxa de cartão."
          >
            <ActiveToggle
              active={aceitaCartao}
              onChange={() => setAceitaCartao((a) => !a)}
            />
          </Field>

          {/* Os campos de taxa so aparecem onde ha cartao: perguntar percentual
              numa conta que so recebe PIX e pedir para preencher nada. */}
          {aceitaCartao && (
            <>
              <Field label="Taxa de débito (%)">
                <CampoPercentual valor={taxaDebito} aoMudar={setTaxaDebito} />
              </Field>

              <Field label="Taxa de crédito à vista (%)">
                <CampoPercentual valor={taxaCredito} aoMudar={setTaxaCredito} />
              </Field>

              <Field
                label="Taxa de parcelado (%)"
                hint="A do parcelamento sem juros, que é a que sai do seu valor."
              >
                <CampoPercentual
                  valor={taxaParcelado}
                  aoMudar={setTaxaParcelado}
                />
              </Field>

              {/*
                ⚠️ O prazo e por CONTA, e nao o D+30 do sistema.

                `previsaoDeCredito` traz trinta dias cravados, e o proprio texto
                da baixa admite que cada contrato com a adquirente tem o seu.
                Preenchido aqui, a data sugerida deixa de ser chute.
              */}
              <Field
                label="Dias até o crédito"
                hint="Quantos dias entre a venda e o dinheiro cair. Vazio usa o padrão da forma de recebimento."
              >
                <CampoNumerico
                  valor={prazoCredito ?? 0}
                  escala={1}
                  aoMudar={(v) => setPrazoCredito(v > 0 ? v : null)}
                />
              </Field>
            </>
          )}

          {/*
            ⚠️ VALOR fixo, e nao percentual. O banco cobra por boleto emitido, e
            o custo e o mesmo num boleto de 50 e num de 50 mil.
          */}
          <Field
            label="Tarifa por boleto"
            hint="O que o banco cobra por boleto emitido. Vazio, ou zero, significa que esta conta não cobra."
          >
            <CampoNumerico
              valor={tarifaBoleto ?? 0}
              escala={100}
              aoMudar={(v) => setTarifaBoleto(v > 0 ? centavos(v) : null)}
            />
          </Field>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
