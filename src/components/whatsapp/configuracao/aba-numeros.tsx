"use client";

import { useMemo, useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Drawer } from "@/components/ui/drawer";
import { PrecisaDeAjuda } from "@/components/ui/ajuda";
import {
  AcoesDaLinha,
  ActiveToggle,
  BotaoDeAcao,
  Button,
  CabecalhoDeSecao,
  EmptyRow,
  Field,
  Pagination,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  CampoSecreto,
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import {
  digitosDoTelefone,
  formatarTelefone,
  mascaraDoPais,
  novoVerifyToken,
  PAISES,
  paisDoDdi,
  separarDdi,
  telefoneValido,
  versaoDaApiValida,
  type ContaWhatsapp,
} from "@/modules/whatsapp/whatsapp.types";
import { PASSOS_PARA_CONECTAR, UrlDeCallback } from "./webhook";
import { TesteDeConexao } from "./teste-de-conexao";
import type { ResultadoDoTeste } from "@/shared/domain/teste-conexao";
import { temPalavrao } from "@/shared/domain/linguagem";
import type { ConfigIA } from "@/modules/ia/ia.types";

/**
 * Os numeros de WhatsApp da empresa.
 *
 * ⚠️ Token e App Secret sao de MAO UNICA: entram, nunca voltam. Vivem no
 * `supabase_vault` e a API devolve so `temToken` / `temAppSecret`. Por isso os
 * campos ficam vazios ao editar, avisando que em branco significa "mantem o que
 * ja esta la", e nao "apaga".
 */

const POR_PAGINA = 10;

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
  botAtivo: boolean;
  iaCredencialId: number | null;
  botRespondeTodos: boolean;
  botNumeros: string;
  /** ⚠️ Separado do numero: e ele que decide como a mascara agrupa os digitos. */
  ddi: string;
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
    verifyToken: novoVerifyToken(),
    token: "",
    appSecret: "",
    /*
     * ⚠️ Nasce FECHADO. Numero novo que ja saisse respondendo a todo mundo
     * faria o primeiro cliente real ser cobaia de uma configuracao que ninguem
     * conferiu ainda.
     */
    botAtivo: false,
    iaCredencialId: null,
    botRespondeTodos: false,
    botNumeros: "",
    ddi: "55",
  };
}

function daConta(c: ContaWhatsapp): Rascunho {
  return {
    id: c.id,
    apelido: c.apelido ?? "",
    numero: separarDdi(c.numero ?? "").local,
    phoneNumberId: c.phoneNumberId,
    wabaId: c.wabaId ?? "",
    apiVersao: c.apiVersao,
    verifyToken: c.verifyToken ?? "",
    token: "",
    appSecret: "",
    botAtivo: c.botAtivo,
    iaCredencialId: c.iaCredencialId,
    botRespondeTodos: c.botRespondeTodos,
    botNumeros: c.botNumeros ?? "",
    // O numero vem inteiro do banco; aqui ele volta a ser pais + local.
    ddi: separarDdi(c.numero ?? "").ddi,
  };
}

