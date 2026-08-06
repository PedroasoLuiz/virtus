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
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import {
  digitosDoTelefone,
  formatarTelefone,
  mascararTelefone,
  PAISES,
  separarDdi,
  type ContaWhatsapp,
} from "@/modules/whatsapp/whatsapp.types";
import { PASSOS_PARA_CONECTAR, UrlDeCallback } from "./webhook";

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
    botRespondeTodos: c.botRespondeTodos,
    botNumeros: c.botNumeros ?? "",
    // O numero vem inteiro do banco; aqui ele volta a ser pais + local.
    ddi: separarDdi(c.numero ?? "").ddi,
  };
}

export function AbaDeNumeros({
  contas,
  onMudou,
}: {
  contas: ContaWhatsapp[];
  onMudou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);

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
function Grupo({
  titulo,
  legenda,
  children,
}: {
  titulo: string;
  legenda: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {/*
        O MESMO cabecalho das secoes da listagem: mesmo tamanho, mesma legenda
        embaixo. Um formulario com titulo de outro peso pareceria outra tela.
      */}
      <CabecalhoDeSecao titulo={titulo} legenda={legenda} />
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
     * gap 3 dentro do grupo, e nao os 8 do `FormDrawer`.
     *
     * Desvio consciente: os formularios do sistema tem tres ou quatro campos, e
     * ali o respiro de 8 separa. Aqui sao nove, e o mesmo respiro os desmancha
     * numa lista de itens soltos. O que separa uma linha da outra e a propria
     * linha; o que separa um ASSUNTO do outro e o grupo.
     */
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Grupo
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
              placeholder={rascunho.ddi === "55" ? "(00) 00000-0000" : "000000000"}
              /*
               * Mascara so onde ela e conhecida. Fora do Brasil, agrupar os
               * digitos em DDD e sufixo inventaria um formato que nao existe no
               * pais, e o campo passaria a mentir sobre o que e valido.
               */
              value={
                rascunho.ddi === "55"
                  ? mascararTelefone(`55${rascunho.numero}`).replace(/^\+55\s*/, "")
                  : rascunho.numero
              }
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
          label="WhatsApp Business Account ID"
          hint="Na mesma tela da Meta. Sem ele não dá para listar os modelos aprovados."
        >
          <input style={inputStyle} value={rascunho.wabaId} onChange={mudar("wabaId")} />
        </Field>

        <Field
          label="Access token"
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
          label="App Secret"
          required={!editando}
          hint="Meta, Configurações do app, aba Básico. É ele que prova que o webhook veio da Meta."
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

        <Field
          label="Verify token"
          hint="Você inventa este texto e cola o MESMO nos dois lados. Serve só para a Meta provar que o webhook é seu."
        >
          <input
            style={inputStyle}
            value={rascunho.verifyToken}
            onChange={mudar("verifyToken")}
          />
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
      </Grupo>

      <UrlDeCallback />

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
