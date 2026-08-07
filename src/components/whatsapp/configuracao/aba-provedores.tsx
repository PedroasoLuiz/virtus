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

                    {/*
                      ⚠️ So editar. Excluir mora DENTRO do drawer, no fim.

                      Na linha, ele ficava a um clique de distancia do editar,
                      com o mesmo tamanho e o mesmo cinza — e a linha erra sem
                      dar tempo de ler qual chave era. Dentro do formulario, a
                      chave ja esta aberta e nomeada na frente de quem decide.
                    */}
                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
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
 * assim quebraria o tema escuro.
 *
 * ⚠️ Sao os desenhos OFICIAIS de cada marca, e nao aproximacoes. Um hexagono no
 * lugar do no da OpenAI nao e "simplificado", e outra coisa: quem conhece a
 * marca estranha, e quem nao conhece nao reconhece nada.
 */
function IconeDoProvedor({ provedor }: { provedor: string }) {
  const comum = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    style: { flexShrink: 0, color: "var(--text-secondary)" },
  } as const;

  if (provedor === "gemini") {
    // A faísca de quatro pontas côncavas.
    return (
      <svg {...comum} fill="currentColor" aria-hidden>
        <path d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12" />
      </svg>
    );
  }

  if (provedor === "anthropic") {
    // O "A" vazado da Anthropic.
    return (
      <svg {...comum} fill="currentColor" aria-hidden>
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
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

  // OpenAI: o nó de seis voltas entrelaçadas.
  return (
    <svg {...comum} fill="currentColor" aria-hidden>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
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
  const [excluindo, setExcluindo] = useState(false);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);

    const r = await fetch(`/api/v1/ia/provedores/${rascunho.id}`, { method: "DELETE" });

    setExcluindo(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível excluir");
      return;
    }

    avisar("sucesso", "Chave excluída.");
    onSalvou();
  }

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
      acoes={
        <Button
          size="xs"
          variant="primary"
          onClick={() => void salvar()}
          disabled={salvando || erros.length > 0}
          title={erros[0]}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
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

        {/*
          ⚠️ O teste e o ULTIMO bloco, depois de todos os campos.

          Antes ele ficava no meio e pedia para confirmar antes de a pessoa
          terminar de preencher, o que fazia o resultado zerar em seguida quando
          ela mexia no que vinha depois. Como fecho, ele le como o que e: o
          passo final antes de gravar.
        */}
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

        {/* Chave que nunca foi gravada não tem o que excluir: basta fechar. */}
        {rascunho.id > 0 && (
          <AreaDeExclusao
            nome={rascunho.nome.trim() || "esta chave"}
            emUso={rascunho.emUso}
            onExcluir={excluir}
            excluindo={excluindo}
          />
        )}
      </div>
    </Drawer>
  );
}

/**
 * Excluir, no fim do formulário.
 *
 * ⚠️ Sem fundo e sem borda. Área de perigo emoldurada em vermelho vira um bloco
 * que o olho procura, e a moldura acaba anunciando a ação destrutiva melhor do
 * que o formulário anuncia a construtiva. Aqui é uma linha discreta no fim de
 * tudo: quem procura acha, quem não procura não esbarra.
 *
 * ⚠️ A confirmação abre NO LUGAR, e não num alerta do navegador. O `confirm()`
 * não cabe a frase que importa — quantos números param de responder — e é
 * dispensado no reflexo, que é justamente o que não se quer aqui.
 */
function AreaDeExclusao({
  nome,
  emUso,
  onExcluir,
  excluindo,
}: {
  nome: string;
  emUso: number;
  onExcluir: () => void;
  excluindo: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  return (
    /*
     * Respiro extra em cima: o `gap` do formulário separa um grupo de campos do
     * outro, e aqui a separação é de outra natureza. Excluir não é o próximo
     * campo depois de testar a conexão.
     */
    <section style={{ marginTop: 12 }}>
      {/*
        ⚠️ Fechada por padrão, e essa é a razão de existir.

        Excluir não é o que se vem fazer aqui: o formulário é de cadastro, e a
        ação destrutiva aberta no fim dele fica a um clique de distância de
        salvar. Uma sanfona cobra o gesto de quem realmente quer, e some do
        caminho de quem não quer. Mesma anatomia da sanfona de ajuda.
      */}
      <button
        type="button"
        onClick={() => {
          setAberta((v) => !v);
          setConfirmando(false);
        }}
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

      {aberta && !confirmando && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              fontSize: "var(--text-base)",
              color: "var(--danger-text)",
              cursor: "pointer",
            }}
          >
            Excluir esta chave
          </button>
        </div>
      )}

      {aberta && confirmando && (
        <Confirmacao
          nome={nome}
          emUso={emUso}
          onExcluir={onExcluir}
          onCancelar={() => setConfirmando(false)}
          excluindo={excluindo}
        />
      )}
    </section>
  );
}

function Confirmacao({
  nome,
  emUso,
  onExcluir,
  onCancelar,
  excluindo,
}: {
  nome: string;
  emUso: number;
  onExcluir: () => void;
  onCancelar: () => void;
  excluindo: boolean;
}) {
  return (
    <div style={{ marginTop: 12, color: "var(--danger-text)" }}>
      <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semi)" }}>
        Excluir {nome}?
      </div>

      {/*
        O que ACONTECE, e não "esta ação não pode ser desfeita".

        A contagem é a única frase que muda a decisão: com números usando a
        chave, eles param de responder sozinhos na hora, e ninguém adivinha isso
        de um aviso genérico.
      */}
      <p
        style={{
          marginTop: 4,
          fontSize: "calc(var(--text-xs) + 1px)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        {emUso > 0
          ? `${emUso} ${emUso === 1 ? "número usa" : "números usam"} esta chave e ${emUso === 1 ? "vai" : "vão"} parar de responder sozinhos. A chave some da lista, e o histórico de consumo dela continua guardado.`
          : "A chave some da lista. O histórico de consumo dela continua guardado."}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
        <Button size="sm" variant="danger" onClick={onExcluir} disabled={excluindo}>
          {excluindo ? "Excluindo…" : "Excluir"}
        </Button>

        <button
          type="button"
          onClick={onCancelar}
          disabled={excluindo}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            fontSize: "var(--text-sm)",
            color: "var(--text-tertiary)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
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
   * ⚠️ SEMPRE exige ter testado, cadastro novo ou edicao.
   *
   * Sem isto o teste vira enfeite: quem esta com pressa ignora, e o erro volta
   * a aparecer so no primeiro atendimento, como silencio. Na edicao ele custa
   * um clique a mais para trocar so o nome, e vale: chave revogada e cota
   * estourada acontecem sem ninguem mexer no cadastro, e este e o unico momento
   * em que alguem estava olhando para ela.
   */
  if (teste == null) erros.push("Teste a conexão antes de salvar");

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
