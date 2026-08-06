"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Drawer } from "@/components/ui/drawer";
import { PrecisaDeAjuda } from "@/components/ui/ajuda";
import {
  AcoesDaLinha,
  ActiveToggle,
  Alert,
  Badge,
  BotaoDeAcao,
  Button,
  CabecalhoDeSecao,
  CampoSecreto,
  EmptyRow,
  Field,
  Pagination,
  SkeletonRows,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import {
  CONFIG_IA_PADRAO,
  MODELOS_POR_PROVEDOR,
  PROVEDORES,
  type ConfigIA,
} from "@/modules/ia/ia.types";
import type { ResultadoDoTeste } from "@/shared/domain/teste-conexao";
import { TesteDeConexao } from "./teste-de-conexao";

/**
 * As chaves que fazem o atendimento automatico funcionar.
 *
 * ⚠️ Quem recebe resposta NAO se decide aqui: e um interruptor de cada numero,
 * na aba Numeros. Provedor e "com o que responder"; numero e "para quem".
 */

const POR_PAGINA = 10;

export function AbaDeProvedores({
  provedores,
  erro,
  onRecarregar,
}: {
  /**
   * ⚠️ Vem de FORA, e isso nao e detalhe.
   *
   * A aba monta e desmonta a cada troca de guia. Com o estado aqui dentro, ele
   * morria junto: voltar para a aba mostrava "carregando" e refazia a consulta
   * de um dado que ja tinha sido lido. Guardado no drawer, ele sobrevive as
   * trocas e so e relido quando alguem salva.
   */
  provedores: ConfigIA[] | null;
  erro: string | null;
  onRecarregar: () => void;
}) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<ConfigIA | null>(null);
  const [pagina, setPagina] = useState(1);

  async function alternarAtivo(p: ConfigIA) {
    const r = await fetch("/api/v1/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: p.id,
        nome: p.nome,
        provedor: p.provedor,
        modelo: p.modelo,
        ativo: !p.ativo,
        // Nula MANTEM a que esta no vault: o interruptor nao mexe em chave.
        chave: null,
      }),
    });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível mudar o provedor");
      return;
    }

    onRecarregar();
  }

  async function remover(id: number) {
    const r = await fetch(`/api/v1/ia/provedores/${id}`, { method: "DELETE" });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível remover");
      return;
    }

    avisar("sucesso", "Provedor removido.");
    onRecarregar();
  }

  if (editando) {
    return (
      <FormularioDoProvedor
        config={editando}
        existentes={provedores ?? []}
        onFechar={() => setEditando(null)}
        onSalvou={() => {
          setEditando(null);
          onRecarregar();
        }}
      />
    );
  }

  const ligados = (provedores ?? []).filter((p) => p.ativo && p.temChave);

  const totalPaginas = Math.max(1, Math.ceil((provedores?.length ?? 0) / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis =
    provedores?.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA) ?? null;

  return (
    <>
      <CabecalhoDeSecao
        titulo="Provedores de IA"
        legenda="As chaves que fazem o atendimento automático funcionar. Cada número usa uma, escolhida na aba Números, e é assim que o gasto de cada setor sai separado."
        onIncluir={() => setEditando({ ...CONFIG_IA_PADRAO })}
        rotuloIncluir="Adicionar provedor"
      />

      {/*
        ⚠️ O aviso vem DEPOIS do titulo, colado na tabela que ele explica.

        Acima do cabecalho ele era a primeira coisa da aba e roubava a abertura:
        quem chegava lia o problema antes de saber em que tela estava. Aqui ele
        le como uma nota sobre a lista logo abaixo, que e o que ele e.

        ⚠️ E EXCECAO, nao placar. Uma caixa verde dizendo "esta tudo bem" a cada
        visita ensina a ignorar o lugar, e ai o dia em que ela ficar ambar
        tambem passa batido. Estando tudo certo, a tabela ja mostra quem esta
        ativo.
      */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {erro && (
          <Alert variant="danger" title="Não foi possível carregar">
            {erro}
          </Alert>
        )}

        {/*
          ⚠️ So quando HA provedor e nenhum esta valendo.

          Com a lista vazia, este aviso e a linha de tabela vazia diziam a mesma
          frase com outras palavras, uma embaixo da outra. A lista vazia ja se
          explica sozinha; o que ela nao cobre e o caso traicoeiro: tem provedor
          cadastrado, parece configurado, e mesmo assim ninguem responde porque
          todos estao desligados ou sem chave.
        */}
        {(provedores?.length ?? 0) > 0 && ligados.length === 0 && (
          <Alert variant="warning" title="Nenhum provedor está valendo">
            Há chave cadastrada, mas todas estão desligadas ou sem chave gravada. Enquanto isso, o
            bot não responde.
          </Alert>
        )}
      </div>

        <TableArea minWidth={0}>
          <TableHead>
            <Th>Provedor</Th>
            <Th minWidth={72}>Em uso</Th>
            <Th minWidth={90}>Situação</Th>
            <Th> </Th>
          </TableHead>

            <tbody>
              {provedores == null ? (
                <SkeletonRows cols={4} rows={3} labels={["Provedor", "Em uso", "Situação", ""]} />
              ) : visiveis!.length === 0 ? (
                <EmptyRow
                  colSpan={4}
                  message="Nenhum provedor. Sem chave, o bot não responde a ninguém."
                />
              ) : (
                visiveis!.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <IconeDoProvedor provedor={p.provedor} />

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: "var(--fw-semi)" }}>{p.nome}</div>

                          {/*
                            Provedor, modelo e o fim da chave numa linha so.

                            ⚠️ Os quatro ultimos caracteres sao o que responde
                            "qual chave e essa?" para quem cadastrou dez. A chave
                            inteira nao volta: ela entra e fica cifrada, e
                            devolve-la faria um vazamento de sessao virar
                            vazamento de credencial paga.
                          */}
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: "var(--text-xs)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {PROVEDORES.find((x) => x.valor === p.provedor)?.rotulo ?? p.provedor}
                            {" · "}
                            {p.modelo}
                            {p.chaveFinal && ` · ····${p.chaveFinal}`}
                          </div>
                        </div>
                      </div>
                    </Td>

                    {/*
                      Quantos numeros dependem desta chave.

                      ⚠️ Vale mais que a antiga marca de principal: desligar ou
                      remover uma chave em uso deixa aqueles numeros sem
                      atendimento automatico, e nao ha reserva para assumir.
                      Zero avisa o contrario, que e chave cadastrada e parada.
                    */}
                    <Td>
                      {p.emUso === 0 ? (
                        <span style={{ color: "var(--text-tertiary)" }}>nenhum</span>
                      ) : (
                        `${p.emUso} ${p.emUso === 1 ? "número" : "números"}`
                      )}
                    </Td>

                    <Td>
                      {!p.temChave ? (
                        <Badge tom="danger">falta a chave</Badge>
                      ) : (
                        <ActiveToggle active={p.ativo} onChange={() => void alternarAtivo(p)} />
                      )}
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                        </BotaoDeAcao>
                        <BotaoDeAcao rotulo="Remover" onClick={() => void remover(p.id)}>
                          <path d="M3.4 4.6h9.2M6.4 4.6V3.4h3.2v1.2M5 4.6l.5 8.4h5l.5-8.4" />
                        </BotaoDeAcao>
                      </AcoesDaLinha>
                    </Td>
                  </Tr>
                ))
              )}
          </tbody>
        </TableArea>


      {(provedores?.length ?? 0) > POR_PAGINA && (


        <Pagination


          page={paginaAtual}


          totalPages={totalPaginas}


          total={provedores?.length ?? 0}


          pageSize={POR_PAGINA}


          onPage={setPagina}


        />


      )}

      <PrecisaDeAjuda
        duvidas={[
          {
            pergunta: "O bot não está respondendo",
            resposta:
              "São três coisas, nesta ordem: existe provedor ativo com chave? O número que recebeu a mensagem está com responder a todos ligado, ou com aquele contato na lista? E alguém da equipe respondeu à mão nas últimas duas horas, o que cala o bot de propósito?",
          },
          {
            pergunta: "Para que serve mais de uma chave?",
            resposta:
              "Para separar a conta. Cada número usa a chave que você escolher, então o setor que mais atende aparece como o que mais gasta. Como não há troca automática, um número só responde enquanto a chave dele estiver ativa e com cota.",
          },
          {
            pergunta: "Onde pego a chave do Gemini?",
            resposta:
              "No Google AI Studio, com a conta que vai pagar o uso. A chave fica cifrada aqui e nunca volta para a tela.",
            href: "https://aistudio.google.com/apikey",
            rotuloDoLink: "Abrir o AI Studio",
          },
          {
            pergunta: "Quanto isso custa?",
            resposta:
              "A cobrança é do provedor, por mensagem processada, e triagem é o trabalho mais barato que existe: mensagem curta, resposta curta. Por isso o modelo sugerido é o mais leve de cada um.",
          },
        ]}
      />
    </>
  );
}

