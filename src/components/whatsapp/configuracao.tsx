"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import { MODELOS_SUGERIDOS } from "@/modules/ia/ia.types";
import {
  AcoesDaLinha,
  ActiveToggle,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Field,
  IncluirButton,
  Pagination,
  SearchInput,
  TableArea,
  PanelTabs,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
} from "@/components/ui/kit";
import {
  digitosDoTelefone,
  formatarTelefone,
  mascararTelefone,
  paraFormatoMeta,
  type ContaWhatsapp,
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
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  /*
   * Abas, e nao uma secao no fim da lista.
   *
   * O atendimento automatico estava abaixo da tabela de numeros, entao so era
   * encontrado por quem rolasse ate o fim de uma tela cujo assunto principal e
   * outro. Sao duas configuracoes distintas do mesmo lugar: cada uma merece um
   * nome visivel na entrada.
   */
  const [aba, setAba] = useState<"Números" | "Atendimento automático">("Números");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contas;

    return contas.filter((c) =>
      [c.apelido, c.numero, c.phoneNumberId, c.wabaId]
        .filter(Boolean)
        .some((campo) => campo!.toLowerCase().includes(termo)),
    );
  }, [contas, busca]);

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
              disabled={salvando || rascunho.phoneNumberId.trim().length < 5}
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
      <PanelTabs
        tabs={["Números", "Atendimento automático"]}
        active={aba}
        onChange={(t) => setAba(t as typeof aba)}
      />

      {aba === "Atendimento automático" ? (
        <AtendimentoAutomatico />
      ) : (
        <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SearchInput
          value={busca}
          onSearch={(v) => {
            setBusca(v);
            setPagina(1);
          }}
          placeholder="Buscar apelido, número ou id"
          width="100%"
        />
        <IncluirButton onClick={() => setRascunho(vazio())} rotulo="Cadastrar" />
      </div>

      {/*
        Sem `TableFrame`: o corpo do drawer JA e branco, e cartao branco sobre
        branco nao recorta nada. Fica so a moldura fina.
      */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <TableArea minWidth={480}>
          <TableHead>
            <Th>Apelido</Th>
            <Th>Número</Th>
            <Th>Situação</Th>
            <Th align="right">Ações</Th>
          </TableHead>

          <tbody>
            {visiveis.length === 0 ? (
              <EmptyRow
                colSpan={4}
                message={
                  busca ? "Nenhum número com esse termo." : "Nenhum número cadastrado ainda."
                }
              />
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
      </div>
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
/** Quantos numeros de teste ha no campo, aceitando virgula, ponto e virgula ou linha. */
function contarNumeros(texto: string): number {
  return texto.split(/[,;\n]/).filter((n) => n.trim()).length;
}

function AtendimentoAutomatico() {
  const { avisar } = useAvisos();
  const [config, setConfig] = useState<{
    modelo: string;
    ativo: boolean;
    temChave: boolean;
    numeroTeste: string | null;
  } | null>(null);
  const [chave, setChave] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/ia/config", { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json().catch(() => null);

        if (!r.ok) {
          // `details` traz o campo que o Zod recusou. Sem ele a mensagem e so
          // "Dados invalidos", que nao diz onde procurar.
          const d = corpo?.error?.details?.[0];
          throw new Error(
            d ? `${corpo.error.message} (${d.campo}: ${d.mensagem})`
              : (corpo?.error?.message ?? `Erro ${r.status}`),
          );
        }
        setConfig(corpo.data);
        setErro(null);
      })
      .catch((e: unknown) => {
        /*
         * ⚠️ Falha aqui vira TEXTO NA TELA, nunca silencio.
         *
         * A versao anterior engolia o erro e o `if (!config) return null`
         * abaixo deixava a aba em branco: quem abrisse via uma tela vazia, sem
         * saber se era carregamento, permissao ou defeito. Aba vazia nao e
         * estado, e ausencia de resposta.
         */
        if (e instanceof Error && e.name === "AbortError") return;
        setErro(e instanceof Error ? e.message : "Falha ao carregar a configuração");
      });

    return () => controle.abort();
  }, []);

  async function salvar(parcial?: { ativo?: boolean }) {
    if (!config || salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelo: config.modelo,
        ativo: parcial?.ativo ?? config.ativo,
        // Em branco NAO apaga: o servidor le ausente como "mantem a do vault".
        chave: chave.trim() || null,
        // Aqui em branco APAGA, e tem de apagar: e assim que se sai do modo de
        // teste e o bot passa a atender todo mundo. A normalizacao acontece na
        // comparacao, nao aqui: o campo guarda o texto como a pessoa digitou.
        numeroTeste: (config.numeroTeste ?? "").trim() || null,
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

    setConfig(corpo.data);
    setChave("");

    /*
     * Salvar a chave NAO liga o bot, e a diferenca precisa ser dita.
     *
     * Guardar credencial e escolher atender sozinho sao decisoes distintas, e
     * ligar por conta propria seria presumir. Mas deixar so "salvo" fez a chave
     * ficar cadastrada com o bot mudo, sem ninguem entender por que.
     */
    avisar(
      "sucesso",
      corpo.data.ativo
        ? "Atendimento automático salvo."
        : "Chave salva. Ligue o interruptor acima para o bot começar a responder.",
    );
  }

  if (erro) {
    return (
      <div
        style={{
          padding: "12px 14px",
          borderRadius: "var(--radius-md)",
          background: "var(--danger-bg)",
          border: "1px solid var(--danger-border)",
          fontSize: "var(--text-sm)",
          color: "var(--danger-text)",
          lineHeight: "var(--lh-snug)",
        }}
      >
        Não foi possível carregar o atendimento automático: {erro}
      </div>
    );
  }

  if (!config) {
    return (
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>Carregando…</p>
    );
  }

  return (
    <section>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          lineHeight: "var(--lh-snug)",
          marginBottom: 14,
        }}
      >
        Quem chamar no WhatsApp é atendido por uma inteligência artificial, que
        descobre o que a pessoa quer, encaminha para o setor certo e deixa o
        pedido registrado. Quando um atendente responde, ela para de falar.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          background: config.ativo ? "var(--primary-subtle)" : "var(--surface-2)",
          border: `1px solid ${config.ativo ? "var(--primary-border)" : "var(--border)"}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: "var(--fw-semi)" }}>
            {config.ativo ? "Ligado" : "Desligado"}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 1 }}>
            {!config.temChave
              ? "Cadastre a chave abaixo para poder ligar"
              : config.ativo && config.numeroTeste
                ? `Em teste: só responde a ${contarNumeros(config.numeroTeste)} número(s)`
                : config.ativo
                  ? "Respondendo a todos os contatos"
                  : "A chave está salva, mas o interruptor ao lado está desligado"}
          </div>
        </div>

        <ActiveToggle
          active={config.ativo}
          onChange={() => {
            const novo = !config.ativo;

            if (novo && !config.temChave && !chave.trim()) {
              avisar("atencao", "Cadastre a chave antes de ligar.");
              return;
            }

            setConfig({ ...config, ativo: novo });
            void salvar({ ativo: novo });
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="Modelo" hint="Trocar aqui não exige deploy. Flash é o mais barato.">
          <select
            style={selectStyle}
            value={config.modelo}
            onChange={(e) => setConfig({ ...config, modelo: e.target.value })}
          >
            {MODELOS_SUGERIDOS.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
            {/* Modelo gravado que saiu da lista continua selecionavel. */}
            {!MODELOS_SUGERIDOS.some((m) => m.valor === config.modelo) && (
              <option value={config.modelo}>{config.modelo}</option>
            )}
          </select>
        </Field>

        <Field
          label="Só responde a"
          hint="Um por linha. Enquanto houver número aqui, o bot ignora todos os outros. Vazio atende todo mundo."
        >
          {/*
            Textarea e nao input: validar com uma pessoa so nao basta, e o teste
            que vale e com quem nao conhece o sistema. Sem espaco para o segundo
            numero, a saida seria apagar a trava inteira.
          */}
          <textarea
            style={{
              ...inputStyle,
              height: "auto",
              minHeight: 56,
              padding: "6px 8px",
              lineHeight: "var(--lh-snug)",
              resize: "vertical",
            }}
            placeholder={"+55 (35) 99999-9999\n+55 (35) 98888-8888"}
            value={config.numeroTeste ?? ""}
            onChange={(e) => setConfig({ ...config, numeroTeste: e.target.value })}
          />
        </Field>

        <Field
          label="Chave da API"
          required={!config.temChave}
          hint="Fica guardada cifrada, e nunca volta para a tela."
        >
          <input
            style={inputStyle}
            type="password"
            autoComplete="off"
            placeholder={config.temChave ? "Deixe em branco para manter a atual" : "AIza…"}
            value={chave}
            onChange={(e) => setChave(e.target.value)}
          />
        </Field>

        {/*
          O link fica ao lado do campo, e nao numa ajuda a parte: a duvida
          "onde consigo isso?" acontece exatamente aqui, com o cursor no campo.
        */}
        {!config.temChave && (
          <div style={{ display: "flex", gap: 12, paddingLeft: 142 }}>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: "var(--text-sm)",
                fontWeight: "var(--fw-semi)",
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              Pegar uma chave no Google AI Studio
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 4h6v6" />
                <path d="M20 4 10 14" />
                <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
              </svg>
            </a>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 4,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: "var(--text-xs)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {!config.temChave
              ? "Salve a chave primeiro. O interruptor acima só liga depois disso."
              : "Depois de salvar, mande uma mensagem para o número e veja a resposta na conversa."}
          </span>

          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || (!config.temChave && chave.trim().length < 20)}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </section>
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
