"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import {
  AtendimentoAutomatico,
  Personas,
  type Setor,
} from "@/components/whatsapp/atendimento-automatico";
import type { ConfigIA } from "@/modules/ia/ia.types";
import type { Persona } from "@/modules/atendimento/personas.types";
import {
  AcoesDaLinha,
  ActiveToggle,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  CabecalhoDeSecao,
  Pagination,
  TableArea,
  PanelTabs,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import {
  digitosDoTelefone,
  formatarTelefone,
  mascararTelefone,
  paraFormatoMeta,
  type ContaWhatsapp,
  type Modelo,
} from "@/modules/whatsapp/whatsapp.types";

/**
 * Configuracao dos numeros de WhatsApp da empresa.
 *
 * Montado sobre o `Drawer` do kit, e nao com um `aside` proprio: largura,
 * cabecalho, raio e animacao passam a ser os do sistema por CONSTRUCAO. A
 * versao anterior repetia esses valores a mao e saia do padrao a cada ajuste.
 *
 * ⚠️ Token e App Secret sao de MAO UNICA: entram, nunca voltam. Vivem no
 * `supabase_vault` e a API devolve so `temToken` / `temAppSecret`. Por isso os
 * campos ficam vazios ao editar, avisando que em branco significa "mantem o que
 * ja esta la", e nao "apaga".
 */

const URL_WEBHOOK = "/api/v1/whatsapp/webhook";
const POR_PAGINA = 8;

type Rascunho = {
  id: number | null;
  apelido: string;
  numero: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersao: string;
  verifyToken: string;
  token: string;
  appSecret: string;
  botRespondeTodos: boolean;
  botNumeros: string;
};

function vazio(): Rascunho {
  return {
    id: null,
    apelido: "",
    numero: "",
    phoneNumberId: "",
    wabaId: "",
    apiVersao: "v19.0",
    // Sugerido, nao imposto: e o texto que a pessoa vai colar no painel da Meta,
    // e ter um pronto evita a pergunta "o que eu ponho aqui?".
    verifyToken: `vpay-${Math.random().toString(36).slice(2, 10)}`,
    token: "",
    appSecret: "",
    /*
     * ⚠️ Nasce FECHADO. Numero novo que ja saisse respondendo a todo mundo
     * faria o primeiro cliente real ser cobaia de uma configuracao que ninguem
     * conferiu ainda.
     */
    botRespondeTodos: false,
    botNumeros: "",
  };
}

function daConta(c: ContaWhatsapp): Rascunho {
  return {
    id: c.id,
    apelido: c.apelido ?? "",
    numero: c.numero ?? "",
    phoneNumberId: c.phoneNumberId,
    wabaId: c.wabaId ?? "",
    apiVersao: c.apiVersao,
    verifyToken: c.verifyToken ?? "",
    token: "",
    appSecret: "",
    botRespondeTodos: c.botRespondeTodos,
    botNumeros: c.botNumeros ?? "",
  };
}

export function ConfiguracaoDeContas({
  contas,
  onFechar,
  onMudou,
}: {
  contas: ContaWhatsapp[];
  onFechar: () => void;
  onMudou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);

  /*
   * Os modelos ja lidos da Meta, por conta.
   *
   * Vive AQUI e nao na aba porque a aba desmonta ao trocar de guia, e este
   * dado custa uma chamada externa. Zera quando o painel fecha, que e a hora
   * em que faz sentido perguntar de novo.
   */
  const [modelosPorConta, setModelosPorConta] = useState<Record<number, Modelo[]>>({});

  const guardarModelos = useCallback((contaId: number, lista: Modelo[]) => {
    setModelosPorConta((atual) => ({ ...atual, [contaId]: lista }));
  }, []);

  /*
   * Provedores, personas e setores tambem moram AQUI.
   *
   * As abas montam e desmontam a cada troca de guia: com o estado dentro delas,
   * voltar mostrava "carregando" e refazia a consulta de um dado ja lido. Aqui
   * eles sobrevivem enquanto o painel estiver aberto, e so sao relidos quando
   * alguem salva.
   */
  const [provedores, setProvedores] = useState<ConfigIA[] | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);

  const carregarProvedores = useCallback(async () => {
    const r = await fetch("/api/v1/ia/config");
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      // Falha APARECE: silenciada, a lista vazia diria "não há provedor", que
      // e outra coisa. Ja custou uma aba em branco sem explicacao nenhuma.
      const detalhe = corpo?.error?.details?.[0];
      setErroIA(
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível carregar"),
      );
      setProvedores([]);
      return;
    }

    setErroIA(null);
    setProvedores(corpo.data ?? []);
  }, []);

  const carregarPersonas = useCallback(async () => {
    const [rp, rs] = await Promise.all([
      fetch("/api/v1/atendimento/personas"),
      fetch("/api/v1/atendimento/setores"),
    ]);

    const cp = await rp.json().catch(() => null);
    setPersonas(rp.ok ? (cp?.data ?? []) : []);

    // Setor e opcional na persona, entao falhar aqui nao impede cadastrar: a
    // lista fica vazia e a persona nasce geral.
    const cs = await rs.json().catch(() => null);
    setSetores(rs.ok ? (cs?.data ?? []) : []);
  }, []);


  /*
   * Abas, e nao uma secao no fim da lista.
   *
   * O atendimento automatico estava abaixo da tabela de numeros, entao so era
   * encontrado por quem rolasse ate o fim de uma tela cujo assunto principal e
   * outro. Sao duas configuracoes distintas do mesmo lugar: cada uma merece um
   * nome visivel na entrada.
   */
  const [aba, setAba] = useState<
    "Números" | "Modelos" | "Automação" | "Personas"
  >("Números");

  // Carrega ao ENTRAR na aba, e so na primeira vez.
  useEffect(() => {
    if (aba === "Automação" && provedores == null) {
      const t = setTimeout(() => void carregarProvedores(), 0);
      return () => clearTimeout(t);
    }

    if (aba === "Personas" && personas == null) {
      const t = setTimeout(() => void carregarPersonas(), 0);
      return () => clearTimeout(t);
    }
  }, [aba, provedores, personas, carregarProvedores, carregarPersonas]);

  const filtradas = useMemo(() => {
    return contas;
  }, [contas]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  async function salvar() {
    if (!rascunho || salvando) return;

    setSalvando(true);

    const r = await fetch("/api/v1/whatsapp/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id,
        apelido: rascunho.apelido.trim() || null,
        // `paraFormatoMeta` completa o DDI quando falta, decidindo por
        // comprimento. A mascara nunca chega aqui: o estado ja guarda digitos.
        numero: rascunho.numero ? paraFormatoMeta(rascunho.numero) : null,
        phoneNumberId: rascunho.phoneNumberId.trim(),
        wabaId: rascunho.wabaId.trim() || null,
        apiVersao: rascunho.apiVersao.trim() || "v19.0",
        verifyToken: rascunho.verifyToken.trim() || null,
        // Em branco NAO apaga: o servidor le ausente como "mantem o do vault".
        token: rascunho.token.trim() || null,
        appSecret: rascunho.appSecret.trim() || null,
        botRespondeTodos: rascunho.botRespondeTodos,
        botNumeros: rascunho.botNumeros.trim() || null,
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
          : (corpo?.error?.message ?? "Não foi possível salvar o número"),
      );
      return;
    }

    avisar("sucesso", "Número salvo.");
    setRascunho(null);
    onMudou();
  }

  async function alternarAtivo(conta: ContaWhatsapp) {
    const r = await fetch(`/api/v1/whatsapp/contas/${conta.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !conta.ativo }),
    });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível mudar o número");
      return;
    }

    onMudou();
  }

  if (rascunho) {
    return (
      <Drawer
        open
        onClose={() => setRascunho(null)}
        title={rascunho.id ? "Editar número" : "Cadastrar número"}
        /*
         * Sem `width`: fica no padrao do `Drawer` (620), o mesmo de conta a
         * receber e de ticket. Os 540 de `FormDrawer` sao para cadastro de tres
         * campos; aqui a largura tem de casar com a da listagem, senao o painel
         * encolhe ao entrar na edicao.
         *
         * No rodape so "Salvar": o X do cabecalho ja sai sem gravar, e um
         * "Cancelar" ao lado seria um segundo botao para o mesmo gesto.
         */
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void salvar()}
              disabled={
                salvando ||
                rascunho.phoneNumberId.trim().length < 5 ||
                // Fechado e sem lista, o bot nao falaria com ninguem: em vez de
                // salvar um estado inutil, o botao explica pelo proprio bloqueio.
                (!rascunho.botRespondeTodos && rascunho.botNumeros.trim().length === 0)
              }
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        }
      >
        <Formulario rascunho={rascunho} onMudar={setRascunho} />
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      title="Configuração do WhatsApp"
      subtitle="Números da empresa e atendimento automático"
    >
      {/*
        Quatro nomes CURTOS. "Atendimento automático" sozinho ocupava metade da
        barra e empurrava os outros, e a aba mais usada e a primeira.
      */}
      <PanelTabs
        tabs={["Números", "Modelos", "Automação", "Personas"]}
        active={aba}
        onChange={(t) => setAba(t as typeof aba)}
      />

      {aba === "Modelos" ? (
        <ModelosAprovados
          contas={contas}
          cache={modelosPorConta}
          onCarregou={guardarModelos}
        />
      ) : aba === "Automação" ? (
        <AtendimentoAutomatico
          provedores={provedores}
          erro={erroIA}
          onRecarregar={() => void carregarProvedores()}
        />
      ) : aba === "Personas" ? (
        <Personas
          contas={contas}
          personas={personas}
          setores={setores}
          onRecarregar={() => void carregarPersonas()}
        />
      ) : (
        <>
      <CabecalhoDeSecao
        titulo="Seus números de WhatsApp"
        legenda="Cada número tem caixa de entrada própria e decide sozinho se o atendimento automático responde a todo mundo ou só a uma lista. É aqui que ficam o token e a chave que a Meta exige para enviar e receber."
        onIncluir={() => setRascunho(vazio())}
        rotuloIncluir="Cadastrar número"
      />


        <TableArea minWidth={0}>
          <TableHead>
            <Th>Apelido</Th>
            <Th>Número</Th>
            <Th>Situação</Th>
            <Th align="right">Ações</Th>
          </TableHead>

          <tbody>
            {visiveis.length === 0 ? (
              <EmptyRow colSpan={4} message="Nenhum número cadastrado ainda." />
            ) : (
              visiveis.map((c, i) => (
                <Tr key={c.id} delay={i * 18} dimmed={!c.ativo}>
                  <Td>{c.apelido?.trim() || "—"}</Td>
                  <Td>{c.numero ? formatarTelefone(c.numero) : "—"}</Td>
                  <Td>
                    <Situacao conta={c} onAlternar={() => void alternarAtivo(c)} />
                  </Td>
                  <Td>
                    <AcoesDaLinha>
                      <BotaoDeAcao rotulo="Editar" onClick={() => setRascunho(daConta(c))}>
                        <path d="M11.5 2.5a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5 8.5-8z" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableArea>

        <Pagination
          page={paginaAtual}
          totalPages={totalPaginas}
          total={filtradas.length}
          pageSize={POR_PAGINA}
          onPage={setPagina}
        />
        </>
      )}
    </Drawer>
  );
}

/**
 * Chave e modelo do provedor de IA da empresa.
 *
 * Fica junto dos numeros, e nao numa tela propria, porque e a mesma decisao:
 * "como este WhatsApp atende". Separar obrigaria a procurar em dois lugares para
 * ligar uma coisa so.
 *
 * ⚠️ A chave e de MAO UNICA. Entra, nunca volta — a API devolve apenas se
 * existe. Por isso o campo aparece vazio quando ja ha uma, com o aviso de que em
 * branco mantem, e nao apaga.
 */
/**
 * Os modelos que a Meta ja aprovou, por numero.
 *
 * ⚠️ Lidos da Meta a cada abertura, sem copia local. O status muda no painel
 * dela e sem aviso: um modelo aprovado ontem volta para revisao quando alguem
 * o edita, e uma copia nossa mostraria "aprovado" ate alguem reparar no erro
 * de envio.
 */
function ModelosAprovados({
  contas,
  cache,
  onCarregou,
}: {
  contas: ContaWhatsapp[];
  /** Ja lidos da Meta nesta abertura do painel, por conta. */
  cache: Record<number, Modelo[]>;
  onCarregou: (contaId: number, modelos: Modelo[]) => void;
}) {
  const ativas = useMemo(() => contas.filter((c) => c.ativo && c.temToken), [contas]);
  const [contaId, setContaId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  /** O UNICO cartao de previa da tela. Nulo enquanto o mouse nao chega. */
  const [espiando, setEspiando] = useState<Espiada | null>(null);

  const escolhida = contaId ?? ativas[0]?.id ?? null;
  const todos = escolhida == null ? null : (cache[escolhida] ?? null);

  const totalPaginas = Math.max(1, Math.ceil((todos?.length ?? 0) / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const modelos =
    todos?.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA) ?? null;

  useEffect(() => {
    /*
     * ⚠️ Ja lido nesta abertura, nao pergunta de novo.
     *
     * Esta consulta sai para a META, nao para o nosso banco, e o componente
     * monta e desmonta a cada troca de aba: sem o cache, ir e voltar entre
     * "Modelos" e "Números" gastava uma chamada externa por vez. Num SaaS isso
     * multiplica por usuario e por sessao.
     */
    if (escolhida == null || cache[escolhida]) return;

    const controle = new AbortController();

    /*
     * Adiado por um tique: limpar a lista de forma sincrona dentro do efeito
     * encadeia um render extra so para mostrar "carregando" por um quadro.
     */
    const t = setTimeout(() => setErro(null), 0);

    fetch(`/api/v1/whatsapp/modelos?contaId=${escolhida}`, { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);
        if (!r.ok) throw new Error(corpo?.error?.message ?? "Não foi possível ler os modelos");
        onCarregou(escolhida, corpo.data ?? []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Falha aparece: silenciada, a lista vazia mentiria dizendo que a
        // empresa nao tem modelo nenhum.
        setErro(e instanceof Error ? e.message : "Não foi possível ler os modelos");
        onCarregou(escolhida, []);
      });

    return () => {
      clearTimeout(t);
      controle.abort();
    };
    /*
     * ⚠️ `escolhida` e a UNICA dependencia, de proposito.
     *
     * Esta consulta sai para a Meta, nao para o nosso banco: trocar de aba e
     * voltar disparava uma chamada externa a cada vez. O componente monta e
     * desmonta com a aba, entao o cache vive um nivel acima, em `modelosPorConta`.
     */
  }, [escolhida, cache, onCarregou]);

  if (ativas.length === 0) {
    return (
      <EmptyRow
        colSpan={1}
        message="Cadastre um número ativo com token para ver os modelos aprovados."
      />
    );
  }

  return (
    <>
      <CabecalhoDeSecao
        titulo="Modelos aprovados"
        legenda="Lidos da Meta agora, porque o status muda lá sem aviso. Só modelo aprovado pode ser enviado, e é ele que permite falar com quem não escreve há mais de 24 horas. Para criar ou editar, use o painel da Meta."
      />

      {ativas.length > 1 && (
        <select
          value={escolhida ?? ""}
          onChange={(e) => setContaId(Number(e.target.value))}
          style={{ ...selectStyle, marginBottom: 12 }}
        >
          {ativas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.apelido || formatarTelefone(c.numero ?? "")}
            </option>
          ))}
        </select>
      )}


      {erro && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--danger)", marginBottom: 12 }}>
          {erro}
        </p>
      )}

        <TableArea minWidth={0}>
          <TableHead>
            <Th>Nome</Th>
            <Th>Categoria</Th>
            <Th>Idioma</Th>
            <Th>Variáveis</Th>
          </TableHead>

          <tbody>
            {modelos == null ? (
              <EmptyRow colSpan={4} message="Carregando…" />
            ) : modelos.length === 0 ? (
              <EmptyRow colSpan={4} message="Nenhum modelo aprovado neste número." />
            ) : (
              modelos.map((m) => (
                <Tr key={`${m.nome}-${m.idioma}`}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontWeight: "var(--fw-semi)" }}>{m.nome}</span>

                      {/*
                        O corpo atras de um olho, e nao desenhado em toda linha.

                        Vinte modelos eram vinte bolhas montadas de uma vez, com
                        o negrito reprocessado em cada uma, para ler no maximo
                        uma. Aqui existe UM cartao, montado quando o mouse chega.
                      */}
                      <BotaoDeEspiar corpo={m.corpo} nome={m.nome} onEspiar={setEspiando} />
                    </div>
                  </Td>
                  <Td>{m.categoria.toLowerCase()}</Td>
                  <Td>{m.idioma}</Td>
                  <Td>{m.parametros}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableArea>

        <Pagination
          page={paginaAtual}
          totalPages={totalPaginas}
          total={todos?.length ?? 0}
          pageSize={POR_PAGINA}
          onPage={setPagina}
        />

        {espiando && <PreviaDoModelo espiada={espiando} />}
    </>
  );
}

/** Onde e o que mostrar na previa. */
type Espiada = { corpo: string; x: number; y: number };

function BotaoDeEspiar({
  corpo,
  nome,
  onEspiar,
}: {
  corpo: string;
  nome: string;
  onEspiar: (e: Espiada | null) => void;
}) {
  // A posicao sai do proprio botao no momento do gesto: guardada antes, ela
  // apontaria para onde a linha estava antes de rolar a tabela.
  const mostrar = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    onEspiar({ corpo, x: r.right + 10, y: r.top });
  };

  return (
    <button
      type="button"
      aria-label={`Ver a mensagem de ${nome}`}
      title="Ver a mensagem"
      onMouseEnter={(e) => mostrar(e.currentTarget)}
      onMouseLeave={() => onEspiar(null)}
      // Foco tambem abre: quem navega por teclado nao tem mouse para passar.
      onFocus={(e) => mostrar(e.currentTarget)}
      onBlur={() => onEspiar(null)}
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        display: "grid",
        placeItems: "center",
        border: "none",
        borderRadius: "50%",
        background: "var(--surface-hover)",
        color: "var(--text-tertiary)",
        cursor: "pointer",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.8 12S5.5 5.5 12 5.5 22.2 12 22.2 12 18.5 18.5 12 18.5 1.8 12 1.8 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

/**
 * A mensagem como o cliente vai receber.
 *
 * ⚠️ `position: fixed` e um so na tela. Dentro da celula ele seria recortado
 * pelo `overflow` da area rolavel, e um por linha significaria montar vinte
 * bolhas com o negrito reprocessado para ler no maximo uma.
 */
function PreviaDoModelo({ espiada }: { espiada: Espiada }) {
  return (
    <div
      style={{
        position: "fixed",
        left: espiada.x,
        top: espiada.y,
        zIndex: 500,
        maxWidth: 320,
        padding: 10,
        /*
         * O fundo de CONVERSA em volta da bolha.
         *
         * A bolha sozinha usa `primary-subtle`, que e translucido: solta sobre
         * o branco da tela ela sumia. Aqui ela ganha o bege de fundo de chat
         * por tras, que e o que a recorta e o que faz a previa parecer o
         * WhatsApp em vez de um balao perdido.
         */
        borderRadius: "var(--radius-lg)",
        background: "var(--fundo-conversa)",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "7px 10px",
          borderRadius:
            "var(--radius-lg) var(--radius-lg) var(--radius-xs) var(--radius-lg)",
          // O MESMO da bolha enviada no painel. O verde de WhatsApp que eu
          // tinha posto nao existe em lugar nenhum do sistema.
          background: "var(--primary-subtle)",
          boxShadow: "var(--shadow-xs)",
          fontSize: "var(--text-sm)",
          color: "var(--text-primary)",
          lineHeight: "var(--lh-normal)",
          whiteSpace: "pre-wrap",
        }}
      >
        {comFormatacaoDoWhatsapp(espiada.corpo)}
      </div>
    </div>
  );
}


/**
 * Situacao do numero: o proprio interruptor.
 *
 * Ligado ou desligado ja se le na posicao dele, entao um rotulo ao lado seria a
 * mesma informacao duas vezes. Ligar e desligar tambem se faz aqui, e nao num
 * botao separado na ponta da linha.
 *
 * ⚠️ O aviso de credencial FICA. Ele nao e o mesmo estado: um numero pode estar
 * ligado e mesmo assim nao enviar nem receber, por faltar token ou chave. Sem
 * este sinal, a pessoa so descobriria no primeiro erro.
 */
function Situacao({
  conta,
  onAlternar,
}: {
  conta: ContaWhatsapp;
  onAlternar: () => void;
}) {
  const semCredencial = !conta.temToken || !conta.temAppSecret;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <ActiveToggle active={conta.ativo} onChange={onAlternar} />

      {semCredencial && (
        <span
          title="Falta o token ou a chave secreta. Este número não envia nem recebe."
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 15,
            height: 15,
            flexShrink: 0,
            borderRadius: "var(--radius-full)",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning-border)",
            color: "var(--warning-text)",
            fontSize: 10,
            fontWeight: "var(--fw-semi)",
            lineHeight: 1,
            cursor: "help",
          }}
        >
          !
        </span>
      )}
    </span>
  );
}

function Formulario({
  rascunho,
  onMudar,
}: {
  rascunho: Rascunho;
  onMudar: (r: Rascunho) => void;
}) {
  const mudar =
    (campo: keyof Rascunho) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onMudar({ ...rascunho, [campo]: e.target.value });

  const editando = rascunho.id != null;
  const marcador = editando ? "Deixe em branco para manter o atual" : "";

  return (
    /*
     * gap 3, e nao os 8 do `FormDrawer`.
     *
     * Desvio consciente do padrao: os formularios do sistema tem tres ou quatro
     * campos, e ali o respiro de 8 separa. Aqui sao oito campos seguidos, todos
     * do mesmo assunto, e o mesmo respiro os desmancha numa lista de itens
     * soltos. O `Field` ja reserva 28px de altura por linha, entao o que separa
     * uma da outra e a propria linha, nao o vao.
     */
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Field label="Apelido" hint="Como este número aparece no seletor. Ex.: Financeiro.">
        <input style={inputStyle} value={rascunho.apelido} onChange={mudar("apelido")} />
      </Field>

      {/*
        A trava mora AQUI, e nao na tela de IA.
        
        Quem atende e o numero, e a pergunta "esse aqui responde sozinho?" so
        faz sentido olhando para ele. Solta na configuracao da IA, ela valia
        para a empresa inteira e ninguem entendia o que fazia.
      */}
      <Field
        label="Responde a todos"
        hint={
          rascunho.botRespondeTodos
            ? "O atendimento automático fala com qualquer contato deste número."
            : "Desligado, só os números listados abaixo recebem resposta automática."
        }
      >
        <ActiveToggle
          active={rascunho.botRespondeTodos}
          onChange={() =>
            onMudar({ ...rascunho, botRespondeTodos: !rascunho.botRespondeTodos })
          }
        />
      </Field>

      {!rascunho.botRespondeTodos && (
        <Field
          label="Só estes números"
          required
          hint="Um por linha. Vazio, o bot não responde a ninguém neste número."
        >
          <textarea
            style={{ ...textareaStyle, minHeight: 58 }}
            placeholder={"+55 (35) 99999-9999\n+55 (35) 98888-8888"}
            value={rascunho.botNumeros}
            onChange={(e) => onMudar({ ...rascunho, botNumeros: e.target.value })}
          />
        </Field>
      )}

      <Field label="Número" hint="Com DDD. O DDI 55 entra sozinho se faltar.">
        <input
          style={inputStyle}
          inputMode="tel"
          // Zeros e nao um numero plausivel: assim a dica se le como FORMATO. Um
          // exemplo verossimil parece dado de verdade, e o que estava ali era o
          // proprio numero da empresa.
          placeholder="+55 (00) 00000-0000"
          // Exibe mascarado, guarda so digitos: mascara em coluna de banco vira
          // dois formatos para a mesma coisa, que e o que ja atrapalha o
          // casamento com `clientes.contato`.
          value={mascararTelefone(rascunho.numero)}
          onChange={(e) =>
            onMudar({ ...rascunho, numero: digitosDoTelefone(e.target.value) })
          }
        />
      </Field>

      <Field
        label="Identificação"
        required
        hint="Meta, WhatsApp, Configuração da API. Campo Phone number ID."
      >
        <input
          style={inputStyle}
          value={rascunho.phoneNumberId}
          onChange={mudar("phoneNumberId")}
        />
      </Field>

      <Field
        label="Conta (WABA)"
        hint="Na mesma tela da Meta. Sem ela não dá para listar os modelos aprovados."
      >
        <input style={inputStyle} value={rascunho.wabaId} onChange={mudar("wabaId")} />
      </Field>

      <Field
        label="Versão da API"
        hint="A Meta descontinua versão por data. Trocar aqui não exige deploy."
      >
        <input style={inputStyle} value={rascunho.apiVersao} onChange={mudar("apiVersao")} />
      </Field>

      <Field
        label="Token de acesso"
        required={!editando}
        hint="Use um token de Usuário do sistema, no Business Manager. O do API Setup expira em 24 horas."
      >
        <input
          style={inputStyle}
          type="password"
          autoComplete="off"
          placeholder={marcador}
          value={rascunho.token}
          onChange={mudar("token")}
        />
      </Field>

      <Field
        label="Chave secreta"
        required={!editando}
        hint="Meta, Configurações do app, aba Básico. É ela que prova que o webhook veio da Meta."
      >
        <input
          style={inputStyle}
          type="password"
          autoComplete="off"
          placeholder={marcador}
          value={rascunho.appSecret}
          onChange={mudar("appSecret")}
        />
      </Field>

      <Field label="Verificar token" hint="Invente um texto e cole o MESMO no webhook da Meta.">
        <input style={inputStyle} value={rascunho.verifyToken} onChange={mudar("verifyToken")} />
      </Field>

      <UrlDeCallback />
      <ComoConectar />
    </div>
  );
}

/**
 * A URL que a pessoa cola no painel da Meta.
 *
 * Em verde de marca e nao em cinza: no meio de oito campos que a pessoa
 * PREENCHE, este e o unico bloco que ela COPIA. A cor separa as duas coisas sem
 * precisar de um titulo explicando.
 */
function UrlDeCallback() {
  const [copiada, setCopiada] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}${URL_WEBHOOK}`;

  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--primary-subtle)",
        border: "1px solid var(--primary-border)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--lh-snug)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span className="rotulo" style={{ flex: 1, color: "var(--primary)" }}>
          URL de callback na Meta
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopiada(true);
          }}
          style={{
            border: "1px solid var(--primary-border)",
            background: "var(--surface)",
            color: "var(--primary)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--fw-semi)",
            padding: "3px 8px",
            cursor: "pointer",
          }}
        >
          {copiada ? "Copiada" : "Copiar"}
        </button>
      </div>

      <code
        style={{
          display: "block",
          fontSize: "var(--text-sm)",
          wordBreak: "break-all",
          color: "var(--text-primary)",
        }}
      >
        {url}
      </code>

      <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
        A mesma URL serve todos os números. Assine o campo <strong>messages</strong>,
        senão a URL verifica e mesmo assim nada chega.
      </div>
    </div>
  );
}