/**
 * A marca de cada provedor, desenhada.
 *
 * ⚠️ SVG inline e monocromatico, em `currentColor`. Logo de terceiro como
 * imagem exigiria hospedar o arquivo, acompanhar quando eles trocam, e ainda
 * assim quebraria o tema escuro. Aqui e uma marca simplificada, o suficiente
 * para o olho achar a linha certa na tabela.
 */
function IconeDoProvedor({ provedor }: { provedor: string }) {
  const comum = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    style: { flexShrink: 0, color: "var(--text-secondary)" },
  } as const;

  if (provedor === "gemini") {
    // A faisca de quatro pontas.
    return (
      <svg {...comum} fill="currentColor" aria-hidden>
        <path d="M12 2c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8z" />
      </svg>
    );
  }

  if (provedor === "anthropic") {
    // O raio de traços que a Anthropic usa.
    return (
      <svg {...comum} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
        <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      </svg>
    );
  }

  if (provedor === "deepseek") {
    // A baleia, reduzida ao corpo e ao olho.
    return (
      <svg {...comum} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 13c3.5-4 8-5.5 12-4.5L21 6l-1.5 4.5c1 3.5-1.5 7-5.5 7.5-4 .5-8-1.5-11-5z" />
        <circle cx="14.5" cy="11" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // OpenAI: o no hexagonal, simplificado em duas voltas.
  return (
    <svg {...comum} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" />
      <path d="M12 7.5l3.9 2.25v4.5L12 16.5l-3.9-2.25v-4.5z" />
    </svg>
  );
}

/** Cadastro de um provedor. A chave e de mao unica: entra, nunca volta. */
function FormularioDoProvedor({
  config,
  existentes,
  onFechar,
  onSalvou,
}: {
  config: ConfigIA;
  existentes: ConfigIA[];
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState(config);
  const [chave, setChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);

  // Já cadastrada significa que há chave no vault: em branco mantém, não apaga.
  const jaTemChave = existentes.some((p) => p.id === rascunho.id && p.temChave);

  async function testar(): Promise<ResultadoDoTeste> {
    const r = await fetch("/api/v1/ia/provedores/teste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id || null,
        provedor: rascunho.provedor,
        modelo: rascunho.modelo.trim(),
        chave: chave.trim() || null,
      }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      /*
       * Falha NOSSA nao vira reprovacao da chave.
       *
       * Sessao expirada e erro de rota dizem respeito ao nosso servidor, e nao
       * ao que foi digitado. Marcada como definitiva, ela travaria o cadastro
       * por um motivo que nao tem nada a ver com o provedor.
       */
      return {
        ok: false,
        definitivo: false,
        mensagem: corpo?.error?.message ?? "Não foi possível testar agora.",
        detalhe: null,
      };
    }

    return corpo.data as ResultadoDoTeste;
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id || null,
        nome: rascunho.nome.trim(),
        provedor: rascunho.provedor,
        modelo: rascunho.modelo.trim(),
        ativo: rascunho.ativo,
        chave: chave.trim() || null,
      }),
    });

    setSalvando(false);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = corpo?.error?.details?.[0];
      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível salvar"),
      );
      return;
    }

    avisar("sucesso", "Provedor salvo.");
    onSalvou();
  }

  const sugestoes = MODELOS_POR_PROVEDOR[rascunho.provedor] ?? [];

  const erros = problemas(rascunho, chave, jaTemChave, teste);

  return (
    <Drawer
      open
      onClose={onFechar}
      /*
       * ⚠️ Sem `subtitle`.
       *
       * "A chave fica cifrada e nunca volta para a tela" e sobre UM campo, e no
       * cabecalho ela se anunciava como se fosse sobre o drawer inteiro. Desceu
       * para a legenda do grupo da credencial, ao lado do campo que ela explica.
       */
      title={jaTemChave ? "Editar provedor" : "Adicionar provedor"}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || erros.length > 0}
            title={erros[0]}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Grupo
          primeiro
          titulo="O provedor"
          legenda="Quem responde e com qual modelo. A lista de modelos é sugestão: a Meta dos provedores muda de nome com frequência, e um modelo novo pode ser digitado direto."
        >
          <Field
            label="Nome"
            required
            hint="Como esta chave aparece na hora de escolher. Ex.: Gemini do suporte."
          >
            <input
              style={inputStyle}
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            />
          </Field>

          <Field label="Provedor">
            <select
              style={selectStyle}
              value={rascunho.provedor}
              onChange={(e) => {
                const provedor = e.target.value as ConfigIA["provedor"];
                const padrao = PROVEDORES.find((p) => p.valor === provedor)?.modeloPadrao ?? "";
                /*
                 * Troca o modelo junto: `gpt-5-mini` não existe no Gemini, e
                 * manter o antigo produziria erro só no primeiro atendimento
                 * de verdade.
                 */
                setRascunho({ ...rascunho, provedor, modelo: padrao });
              }}
            >
              {PROVEDORES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Modelo" hint="Escolha da lista ou digite o nome exato.">
            <input
              style={inputStyle}
              list="modelos-sugeridos"
              value={rascunho.modelo}
              onChange={(e) => setRascunho({ ...rascunho, modelo: e.target.value })}
            />
            <datalist id="modelos-sugeridos">
              {sugestoes.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </datalist>
          </Field>
        </Grupo>

        <Grupo
          titulo="Credencial"
          legenda="A chave fica cifrada e nunca volta para a tela: ao editar, o campo aparece vazio e em branco significa manter a que já está lá, não apagar."
        >
          <Field
            label="Chave da API"
            required={!jaTemChave}
            hint={CHAVES[rascunho.provedor]}
          >
            <CampoSecreto
              valor={chave}
              placeholder={jaTemChave ? "Deixe em branco para manter" : "cole a chave"}
              onMudar={setChave}
            />
          </Field>
        </Grupo>

        <TesteDeConexao
          titulo="Confirmar antes de salvar"
          legenda="Nem a chave nem o nome do modelo dão para conferir por formato, então o jeito de saber é perguntar ao provedor. É uma chamada mínima, de fração de centavo."
          /*
           * Trocou qualquer campo que o teste usa, o resultado antigo some.
           * A chave entra pelo tamanho, e não pelo conteúdo: ela não precisa
           * circular por aqui para dizer que mudou.
           */
          assinatura={`${rascunho.provedor}|${rascunho.modelo.trim()}|${chave.trim().length}`}
          bloqueio={
            rascunho.modelo.trim().length < 3
              ? "Escolha o modelo primeiro"
              : !jaTemChave && chave.trim().length < 20
                ? "Cole a chave primeiro"
                : null
          }
          aoTestar={testar}
          onResultado={setTeste}
        />

        <Grupo
          titulo="Quando usar"
          legenda="Quem responde com esta chave é decidido em cada número, na aba Números."
        >
          <Field
            label="Ativo"
            hint="Desligada, os números que usam esta chave param de responder sozinhos."
          >
            <ActiveToggle
              active={rascunho.ativo}
              onChange={() => setRascunho({ ...rascunho, ativo: !rascunho.ativo })}
            />
          </Field>
        </Grupo>
      </div>
    </Drawer>
  );
}