export function AbaDeNumeros({
  contas,
  credenciais,
  onMudou,
}: {
  contas: ContaWhatsapp[];
  /**
   * As chaves de IA da empresa, para escolher qual este numero usa.
   *
   * ⚠️ Vem de FORA, do drawer, e nao de uma consulta daqui: a mesma lista ja e
   * lida pela aba de provedores, e buscar de novo aqui seria a segunda consulta
   * do mesmo dado na mesma abertura.
   */
  credenciais: ConfigIA[] | null;
  onMudou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);

  /*
   * Abre o formulario com o veredito zerado.
   *
   * ⚠️ O resultado vive AQUI, no pai, porque e o pai que decide se o salvar
   * libera — e o pai nao desmonta ao fechar o drawer. Sem zerar, testar o
   * numero A e depois abrir o B deixaria o B salvavel com o veredito do A, que
   * e exatamente o que a exigencia de testar existe para impedir.
   *
   * Zerado aqui, e nao num efeito: `setRascunho` tambem e o que responde a cada
   * tecla digitada, e so a ABERTURA passa por esta funcao.
   */
  function abrir(r: Rascunho) {
    setTeste(null);
    setRascunho(r);
  }

  async function testar(): Promise<ResultadoDoTeste> {
    if (!rascunho) throw new Error("sem rascunho");

    const r = await fetch("/api/v1/whatsapp/contas/teste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id,
        phoneNumberId: rascunho.phoneNumberId.trim(),
        apiVersao: rascunho.apiVersao.trim() || "v19.0",
        token: rascunho.token.trim() || null,
      }),
    });

    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      /*
       * Falha NOSSA nao vira reprovacao das credenciais. Sessao expirada e erro
       * de rota nao dizem nada sobre o token que foi colado, e marcar como
       * definitiva travaria o cadastro por um motivo alheio a Meta.
       */
      const detalhe = corpo?.error?.details?.[0];
      return {
        ok: false,
        definitivo: false,
        mensagem: detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível testar agora."),
        detalhe: null,
      };
    }

    return corpo.data as ResultadoDoTeste;
  }

  const totalPaginas = Math.max(1, Math.ceil(contas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = useMemo(
    () => contas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA),
    [contas, paginaAtual],
  );

  async function salvar() {
    if (!rascunho || salvando) return;

    setSalvando(true);

    const r = await fetch("/api/v1/whatsapp/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id,
        apelido: rascunho.apelido.trim() || null,
        /*
         * O DDI vem do SELETOR, e nao de adivinhacao por comprimento.
         *
         * `paraFormatoMeta` decidia pelo tamanho: 10 ou 11 digitos viravam
         * Brasil. Isso funciona ate alguem cadastrar um numero de Portugal, que
         * tem nove, ou um dos Estados Unidos, que tem dez — e ai o numero sai
         * com o pais errado sem nada acusar.
         */
        numero: rascunho.numero ? `${rascunho.ddi}${digitosDoTelefone(rascunho.numero)}` : null,
        phoneNumberId: rascunho.phoneNumberId.trim(),
        wabaId: rascunho.wabaId.trim() || null,
        apiVersao: rascunho.apiVersao.trim() || "v19.0",
        verifyToken: rascunho.verifyToken.trim() || null,
        // Em branco NAO apaga: o servidor le ausente como "mantem o do vault".
        token: rascunho.token.trim() || null,
        appSecret: rascunho.appSecret.trim() || null,
        botAtivo: rascunho.botAtivo,
        iaCredencialId: rascunho.iaCredencialId,
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
              disabled={salvando || problemas(rascunho, teste).length > 0}
              title={problemas(rascunho, teste)[0]}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        }
      >
        <Formulario
          rascunho={rascunho}
          credenciais={credenciais}
          onMudar={setRascunho}
          aoTestar={testar}
          onTeste={setTeste}
        />
      </Drawer>
    );
  }

  return (
    <>
      <CabecalhoDeSecao
        titulo="Seus números de WhatsApp"
        legenda="Cada número tem caixa de entrada própria e decide sozinho se o atendimento automático responde a todo mundo ou só a uma lista. É aqui que ficam o token e a chave que a Meta exige para enviar e receber."
        onIncluir={() => abrir(vazio())}
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
                      <BotaoDeAcao rotulo="Editar" onClick={() => abrir(daConta(c))}>
                        <path d="M11.5 2.5a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5 8.5-8z" />
                      </BotaoDeAcao>
                    </AcoesDaLinha>
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </TableArea>

        {contas.length > POR_PAGINA && (

          <Pagination

            page={paginaAtual}

            totalPages={totalPaginas}

            total={contas.length}

            pageSize={POR_PAGINA}

            onPage={setPagina}

          />

        )}

      <PrecisaDeAjuda
        duvidas={[
          {
            pergunta: "Meu número não recebe as mensagens",
            resposta:
              "O webhook precisa apontar para a URL desta tela e estar assinado no campo messages. Sem isso a Meta aceita o cadastro e não entrega nada.",
            href: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks",
            rotuloDoLink: "Ver na documentação da Meta",
          },
          {
            pergunta: "Onde consigo o token e o App Secret?",
            resposta:
              "No painel de apps da Meta, dentro do app que tem o produto WhatsApp. O token precisa ser permanente, de usuário do sistema: o temporário expira em 24 horas e o envio para de funcionar sem aviso.",
            href: "https://developers.facebook.com/docs/whatsapp/business-management-api/get-started",
            rotuloDoLink: "Ver como gerar",
          },
          {
            pergunta: "O que é responder a todos?",
            resposta:
              "É o interruptor dentro de cada número que decide se o atendimento automático fala com qualquer contato ou só com uma lista. Número novo nasce fechado, para o primeiro cliente real não virar cobaia de uma configuração que ninguém conferiu.",
          },
        ]}
      />
    </>
  );
}

