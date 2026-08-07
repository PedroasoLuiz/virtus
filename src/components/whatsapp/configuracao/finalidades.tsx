"use client";

import { useCallback, useEffect, useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Drawer } from "@/components/ui/drawer";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import {
  AcoesDaLinha,
  Badge,
  BotaoDeAcao,
  Button,
  CabecalhoDeSecao,
  CampoBloqueado,
  Field,
  PanelTabs,
  SkeletonRows,
  TableArea,
  TableHead,
  inputStyle,
  Td,
  Th,
  Tr,
  selectStyle,
} from "@/components/ui/kit";
import {
  FINALIDADES,
  previaDoCorpo,
  problemasDoTexto,
  type Finalidade,
  type VinculoDeModelo,
} from "@/modules/whatsapp/finalidades";
import {
  formatarTelefone,
  type ContaWhatsapp,
  type Modelo,
} from "@/modules/whatsapp/whatsapp.types";

/**
 * Para que o sistema manda mensagem, e com qual modelo do cliente.
 *
 * ⚠️ A lista da esquerda é NOSSA e é fixa: são as coisas que o sistema sabe
 * enviar. A da direita é do cliente. O que esta tela faz é a ligação entre as
 * duas, e é ela que substituiu o nome de modelo escrito no código.
 *
 * ⚠️ O mapeamento é marcador a marcador, e não "escolha a ordem". A Meta só
 * aceita parâmetros posicionais, e pedir a ordem em texto é exatamente o jeito
 * de trocar valor por vencimento sem nada acusar até chegar no cliente.
 */

type Aba = "Parametrização" | "Exibição";