/**
 * Como conectar, em cinco passos.
 *
 * Sem cartao e sem moldura: e texto de apoio, nao dado. Uma linha divisoria
 * entre os itens basta para separa-los, e a primeira e a ultima ficam sem para o
 * bloco nao virar uma caixa por acidente.
 *
 * Minimalista de proposito: cada passo diz onde clicar e leva ao documento da
 * Meta. Reescrever a documentacao deles aqui envelheceria em duas semanas.
 */
function ComoConectar() {
  const passos = [
    {
      titulo: "Criar o app",
      texto: "No painel de apps da Meta, tipo Empresa, com o produto WhatsApp.",
      href: "https://developers.facebook.com/apps",
    },
    {
      titulo: "Pegar as identificações",
      texto: "Em WhatsApp, Configuração da API. Copie o Phone number ID e o da conta.",
      href: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    },
    {
      titulo: "Gerar o token permanente",
      texto: "Em Usuários do sistema, no Business Manager. O do API Setup expira em 24 horas.",
      href: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
    },
    {
      titulo: "Pegar a chave secreta",
      texto: "Em Configurações do app, aba Básico.",
      href: "https://developers.facebook.com/docs/facebook-login/security",
    },
    {
      titulo: "Ligar o webhook",
      texto: "Cole a URL verde acima e o token de verificação, e assine o campo messages.",
      href: "https://developers.facebook.com/docs/graph-api/webhooks/getting-started",
    },
  ];

  return (
    <section style={{ marginTop: 10 }}>
      <div className="rotulo" style={{ marginBottom: 2 }}>
        Como conectar
      </div>

      {passos.map((p, i) => (
        <a
          key={p.titulo}
          href={p.href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            padding: "9px 0",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {/*
            O icone vai no TITULO, e nao num "Ver mais" abaixo: ele ja diz que
            abre fora, e a linha inteira e clicavel. Um link extra so repetiria
            o gesto que o titulo ja oferece.
          */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "var(--text-sm)",
              fontWeight: "var(--fw-semi)",
              color: "var(--primary)",
            }}
          >
            {p.titulo}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M14 4h6v6" />
              <path d="M20 4 10 14" />
              <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
            </svg>
          </span>

          <span
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
              marginTop: 2,
            }}
          >
            {p.texto}
          </span>
        </a>
      ))}
    </section>
  );
}