/** Onde cada provedor entrega a chave. A duvida acontece com o campo na frente. */
const CHAVES: Record<string, string> = {
  gemini: "Google AI Studio, com a conta que vai pagar o uso.",
  openai: "platform.openai.com, em API keys.",
  anthropic: "console.anthropic.com, em API keys.",
  deepseek: "platform.deepseek.com, em API keys.",
};

/**
 * Tudo que impede o salvar, na ordem do formulario.
 *
 * ⚠️ Uma lista so, e nao condicoes espalhadas pelo botao: a MESMA lista vira o
 * motivo mostrado no botao desabilitado. Botao cinza sem explicacao e o jeito
 * mais rapido de fazer alguem desistir do cadastro.
 */
function problemas(
  r: ConfigIA,
  chave: string,
  jaTemChave: boolean,
  teste: ResultadoDoTeste | null,
): string[] {
  const erros: string[] = [];

  if (r.nome.trim().length < 2) erros.push("Dê um nome a esta chave");

  if (r.modelo.trim().length < 3) erros.push("Escolha ou digite o modelo");

  /*
   * Chave so e exigida no cadastro NOVO. Editando, vazio significa "mantem a
   * que esta no vault" — e por isso a tela nunca a recebeu de volta.
   */
  if (!jaTemChave && chave.trim().length < 20) {
    erros.push("Cole a chave da API deste provedor");
  }

  /*
   * ⚠️ So falha DEFINITIVA barra. Chave recusada e modelo inexistente nao vao
   * funcionar nunca, e deixar gravar cria um cadastro que so vai se revelar
   * quebrado num cliente sem resposta. Ja provedor fora do ar nao diz nada
   * sobre o que foi digitado, e barrar ali impediria a pessoa de arrumar a
   * propria configuracao justamente no dia em que ela precisa.
   */
  if (teste && !teste.ok && teste.definitivo) erros.push(teste.mensagem);

  /*
   * Cadastro NOVO exige ter testado. Editar, nao.
   *
   * Sem isto o teste vira enfeite: quem esta com pressa ignora e o erro volta
   * a aparecer so no primeiro atendimento. Na edicao a exigencia atrapalharia
   * mais do que ajuda, porque trocar o apelido nao mexe na credencial.
   */
  if (!jaTemChave && teste == null) erros.push("Teste a conexão antes de salvar");

  return erros;
}

/** O mesmo agrupador da aba de números: título, legenda e os campos. */
function Grupo({
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
      <CabecalhoDeSecao titulo={titulo} legenda={legenda} primeiro={primeiro} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{children}</div>
    </section>
  );
}