export function Finalidades({
  contas,
  vinculos,
  onMudou,
}: {
  /** Os números ativos com token. O vínculo é de um deles. */
  contas: ContaWhatsapp[];
  vinculos: VinculoDeModelo[] | null;
  onMudou: () => void;
}) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<{ finalidade: Finalidade; contaId: number } | null>(
    null,
  );
  const [criando, setCriando] = useState<Finalidade | null>(null);
  const [pedindo, setPedindo] = useState<string | null>(null);

  const emAnalise = (vinculos ?? []).filter((v) => v.solicitacaoStatus === "PENDING");

  /*
   * ⚠️ O laço existe SÓ enquanto há modelo em análise, e some quando o último
   * é decidido — é a dependência do efeito que garante isso, não um `if` lá
   * dentro. A Meta costuma responder em minutos; meio minuto entre perguntas é
   * rápido o bastante para parecer instantâneo e raro o bastante para não virar
   * uma chamada externa a cada instante, multiplicada por empresa.
   */
  const chaves = emAnalise.map((v) => `${v.contaId}:${v.finalidade}`).join(",");

  useEffect(() => {
    if (!chaves) return;

    const id = setInterval(() => {
      for (const chave of chaves.split(",")) {
        const [conta, finalidade] = chave.split(":");

        void fetch(
          `/api/v1/whatsapp/modelos/solicitacao?contaId=${conta}&finalidade=${finalidade}`,
        ).then((r) => {
          if (r.ok) onMudou();
        });
      }
    }, 30_000);

    return () => clearInterval(id);
  }, [chaves, onMudou]);

  async function enviarPedido(
    f: Finalidade,
    contaId: number,
    texto: { cabecalho: string | null; corpo: string; rodape: string | null },
  ) {
    setPedindo(f.id);

    const r = await fetch("/api/v1/whatsapp/modelos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contaId, finalidade: f.id, ...texto }),
    });

    setPedindo(null);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      avisar("atencao", corpo?.error?.message ?? "A Meta recusou a criação do modelo");
      return;
    }

    setCriando(null);
    avisar(
      "sucesso",
      "Modelo enviado para revisão",
      "A Meta costuma responder em minutos. A situação aqui muda sozinha.",
    );
    onMudou();
  }

  /*
   * Uma linha por VÍNCULO, e não por finalidade.
   *
   * ⚠️ É o que responde "cobrança por qual número?". A mesma finalidade pode
   * existir em vários números — cobrança pelo financeiro, ticket pelo
   * almoxarifado — e uma linha por finalidade esconderia o segundo. Finalidade
   * sem vínculo nenhum entra uma vez, para não sumir da lista do que o sistema
   * sabe enviar.
   */
  type Linha = { finalidade: Finalidade; vinculo: VinculoDeModelo | null };

  const linhas = FINALIDADES.flatMap<Linha>((finalidade) => {
    const seus = (vinculos ?? []).filter((v) => v.finalidade === finalidade.id);

    if (seus.length === 0) return [{ finalidade, vinculo: null }];

    return seus.map((vinculo) => ({ finalidade, vinculo }));
  });

  function nomeDoNumero(contaId: number): string {
    const c = contas.find((x) => x.id === contaId);
    if (!c) return "número removido";

    return c.apelido || formatarTelefone(c.numero ?? "") || c.phoneNumberId;
  }

  return (
    <>
      <CabecalhoDeSecao
        titulo="O que o sistema envia"
        legenda="Cada linha é uma mensagem que o sistema dispara, e por qual número ela sai. Uma finalidade pode viver num número e outra em outro: cobrança pelo financeiro, ticket pelo almoxarifado. Sem vínculo, o envio não acontece."
      />

      <TableArea minWidth={0}>
        <TableHead>
          <Th>Finalidade</Th>
          <Th>Número</Th>
          <Th>Modelo</Th>
          <Th minWidth={90}>Situação</Th>
          <Th> </Th>
        </TableHead>

        <tbody>
          {vinculos == null ? (
            <SkeletonRows
              cols={5}
              rows={4}
              labels={["Finalidade", "Número", "Modelo", "Situação", ""]}
            />
          ) : (
            linhas.map(({ finalidade: f, vinculo: v }) => (
              <Tr key={`${f.id}-${v?.contaId ?? 0}`}>
                <Td>
                  <div style={{ fontWeight: "var(--fw-semi)" }}>{f.rotulo}</div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {/*
                      ⚠️ Dizer que ainda NÃO dispara é o ponto.

                      Vincular antes de a tela existir é útil, porque aprovar
                      modelo na Meta demora. Mas quem vincula e não vê mensagem
                      nenhuma sair conclui que quebrou.
                    */}
                    {f.origem ?? "Ainda não é disparada por nenhuma tela"}
                  </div>
                </Td>

                <Td>
                  {v ? (
                    nomeDoNumero(v.contaId)
                  ) : (
                    <span style={{ color: "var(--text-tertiary)" }}>—</span>
                  )}
                </Td>

                <Td>
                  <ModeloDaLinha vinculo={v} />
                </Td>

                <Td>
                  <SituacaoDoVinculo vinculo={v} />
                </Td>

                <Td>
                  <AcoesDaLinha>
                    {/*
                      ⚠️ Só quando não há vínculo nem pedido correndo.

                      Pedir de novo criaria um segundo modelo na conta da
                      empresa, contra o teto dela, para a mesma finalidade — e é
                      exatamente o laço que a trava do serviço recusa.
                    */}
                    {!v?.modeloNome && v?.solicitacaoStatus !== "PENDING" && (
                      <BotaoDeAcao
                        rotulo="Criar o modelo padrão na Meta"
                        onClick={() => setCriando(f)}
                        desabilitado={pedindo === f.id}
                        destaque
                      >
                        <MarcaDaMeta />
                      </BotaoDeAcao>
                    )}

                    {/*
                      Em análise, configurar fica travado: mexer no vínculo
                      enquanto a Meta decide sobre o modelo que o sistema pediu
                      deixaria os dois brigando pela mesma linha.
                    */}
                    <BotaoDeAcao
                      rotulo={
                        v?.solicitacaoStatus === "PENDING"
                          ? "Aguardando a revisão da Meta"
                          : "Configurar"
                      }
                      onClick={() =>
                        setEditando({
                          finalidade: f,
                          contaId: v?.contaId ?? contas[0]?.id ?? 0,
                        })
                      }
                      desabilitado={v?.solicitacaoStatus === "PENDING" || contas.length === 0}
                    >
                      <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                    </BotaoDeAcao>
                  </AcoesDaLinha>
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </TableArea>

      {criando && (
        <EscolhaDoNumero
          finalidade={criando}
          contas={contas}
          ocupado={pedindo === criando.id}
          onFechar={() => setCriando(null)}
          onConfirmar={(contaId, texto) => void enviarPedido(criando, contaId, texto)}
        />
      )}

      {editando && (
        <FormularioDoVinculo
          contas={contas}
          finalidade={editando.finalidade}
          contaInicial={editando.contaId}
          vinculo={
            vinculos?.find(
              (x) => x.finalidade === editando.finalidade.id && x.contaId === editando.contaId,
            ) ?? null
          }
          onFechar={() => setEditando(null)}
          onSalvou={() => {
            setEditando(null);
            onMudou();
          }}
        />
      )}
    </>
  );
}

/** O modelo da linha, com o que houver de motivo embaixo. */
function ModeloDaLinha({ vinculo }: { vinculo: VinculoDeModelo | null }) {
  if (!vinculo) return <span style={{ color: "var(--text-tertiary)" }}>nenhum</span>;

  const mono = { fontFamily: "var(--font-mono, monospace)" };
  const nota = {
    marginTop: 2,
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  } as const;

  if (vinculo.solicitacaoStatus === "PENDING") {
    return (
      <>
        <span style={mono}>{vinculo.solicitacaoNome}</span>
        <div style={nota}>pedido à Meta, aguardando revisão</div>
      </>
    );
  }

  if (vinculo.solicitacaoStatus === "REJECTED" && !vinculo.modeloNome) {
    return (
      <>
        <span style={mono}>{vinculo.solicitacaoNome}</span>
        <div style={nota}>{vinculo.solicitacaoMotivo ?? "A Meta recusou. Vincule um modelo seu."}</div>
      </>
    );
  }

  if (!vinculo.modeloNome) return <span style={{ color: "var(--text-tertiary)" }}>nenhum</span>;

  return (
    <>
      <span style={mono}>{vinculo.modeloNome}</span>

      {/* O motivo da falha, para não exigir abrir o formulário só para
          descobrir o que a Meta recusou. */}
      {vinculo.erro && <div style={nota}>{vinculo.erro}</div>}
    </>
  );
}

/**
 * Por qual número o modelo padrão vai nascer, e com que texto.
 *
 * ⚠️ Pergunta o número antes de criar. O modelo é criado na WABA daquele número
 * e não migra: errar aqui significa um modelo aprovado na conta errada,
 * ocupando o teto dela, que só se resolve criando outro no número certo.
 *
 * ⚠️ O texto pode ser reescrito, mas os MARCADORES não. O mapeamento é
 * posicional e já está decidido pela finalidade; apagar um `{{n}}` faria o
 * vínculo automático apontar valor para a posição errada.
 */
function EscolhaDoNumero({
  finalidade,
  contas,
  ocupado,
  onFechar,
  onConfirmar,
}: {
  finalidade: Finalidade;
  contas: ContaWhatsapp[];
  ocupado: boolean;
  onFechar: () => void;
  onConfirmar: (
    contaId: number,
    texto: { cabecalho: string | null; corpo: string; rodape: string | null },
  ) => void;
}) {
  const [contaId, setContaId] = useState(contas[0]?.id ?? 0);
  const [editando, setEditando] = useState(false);
  const [cabecalho, setCabecalho] = useState(finalidade.cabecalhoSugerido ?? "");
  const [corpo, setCorpo] = useState(finalidade.corpoSugerido);
  const [rodape, setRodape] = useState(finalidade.rodapeSugerido ?? "");

  const erros = problemasDoTexto(finalidade, corpo);

  // Os exemplos na posição de cada marcador, para a prévia mostrar valores.
  const exemplos = finalidade.parametrosSugeridos.map(
    (chave) => finalidade.variaveis.find((v) => v.chave === chave)?.exemplo ?? "…",
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      nivel={3}
      title="Criar o modelo padrão"
      subtitle={finalidade.rotulo}
      acoes={
        <Button
          size="xs"
          variant="primary"
          onClick={() =>
            onConfirmar(contaId, {
              cabecalho: cabecalho.trim() || null,
              corpo: corpo.trim(),
              rodape: rodape.trim() || null,
            })
          }
          disabled={ocupado || !contaId || erros.length > 0}
          title={erros[0]}
        >
          {ocupado ? "Enviando…" : "Criar na Meta"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <SecaoSimples
          primeiro
          titulo="Onde criar"
          legenda="O modelo nasce na conta da Meta deste número, e é por ele que esta finalidade vai falar. Ele não migra depois: criado no número errado, só se resolve criando outro no certo."
        >
          <Field label="Número">
            <select
              style={selectStyle}
              value={contaId}
              onChange={(e) => setContaId(Number(e.target.value))}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido || formatarTelefone(c.numero ?? "") || c.phoneNumberId}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nome na Meta">
            <CampoBloqueado valor={finalidade.nomeSugerido} />
          </Field>

          <Field label="Categoria">
            <CampoBloqueado
              valor={finalidade.categoria === "UTILITY" ? "Utilitário" : "Marketing"}
            />
          </Field>
        </SecaoSimples>

        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: "calc(var(--text-lg) + 2px)",
                fontWeight: "var(--fw-semi)",
                color: "var(--text-primary)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              Como vai ficar
            </div>

            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                fontSize: "var(--text-sm)",
                color: "var(--primary)",
                cursor: "pointer",
              }}
            >
              {editando ? "Ver a prévia" : "Editar o texto"}
            </button>
          </div>

          <p
            style={{
              marginTop: 6,
              marginBottom: 12,
              fontSize: "calc(var(--text-xs) + 1px)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            {editando
              ? "Escreva o que quiser, mas mantenha os campos {{1}} a {{" +
                finalidade.parametrosSugeridos.length +
                "}}: é a posição deles que o sistema preenche. Use *asterisco* para negrito."
              : "É assim que a mensagem chega, com valores de exemplo no lugar dos campos."}
          </p>

          {editando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label
                  htmlFor="cab"
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Primeira linha, em destaque (opcional)
                </label>
                <input
                  id="cab"
                  style={{ ...inputStyle, width: "100%" }}
                  maxLength={60}
                  value={cabecalho}
                  onChange={(e) => setCabecalho(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="corpo"
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Mensagem
                </label>
                <textarea
                  id="corpo"
                  rows={12}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    height: "auto",
                    padding: 10,
                    lineHeight: "var(--lh-normal)",
                    resize: "vertical",
                  }}
                  value={corpo}
                  onChange={(e) => setCorpo(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="rod"
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontSize: "var(--text-xs)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Última linha, em cinza (opcional)
                </label>
                <input
                  id="rod"
                  style={{ ...inputStyle, width: "100%" }}
                  maxLength={60}
                  value={rodape}
                  onChange={(e) => setRodape(e.target.value)}
                />
              </div>

              {/*
                ⚠️ O erro aparece EDITANDO, e não só no botão desabilitado.

                A regra dos marcadores não é óbvia: quem apaga um `{{2}}` sem
                querer precisa saber por que o salvar travou, e o `title` do
                botão só aparece com o mouse parado em cima dele.
              */}
              {erros.length > 0 && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--danger-text)" }}>{erros[0]}</p>
              )}
            </div>
          ) : (
            <>
              <CartaoDeTexto>
                {cabecalho.trim() && (
                  <div style={{ fontWeight: "var(--fw-semi)", marginBottom: 8 }}>
                    {cabecalho.trim()}
                  </div>
                )}

                {comFormatacaoDoWhatsapp(previaDoCorpo(corpo, exemplos))}

                {rodape.trim() && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {rodape.trim()}
                  </div>
                )}
              </CartaoDeTexto>

              {finalidade.botao && <CartaoDeBotao texto="Acessar fatura" />}
            </>
          )}
        </section>
      </div>

      <p
        style={{
          marginTop: 22,
          fontSize: "calc(var(--text-xs) + 1px)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        Os campos já vão mapeados. O modelo passa pela revisão da Meta antes de poder enviar, e
        quando ela aprovar o vínculo acontece sozinho.
      </p>
    </Drawer>
  );
}

/** Título, legenda e campos. O mesmo arranjo das outras seções do módulo. */
function SecaoSimples({
  titulo,
  legenda,
  primeiro,
  children,
}: {
  titulo: string;
  legenda: string;
  primeiro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ marginBottom: 12, marginTop: primeiro ? 0 : 4 }}>
        <div
          style={{
            fontSize: "calc(var(--text-lg) + 2px)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {titulo}
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          {legenda}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{children}</div>
    </section>
  );
}

/**
 * ⚠️ "Vinculado" não basta: o modelo pode ter saído de aprovado, ou ganhado
 * mais um campo, depois do vínculo. Quem só olha a tela precisa ver isso antes
 * de descobrir por um envio que falhou.
 */
function SituacaoDoVinculo({ vinculo }: { vinculo: VinculoDeModelo | null }) {
  if (!vinculo) {
    return (
      <Badge tom="neutral">
        <Relogio />
        não configurado
      </Badge>
    );
  }

  /*
   * ⚠️ A análise vence tudo. Enquanto ela corre, nada mais é verdade sobre esta
   * linha: não há modelo vinculado, e o que existe é uma espera.
   */
  if (vinculo.solicitacaoStatus === "PENDING") {
    return (
      <Badge tom="info">
        <Relogio />
        modelo em análise
      </Badge>
    );
  }

  /*
   * Recusado só continua na tela ENQUANTO não há vínculo. Depois de a pessoa
   * ligar um modelo dela, a recusa antiga vira história e ficar mostrando ela
   * acusaria um problema que já foi resolvido por outro caminho.
   */
  if (vinculo.solicitacaoStatus === "REJECTED" && !vinculo.modeloNome) {
    return (
      <Badge tom="danger">
        <Atencao />
        modelo recusado
      </Badge>
    );
  }

  if (!vinculo.modeloNome) {
    return (
      <Badge tom="neutral">
        <Relogio />
        não configurado
      </Badge>
    );
  }

  // ⚠️ O erro vence o "pronto": ele é mais novo que a validação, e é o único
  // sinal de que algo mudou na Meta depois do vínculo.
  if (vinculo.erro) {
    return (
      <Badge tom="danger">
        <Atencao />
        o envio falhou
      </Badge>
    );
  }

  return (
    <Badge tom="success">
      <Certo />
      pronto
    </Badge>
  );
}

/**
 * A marca da Meta, no infinito de dois laços.
 *
 * ⚠️ Monocromática, em `currentColor`, como todos os ícones da tabela. O logo
 * colorido deles exigiria hospedar o arquivo, acompanhar quando trocam, e
 * quebraria no tema escuro — e aqui o que importa é o olho reconhecer que a
 * ação sai daqui para lá.
 */
function MarcaDaMeta() {
  return (
    <>
      <path d="M2 10.2c0-2.4 1.2-4.4 3-4.4 1.5 0 2.4 1.1 3.4 2.8.9 1.5 1.5 2.6 1.6 2.8" />
      <path d="M14 10.2c0-2.4-1.2-4.4-3-4.4-1.5 0-2.4 1.1-3.4 2.8-.9 1.5-1.5 2.6-1.6 2.8" />
      <path d="M5 5.8c-1.8 0-3 2-3 4.4 0 1.6.7 2.6 1.9 2.6 1.3 0 2.1-1 3.1-2.6" />
      <path d="M11 5.8c1.8 0 3 2 3 4.4 0 1.6-.7 2.6-1.9 2.6-1.3 0-2.1-1-3.1-2.6" />
    </>
  );
}

/*
 * Os símbolos da situação.
 *
 * ⚠️ Formas diferentes, e não a mesma bolinha em três cores: quem enxerga pouca
 * diferença entre vermelho e cinza continua lendo o relógio como "falta fazer"
 * e o certo como "feito". A cor é reforço, não o único sinal.
 */
const TRACO = {
  width: 11,
  height: 11,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { flexShrink: 0 },
  "aria-hidden": true,
};

function Certo() {
  return (
    <svg {...TRACO}>
      <path d="M3.6 10.6l4 4 8.8-9.2" />
    </svg>
  );
}

function Relogio() {
  return (
    <svg {...TRACO}>
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 5.8V10l2.8 1.8" />
    </svg>
  );
}

function Atencao() {
  return (
    <svg {...TRACO}>
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 6.2v4.4M10 13.4v.1" />
    </svg>
  );
}

function FormularioDoVinculo({
  contas,
  finalidade,
  contaInicial,
  vinculo,
  onFechar,
  onSalvou,
}: {
  contas: ContaWhatsapp[];
  finalidade: Finalidade;
  contaInicial: number;
  vinculo: VinculoDeModelo | null;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [contaId, setContaId] = useState(contaInicial);

  /*
   * Os modelos aprovados saem da META, e por NUMERO.
   *
   * ⚠️ Lidos aqui e nao recebidos de fora: a lista muda com o numero escolhido
   * logo acima, e trocar de numero sem trocar a lista ofereceria modelos que nao
   * existem naquela conta.
   */
  const [modelos, setModelos] = useState<Modelo[]>([]);

  const carregar = useCallback(async (id: number) => {
    setModelos([]);
    const r = await fetch(`/api/v1/whatsapp/modelos?contaId=${id}`);
    const corpo = await r.json().catch(() => null);

    setModelos(r.ok ? (corpo?.data ?? []) : []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(contaId), 0);

    return () => clearTimeout(t);
  }, [contaId, carregar]);
  const [nome, setNome] = useState(vinculo?.modeloNome ?? "");
  const [parametros, setParametros] = useState<string[]>(vinculo?.parametros ?? []);
  const [botao, setBotao] = useState<string | null>(vinculo?.botaoParam ?? null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<Aba>("Parametrização");

  const modelo = modelos.find((m) => m.nome === nome) ?? null;

  /*
   * Um seletor por `{{n}}` do modelo ESCOLHIDO.
   *
   * A quantidade vem da Meta, não do formulário: é o único jeito de a tela
   * pedir exatamente o que o template pede, e de o erro aparecer aqui em vez
   * de no envio.
   */
  const marcadores = modelo?.parametros ?? 0;

  function trocarModelo(novo: string) {
    setNome(novo);
    // Zera o mapeamento: o `{{2}}` do modelo anterior não é o deste.
    setParametros([]);
    setBotao(null);
  }

  function definir(indice: number, chave: string) {
    const proximo = [...parametros];
    while (proximo.length < marcadores) proximo.push("");
    proximo[indice] = chave;
    setParametros(proximo);
  }

  const faltando =
    !modelo ||
    parametros.length !== marcadores ||
    parametros.some((p) => !p);

  async function salvar() {
    if (salvando || faltando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/whatsapp/vinculos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contaId,
        finalidade: finalidade.id,
        modeloNome: nome,
        idioma: modelo?.idioma ?? "pt_BR",
        parametros,
        botaoParam: botao,
      }),
    });

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      const detalhe = corpo?.error?.details?.[0];
      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar o vínculo"),
      );
      return;
    }

    avisar("sucesso", "Vínculo salvo.");
    onSalvou();
  }

  async function remover() {
    setSalvando(true);

    const r = await fetch(
      `/api/v1/whatsapp/vinculos?contaId=${contaId}&finalidade=${finalidade.id}`,
      { method: "DELETE" },
    );

    setSalvando(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível remover");
      return;
    }

    avisar("sucesso", "Vínculo removido.");
    onSalvou();
  }

  // Os exemplos na posição de cada marcador, para a prévia.
  const exemplos = parametros.map(
    (chave) => finalidade.variaveis.find((v) => v.chave === chave)?.exemplo ?? "…",
  );

  return (
    <Drawer
      open
      onClose={onFechar}
      nivel={3}
      title={finalidade.rotulo}
      acoes={
        <Button
          size="xs"
          variant="primary"
          onClick={() => void salvar()}
          disabled={salvando || faltando}
          title={faltando ? "Escolha o modelo e o que entra em cada campo" : undefined}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      {/*
        ⚠️ Duas abas, e não uma pilha só.

        Parametrização é onde se DECIDE; Exibição é onde se CONFERE. Numa
        coluna única, a prévia e o dicionário ficavam abaixo dos seletores, e
        justamente quem estava mapeando precisava rolar para conferir e voltar
        para corrigir. Separadas, cada aba responde a uma pergunta inteira.
      */}
      <PanelTabs
        tabs={["Parametrização", "Exibição"]}
        active={aba}
        onChange={(t) => setAba(t as Aba)}
      />

      {aba === "Parametrização" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/*
          ⚠️ ANTES do seletor, e recolhida assim que um modelo é escolhido.

          Quem chega sem modelo precisa dela primeiro: é o texto que vai criar o
          template na Meta, e embaixo do seletor ela só apareceria depois de a
          pessoa procurar o que não tem. Quem já escolheu não precisa mais dela
          ocupando o topo, mas continua a um clique para comparar o próprio
          texto com um que já sabe onde cada campo entra.
        */}
        <Sugestao finalidade={finalidade} recolher={Boolean(nome)} />

        <Secao
          primeiro
          titulo="O modelo"
          legenda={`${finalidade.descricao} Escolha por qual número ela fala e qual dos modelos aprovados dele atende.`}
        >
          <Field
            label="Número"
            hint="O vínculo é deste número. Outra finalidade pode sair por outro."
          >
            <select
              style={selectStyle}
              value={contaId}
              onChange={(e) => {
                setContaId(Number(e.target.value));
                // Zera a escolha: o modelo do número anterior não existe neste.
                trocarModelo("");
              }}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido || formatarTelefone(c.numero ?? "") || c.phoneNumberId}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modelo aprovado">
            <select style={selectStyle} value={nome} onChange={(e) => trocarModelo(e.target.value)}>
              <option value="">escolha um modelo</option>
              {modelos.map((m) => (
                <option key={`${m.nome}-${m.idioma}`} value={m.nome}>
                  {m.nome} ({m.parametros} campo{m.parametros === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </Field>
        </Secao>


        {modelo && (
          <>
            <Secao
              titulo="O que entra em cada campo"
              legenda="Os campos aparecem na ordem do seu texto. O primeiro é o {{1}}, e assim por diante."
            >
              {marcadores === 0 && (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  Este modelo não tem campos para preencher. O texto sai igual para todo mundo.
                </p>
              )}

              {Array.from({ length: marcadores }, (_, i) => (
                <Field key={i} label={`Campo {{${i + 1}}}`}>
                  <select
                    style={selectStyle}
                    value={parametros[i] ?? ""}
                    onChange={(e) => definir(i, e.target.value)}
                  >
                    <option value="">escolha o que entra aqui</option>
                    {finalidade.variaveis.map((v) => (
                      <option key={v.chave} value={v.chave}>
                        {v.rotulo}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}

              {/*
                ⚠️ Aparece sempre que a finalidade tem um link para dar, e NÃO
                só quando a URL do modelo termina em `{{1}}`.

                A Meta guarda o `{{1}}` da URL codificado, e por isso o botão
                que funciona aqui é o de URL fixa terminando em `/p/` — o valor
                vai como sufixo no envio. Amarrar o campo à presença do
                marcador escondia a opção justamente na configuração correta.
              */}
              {finalidade.botao && (
                <Field label="Botão do modelo" hint={finalidade.botao.descricao}>
                  <select
                    style={selectStyle}
                    value={botao ?? ""}
                    onChange={(e) => setBotao(e.target.value || null)}
                  >
                    <option value="">este modelo não tem botão</option>
                    <option value={finalidade.botao.chave}>{finalidade.botao.rotulo}</option>
                  </select>
                </Field>
              )}

              {finalidade.botao && botao && <LinkDoBotao />}
            </Secao>

            {/*
              ⚠️ A prévia fica AQUI, colada nos seletores, e não na outra aba.

              Ela é a resposta imediata a cada escolha: escolheu "valor" no
              campo 1, o texto passa a mostrar o valor ali. Numa aba separada, o
              retorno só chegava depois de um clique, e conferir exigia ir e
              voltar a cada seletor mexido — que é justamente quando o erro de
              ordem acontece.
            */}
            <Secao
              titulo="Como vai chegar"
              legenda="O seu texto com os valores de exemplo no lugar, atualizando conforme você escolhe. É assim que o cliente vê."
            >
              {/*
                ⚠️ SEM copiar. O texto aqui é o modelo que o próprio usuário
                escreveu e já tem aprovado na Meta: copiá-lo não leva a lugar
                nenhum. O que vale copiar é a sugestão, que fica logo abaixo.
              */}
              <CartaoDeTexto>
                {comFormatacaoDoWhatsapp(previaDoCorpo(modelo.corpo, exemplos))}
              </CartaoDeTexto>

              {/*
                ⚠️ O cartão segue a ESCOLHA, e não só o modelo.

                Marcando "este modelo não tem botão", a prévia perde o cartão
                junto: a prévia é o que o vínculo vai produzir, e não um retrato
                do template. Mostrar o botão de um link que o sistema decidiu
                não completar prometeria um caminho que a mensagem não leva.

                Sem a finalidade ter link para dar, não há dropdown, e aí o que
                manda é o modelo mesmo.
              */}
              {modelo.botao && (!finalidade.botao || botao) && (
                <CartaoDeBotao texto={modelo.botao.texto} />
              )}
            </Secao>
          </>
        )}

        {vinculo && <Desfazer onRemover={remover} ocupado={salvando} />}
      </div>
      )}

      {aba === "Exibição" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Dicionario
            primeiro
            finalidade={finalidade}
            parametros={parametros}
            botao={botao}
          />
        </div>
      )}
    </Drawer>
  );
}

/**
 * Desfazer o vínculo, atrás de uma sanfona.
 *
 * ⚠️ Fechada por padrão, pelo mesmo motivo do excluir chave: não é o que se vem
 * fazer aqui, e aberta ficaria a um clique de distância de salvar.
 */
function Desfazer({ onRemover, ocupado }: { onRemover: () => void; ocupado: boolean }) {
  const [aberta, setAberta] = useState(false);

  return (
    <section style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "calc(var(--text-lg) + 2px)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        Mais
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "var(--text-tertiary)",
            transform: aberta ? "rotate(180deg)" : "none",
            transition: "transform 160ms var(--ease-out)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberta && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={onRemover}
            disabled={ocupado}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              fontSize: "var(--text-base)",
              color: "var(--danger-text)",
              cursor: "pointer",
            }}
          >
            Desfazer este vínculo
          </button>

          <p
            style={{
              marginTop: 4,
              fontSize: "calc(var(--text-xs) + 1px)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            O modelo continua aprovado na Meta. O que para é o envio desta finalidade, que passa a
            falhar dizendo que falta configurar.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * O que cada variável significa, e onde ela caiu.
 *
 * ⚠️ Não é um glossário parado. A etiqueta da esquerda mostra em QUAL marcador
 * a variável foi usada, ou que ela ficou de fora — o que transforma a lista num
 * conferidor do mapeamento feito logo acima. Sem isso, descobrir que o valor
 * ficou sem lugar exigia contar os seletores de novo.
 */
function Dicionario({
  finalidade,
  parametros,
  botao,
  primeiro,
}: {
  finalidade: Finalidade;
  parametros: string[];
  botao: string | null;
  primeiro?: boolean;
}) {
  const todas = finalidade.botao
    ? [...finalidade.variaveis, finalidade.botao]
    : finalidade.variaveis;

  function ondeEntra(chave: string): { rotulo: string; usada: boolean } {
    const i = parametros.indexOf(chave);
    if (i >= 0) return { rotulo: `{{${i + 1}}}`, usada: true };
    if (botao === chave) return { rotulo: "botão", usada: true };
    return { rotulo: "sem uso", usada: false };
  }

  return (
    <Secao
      primeiro={primeiro}
      titulo="O que o sistema tem para dar"
      legenda="São os únicos valores que esta finalidade sabe preencher. A etiqueta à esquerda mostra em qual campo do seu modelo cada um caiu. O que não estiver aqui precisa ser texto fixo dentro do modelo."
    >
      <dl style={{ display: "grid", gap: 0, margin: 0 }}>
        {todas.map((v, i) => {
          const onde = ondeEntra(v.chave);

          return (
            <div
              key={v.chave}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 0",
                /*
                  Divisor só ENTRE os itens. O de cima e o de baixo fechavam a
                  lista numa caixa, e ela não é um bloco: é a continuação da
                  legenda da seção.
                */
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              {/*
                Largura fixa: as etiquetas empilham numa coluna só, e o olho
                desce por elas procurando o "sem uso" sem ler o resto.
              */}
              <span
                style={{
                  flexShrink: 0,
                  width: 62,
                  fontSize: "var(--text-sm)",
                  fontFamily: "var(--font-mono, monospace)",
                  color: onde.usada ? "var(--primary)" : "var(--text-tertiary)",
                }}
              >
                {onde.rotulo}
              </span>

              <div style={{ minWidth: 0 }}>
                <dt style={{ fontSize: "var(--text-sm)", fontWeight: "var(--fw-semi)" }}>
                  {v.rotulo}
                </dt>
                <dd
                  style={{
                    margin: "3px 0 0",
                    fontSize: "calc(var(--text-xs) + 1px)",
                    color: "var(--text-tertiary)",
                    lineHeight: "var(--lh-normal)",
                  }}
                >
                  {v.descricao}
                </dd>

                {/* O exemplo com a cara de dado, e não de continuação da frase. */}
                <dd
                  style={{
                    display: "inline-block",
                    margin: "6px 0 0",
                    padding: "2px 7px",
                    borderRadius: "var(--radius-full)",
                    background:
                      "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {v.exemplo}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </Secao>
  );
}

/**
 * Um corpo pronto para copiar no painel da Meta.
 *
 * ⚠️ Recolhe sozinha quando um modelo é escolhido, mas o clique manual vence:
 * `aberta` guarda a vontade da pessoa e só volta a seguir a regra quando a
 * escolha muda. Recolher por baixo de quem acabou de abrir seria a tela
 * discutindo com o usuário.
 */
function Sugestao({ finalidade, recolher }: { finalidade: Finalidade; recolher: boolean }) {
  const [aberta, setAberta] = useState<boolean | null>(null);
  const [anterior, setAnterior] = useState(recolher);

  // Estado derivado durante o render, e não num efeito: assim a sanfona já sai
  // no estado certo no mesmo quadro em que o modelo é escolhido.
  if (anterior !== recolher) {
    setAnterior(recolher);
    setAberta(null);
  }

  const visivel = aberta ?? !recolher;

  return (
    <section>
      <button
        type="button"
        onClick={() => setAberta(!visivel)}
        aria-expanded={visivel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: "calc(var(--text-lg) + 2px)",
          fontWeight: "var(--fw-semi)",
          color: "var(--text-primary)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        Modelo sugerido
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "var(--text-tertiary)",
            transform: visivel ? "rotate(180deg)" : "none",
            transition: "transform 160ms var(--ease-out)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {visivel && (
        <>
          <p
            style={{
              marginTop: 6,
              marginBottom: 12,
              fontSize: "calc(var(--text-xs) + 1px)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            Um texto pronto para esta finalidade, com os campos na ordem em que o sistema entrega.
            Copie, crie no painel da Meta e ajuste as palavras: depois de aprovado, ele aparece no
            seletor abaixo.
          </p>

          <CartaoDeTexto copiar={finalidade.corpoSugerido} tituloDoCopiar="Copiar o texto sugerido">
            {finalidade.corpoSugerido}
          </CartaoDeTexto>

          {finalidade.botao && <CartaoDeBotao texto="Acessar fatura" />}
        </>
      )}
    </section>
  );
}

/**
 * O cartão de texto, com o copiar DENTRO.
 *
 * ⚠️ O botão mora no canto do próprio cartão, e não ao lado do título da seção.
 * No título, ele ficava a uma linha de distância do que copia e disputava a
 * leitura com o nome da seção; dentro, não há dúvida sobre o que vai para a
 * área de transferência.
 *
 * ⚠️ Em camadas, e não `backgroundColor` direto. `--kanban-coluna-bg` é
 * translúcido (alfa 0.35): sozinho, deixa passar o branco do drawer e some.
 * Sobre uma base sólida ele rende a cor das colunas do quadro, que é onde essa
 * cor já quer dizer "fundo de conteúdo".
 */
function CartaoDeTexto({
  copiar,
  tituloDoCopiar,
  children,
}: {
  /** Sem isto o cartão não ganha botão: nem todo texto vale copiar. */
  copiar?: string;
  tituloDoCopiar?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        // Folga à direita para o texto nunca correr por baixo do botão.
        padding: "10px 40px 10px 12px",
        borderRadius: "var(--radius-lg)",
        background:
          "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--lh-normal)",
        whiteSpace: "pre-wrap",
      }}
    >
      {children}

      {copiar && (
        <div style={{ position: "absolute", top: 6, right: 6 }}>
          <Copiar texto={copiar} titulo={tituloDoCopiar ?? "Copiar"} />
        </div>
      )}
    </div>
  );
}

/** O começo do endereço público. O sistema completa com o token da parcela. */
const BASE_PUBLICA = "/p/";

/**
 * O endereço deste sistema, sempre em `https`.
 *
 * ⚠️ Forçado, e não copiado do navegador. A Meta recusa URL em `http` tanto no
 * botão do modelo quanto no webhook, e em desenvolvimento a origem é
 * `http://localhost`: copiar como está entregaria um endereço que o painel dela
 * rejeita sem dizer por quê.
 *
 * `window` só existe no navegador; no render do servidor sai vazio.
 */
export function origemSegura(): string {
  if (typeof window === "undefined") return "";

  return window.location.origin.replace(/^http:\/\//, "https://");
}

/**
 * O endereço que precisa estar no botão do modelo, na Meta.
 *
 * ⚠️ Existe porque a Meta NÃO deixa a URL inteira ser dinâmica. Ela aceita um
 * endereço fixo com um sufixo variável, e é o sufixo que o sistema preenche com
 * o token da cobrança. Quem cadastra o modelo lá precisa colar exatamente esta
 * base, terminando na barra: um caractere a mais ou a menos e o link chega
 * quebrado no cliente, e só se descobre quando alguém tenta abrir.
 *
 * Aparece só com o link escolhido, porque antes disso não há botão para
 * configurar e a linha seria instrução sobre algo que não está em jogo.
 */
function LinkDoBotao() {
  const url = `${origemSegura()}${BASE_PUBLICA}`;

  return (
    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
      {/* Mesma coluna de 130px dos rótulos do formulário, para alinhar. */}
      <span style={{ width: 130, flexShrink: 0 }} />

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            Link de redirecionamento:
          </span>

          <code
            style={{
              minWidth: 0,
              fontSize: "var(--text-sm)",
              color: "var(--primary)",
              wordBreak: "break-all",
            }}
          >
            {url}
          </code>

          <Copiar texto={url} titulo="Copiar o endereço do botão" />
        </div>

        <p
          style={{
            marginTop: 2,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          Cole isto na URL do botão, no painel da Meta, terminando na barra. A Meta não deixa o
          endereço inteiro ser dinâmico: só o trecho final, que o sistema completa com o código da
          cobrança.
        </p>
      </div>
    </div>
  );
}

/**
 * O botão do modelo, num cartão próprio embaixo da mensagem.
 *
 * ⚠️ Cartão SEPARADO, e não um rodapé do balão, porque é assim que o WhatsApp
 * entrega: a mensagem é uma bolha e o botão é outra, colada embaixo. Desenhado
 * dentro da primeira, a prévia mentiria sobre a forma do que chega.
 *
 * ⚠️ Não é clicável. É a prévia de algo que só existe no aparelho do cliente, e
 * um botão que responde ao clique aqui prometeria uma ação que a tela não tem.
 */
function CartaoDeBotao({ texto }: { texto: string }) {
  return (
    <div
      style={{
        marginTop: 4,
        padding: "9px 12px",
        borderRadius: "var(--radius-lg)",
        background:
          "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        color: "var(--primary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
      }}
    >
      {/* Seta saindo da caixa: o gesto é sair do WhatsApp e abrir outra coisa. */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14 4h6v6" />
        <path d="M20 4l-8.5 8.5" />
        <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </svg>
      {texto}
    </div>
  );
}

/**
 * Copiar, no verde da marca e sem moldura.
 *
 * Mesmo desenho do copiar da URL de callback: é uma ação de apoio ao lado do
 * dado, não um botão com peso próprio. A confirmação troca o ícone por um
 * certo, porque copiar não tem retorno visível nenhum.
 */
function Copiar({ texto, titulo }: { texto: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(texto);
        setCopiado(true);
      }}
      title={copiado ? "Copiado" : titulo}
      aria-label={copiado ? "Copiado" : titulo}
      style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        color: "var(--primary)",
        cursor: "pointer",
      }}
    >
      {copiado ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5.5 5.5L20 7" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2.5" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
        </svg>
      )}
    </button>
  );
}

/** O mesmo agrupador das outras abas: título, legenda e os campos. */
function Secao({
  titulo,
  legenda,
  primeiro,
  children,
}: {
  titulo: string;
  legenda: string;
  primeiro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ marginBottom: 12, marginTop: primeiro ? 0 : 4 }}>
        <div
          style={{
            fontSize: "calc(var(--text-lg) + 2px)",
            fontWeight: "var(--fw-semi)",
            color: "var(--text-primary)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {titulo}
        </div>
        <p
          style={{
            marginTop: 6,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          {legenda}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{children}</div>
    </section>
  );
}