/**
 * Um assunto do formulario.
 *
 * ⚠️ Rotulo pequeno, sem moldura e sem fundo: o que separa os grupos e o vao
 * entre eles, nao uma caixa. Caixa dentro de drawer vira cartao sobre cartao, e
 * o formulario passa a parecer tres telas empilhadas.
 */
/**
 * Tudo que impede o salvar, em ordem de leitura do formulario.
 *
 * ⚠️ Uma funcao so, e nao condicoes espalhadas pelo botao: assim a MESMA lista
 * vira o motivo mostrado no `title` do botao desabilitado. Botao cinza sem
 * explicacao e o jeito mais rapido de fazer alguem desistir do cadastro.
 */
function problemas(r: Rascunho, teste: ResultadoDoTeste | null): string[] {
  const erros: string[] = [];

  if (r.apelido.trim() && temPalavrao(r.apelido)) {
    erros.push("Escolha outro apelido para este número");
  }

  if (r.numero.trim() && !telefoneValido(r.ddi, r.numero)) {
    const tamanhos = paisDoDdi(r.ddi).tamanhos.join(" ou ");
    erros.push(`Número de ${paisDoDdi(r.ddi).nome} tem ${tamanhos} dígitos`);
  }

  if (r.phoneNumberId.trim().length < 5) erros.push("Falta o Phone number ID");

  if (!versaoDaApiValida(r.apiVersao)) {
    erros.push("Versão da API no formato da Meta, como v19.0");
  }

  /*
   * A lista de numeros so e exigida com a IA LIGADA e fechada. Desligada, ela
   * nem aparece na tela, e cobrar preenchimento de um campo escondido travaria
   * o cadastro sem nada visivel explicando.
   */
  if (r.botAtivo && r.iaCredencialId == null) {
    erros.push("Escolha a chave de IA que este número usa");
  }

  if (r.botAtivo && !r.botRespondeTodos && !r.botNumeros.trim()) {
    erros.push("Informe ao menos um número, ou ligue responder a todos");
  }

  /*
   * ⚠️ So falha DEFINITIVA barra: token recusado e Phone number ID inexistente
   * nao vao funcionar nunca. Meta instavel nao diz nada sobre o que foi
   * digitado, e travar ali impediria de arrumar a configuracao no pior momento.
   */
  if (teste && !teste.ok && teste.definitivo) erros.push(teste.mensagem);

  /*
   * ⚠️ SEMPRE exige ter testado, cadastro novo ou edicao.
   *
   * Sem isto o teste vira enfeite, e o erro volta a aparecer so quando o
   * primeiro cliente escrever. Na edicao ele custa um clique a mais para trocar
   * so o apelido, e vale: o token do API Setup expira em 24 horas sozinho, sem
   * ninguem mexer no cadastro, e este e o unico momento em que alguem estava
   * olhando para ele.
   */
  if (teste == null) erros.push("Teste a conexão antes de salvar");

  return erros;
}

function Grupo({
  titulo,
  legenda,
  primeiro,
  children,
}: {
  titulo: string;
  legenda: string;
  /** Primeiro do formulario: metade do respiro em cima. */
  primeiro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      {/*
        O MESMO cabecalho das secoes da listagem: mesmo tamanho, mesma legenda
        embaixo. Um formulario com titulo de outro peso pareceria outra tela.
      */}
      <CabecalhoDeSecao titulo={titulo} legenda={legenda} primeiro={primeiro} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{children}</div>
    </section>
  );
}

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
  credenciais,
  onMudar,
  aoTestar,
  onTeste,
}: {
  rascunho: Rascunho;
  credenciais: ConfigIA[] | null;
  onMudar: (r: Rascunho) => void;
  aoTestar: () => Promise<ResultadoDoTeste>;
  onTeste: (r: ResultadoDoTeste | null) => void;
}) {
  const mudar =
    (campo: keyof Rascunho) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onMudar({ ...rascunho, [campo]: e.target.value });

  const editando = rascunho.id != null;
  const marcador = editando ? "Deixe em branco para manter o atual" : "";

  return (
    /*
     * gap 3 dentro do grupo, e nao os 8 do `FormDrawer`.
     *
     * Desvio consciente: os formularios do sistema tem tres ou quatro campos, e
     * ali o respiro de 8 separa. Aqui sao nove, e o mesmo respiro os desmancha
     * numa lista de itens soltos. O que separa uma linha da outra e a propria
     * linha; o que separa um ASSUNTO do outro e o grupo.
     */
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Grupo
        primeiro
        titulo="O número"
        legenda="Como ele aparece para a sua equipe no seletor de caixas de entrada. O país define o formato do número e entra no envio."
      >
        <Field label="Apelido" hint="Como este número aparece no seletor. Ex.: Financeiro.">
          <input style={inputStyle} value={rascunho.apelido} onChange={mudar("apelido")} />
        </Field>

        <Field label="País" hint="Define o DDI que vai junto do número no envio.">
          <select
            style={selectStyle}
            value={rascunho.ddi}
            onChange={(e) => onMudar({ ...rascunho, ddi: e.target.value })}
          >
            {PAISES.map((p) => (
              <option key={p.ddi} value={p.ddi}>
                {p.bandeira} {p.nome} (+{p.ddi})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Número" hint="Sem o país. No Brasil, com DDD.">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/*
              O DDI aparece FIXO ao lado do campo, e nao dentro dele.

              Dentro, ele seria apagavel por engano e voltaria a ser adivinhado
              no salvar. Ao lado, ele mostra o que o seletor escolheu sem virar
              texto que se edita.
            */}
            <span
              style={{
                flexShrink: 0,
                fontSize: "var(--text-base)",
                color: "var(--text-tertiary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +{rascunho.ddi}
            </span>

            <input
              style={{ ...inputStyle, flex: 1 }}
              inputMode="tel"
              // Zeros e nao um numero plausivel: assim a dica se le como FORMATO.
              // Um exemplo verossimil parece dado de verdade, e o que estava ali
              // era o proprio numero da empresa.
              // Zeros e nao um numero plausivel: assim a dica se le como
              // FORMATO. Exemplo verossimil parece dado de verdade.
              placeholder={paisDoDdi(rascunho.ddi).mascara.replace(/9/g, "0")}
              value={mascaraDoPais(rascunho.ddi, rascunho.numero)}
              onChange={(e) =>
                onMudar({ ...rascunho, numero: digitosDoTelefone(e.target.value) })
              }
            />
          </div>
        </Field>
      </Grupo>

      {/*
        As credenciais em bloco proprio, e com os nomes DA META.

        Quem preenche esta parte esta com o painel deles aberto na outra aba,
        copiando e colando. Um rotulo traduzido obriga a adivinhar qual campo de
        la corresponde a qual daqui, e "Identificação" nao existe em lugar
        nenhum do painel da Meta.
      */}
      <Grupo
        titulo="Credenciais da Meta"
        legenda="Os campos têm o mesmo nome que no painel da Meta, para copiar e colar sem procurar. Token e App Secret entram e nunca voltam para a tela."
      >
        <Field
          label="Phone number ID"
          required
          hint="Meta, WhatsApp, Configuração da API. É o identificador do número, não o número."
        >
          <input
            style={inputStyle}
            value={rascunho.phoneNumberId}
            onChange={mudar("phoneNumberId")}
          />
        </Field>

        <Field
          label="WB Account ID"
          hint="Na mesma tela da Meta. Sem ele não dá para listar os modelos aprovados."
        >
          <input style={inputStyle} value={rascunho.wabaId} onChange={mudar("wabaId")} />
        </Field>

        <Field
          label="Access token"
          required={!editando}
          hint="Use um token de Usuário do sistema, no Business Manager. O do API Setup expira em 24 horas."
        >
          <CampoSecreto
            valor={rascunho.token}
            placeholder={marcador}
            onMudar={(v) => onMudar({ ...rascunho, token: v })}
          />
        </Field>

        <Field
          label="App Secret"
          required={!editando}
          hint="Meta, Configurações do app, aba Básico. É ele que prova que o webhook veio da Meta."
        >
          <CampoSecreto
            valor={rascunho.appSecret}
            placeholder={marcador}
            onMudar={(v) => onMudar({ ...rascunho, appSecret: v })}
          />
        </Field>

        {/*
          Gerado por NOS, e nao digitado.

          ⚠️ Ele nao vem da Meta: e um segredo combinado que a gente inventa e
          cola no painel deles. A Meta so o usa no handshake, quando o webhook e
          verificado — trocar depois nao derruba as mensagens na hora, mas
          derruba na proxima reverificacao. Por isso ele fica travado, e trocar
          exige um gesto explicito.
        */}
        <Field
          label="Verify token"
          hint={
            editando
              ? "Trocar aqui obriga a trocar também no painel da Meta, senão a próxima verificação falha."
              : "Cole este mesmo texto no webhook da Meta. Ele prova que o webhook é seu."
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={rascunho.verifyToken}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => onMudar({ ...rascunho, verifyToken: novoVerifyToken() })}
              title="Gerar outro"
              aria-label="Gerar outro verify token"
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                display: "grid",
                placeItems: "center",
                border: "none",
                background: "transparent",
                color: "var(--primary)",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12a8 8 0 1 1-2.3-5.6" />
                <path d="M20 3v4.5h-4.5" />
              </svg>
            </button>
          </div>
        </Field>

        <Field
          label="Versão da API"
          hint="A Meta descontinua versão por data. Trocar aqui não exige deploy."
        >
          <input style={inputStyle} value={rascunho.apiVersao} onChange={mudar("apiVersao")} />
        </Field>
      </Grupo>

      {/*
        O comportamento do bot vem POR ULTIMO.

        Ele estava entre o apelido e o numero, cortando o cadastro no meio com
        uma decisao de outra natureza. Aqui o formulario le em ordem: que numero
        e este, como falo com a Meta, e so entao o que ele faz sozinho.
      */}
      <Grupo
        titulo="Atendimento automático"
        legenda="Decide quem recebe resposta da IA neste número. Ligar para todos é um ato: número novo nasce fechado."
      >
        {/*
          O interruptor mestre vem PRIMEIRO, e esconde o resto quando desligado.

          Quem atende so a mao nao precisa decidir "para quem a IA responde": a
          pergunta nao se aplica, e deixa-la na tela sugere que atender por IA e
          obrigatorio.
        */}
        <Field
          label="Respostas de IA"
          hint="Desligado, este número é atendido só por pessoas."
        >
          <ActiveToggle
            active={rascunho.botAtivo}
            onChange={() => onMudar({ ...rascunho, botAtivo: !rascunho.botAtivo })}
          />
        </Field>

        {rascunho.botAtivo && (
          <Field
            label="Chave de IA"
            required
            hint="Qual credencial este número usa. É por ela que o gasto é rastreado, então cada número aponta para uma."
          >
            <select
              style={selectStyle}
              value={rascunho.iaCredencialId ?? ""}
              onChange={(e) =>
                onMudar({
                  ...rascunho,
                  iaCredencialId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              {/*
                ⚠️ Sem opcao de "deixar o sistema escolher".
                
                Ela existia e ninguem entendia o que fazia — com razao: numero
                sem chave definida gasta em alguma credencial que a fila
                decidiu, e depois nao ha como dizer qual numero consumiu o que.
                Rateio exige que a escolha seja explicita.
              */}
              <option value="" disabled>
                Escolha uma chave
              </option>
              {(credenciais ?? [])
                .filter((c) => c.ativo && c.temChave)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.modelo}
                  </option>
                ))}
            </select>
          </Field>
        )}

        {rascunho.botAtivo && (
          <Field
            label="Responde a todos"
            hint={
              rascunho.botRespondeTodos
                ? "A IA fala com qualquer contato deste número."
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
        )}

        {rascunho.botAtivo && !rascunho.botRespondeTodos && (
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
      </Grupo>

      <UrlDeCallback />

      {/*
        O teste vem logo DEPOIS do callback, no fim do formulário.

        É o último passo do que a pessoa acabou de fazer: pegou as credenciais na
        Meta, colou aqui, e agora pergunta se elas servem. Colocado no meio, ele
        pediria para testar campos que ainda não foram preenchidos.
      */}
      <TesteDeConexao
        titulo="Confirmar antes de salvar"
        legenda="Pergunta à Meta se o token e o Phone number ID servem, e mostra de qual número eles são. O App Secret e o Verify token não entram: os dois só se provam quando a Meta chama a URL acima."
        assinatura={`${rascunho.id ?? 0}|${rascunho.phoneNumberId.trim()}|${rascunho.apiVersao.trim()}|${rascunho.token.trim().length}`}
        bloqueio={
          rascunho.phoneNumberId.trim().length < 5
            ? "Preencha o Phone number ID primeiro"
            : !editando && rascunho.token.trim().length < 20
              ? "Cole o token primeiro"
              : null
        }
        aoTestar={aoTestar}
        onResultado={onTeste}
      />

      {/*
        Uma sanfona so, com os passos e as duvidas juntos.

        Eram duas secoes: "Como conectar" sempre aberta empurrando o formulario
        para baixo, e "Precisa de ajuda?" logo abaixo dela. Quem ja conectou
        pagava a primeira toda vez, e quem estava travado nao sabia em qual das
        duas procurar.
      */}
      <PrecisaDeAjuda
        titulo="Como conectar"
        duvidas={[
          ...PASSOS_PARA_CONECTAR,
          {
            pergunta: "Meu número não recebe as mensagens",
            resposta:
              "O webhook precisa apontar para a URL acima e estar assinado no campo messages. Sem isso a Meta aceita o cadastro e não entrega nada.",
            href: "https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks",
            rotuloDoLink: "Ver na documentação da Meta",
          },
          {
            pergunta: "O que é responder a todos?",
            resposta:
              "É o interruptor deste número que decide se o atendimento automático fala com qualquer contato ou só com uma lista. Número novo nasce fechado, para o primeiro cliente real não virar cobaia de uma configuração que ninguém conferiu.",
          },
        ]}
      />
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
