"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Drawer } from "@/components/ui/drawer";
import { PrecisaDeAjuda } from "@/components/ui/ajuda";
import {
  AcoesDaLinha,
  ActiveToggle,
  Badge,
  BotaoDeAcao,
  Button,
  CabecalhoDeSecao,
  EmptyRow,
  Field,
  Pagination,
  PanelTabs,
  SkeletonRows,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import { temPalavrao } from "@/shared/domain/linguagem";
import { AREAS, PERMISSOES } from "@/modules/atendimento/permissoes";
import type { Persona } from "@/modules/atendimento/personas.types";
import { formatarTelefone, type ContaWhatsapp } from "@/modules/whatsapp/whatsapp.types";
import type { ConfigIA } from "@/modules/ia/ia.types";

/**
 * O que a IA pode resolver sozinha, por setor.
 *
 * ⚠️ Sem persona para um setor, o comportamento continua sendo encaminhar.
 * Persona e AUTORIZACAO, nao obrigacao — e nenhuma delas autoriza falar de
 * valor, vencimento ou boleto.
 */

const POR_PAGINA = 10;

const ABA_PARAMETRIZACAO = "Parametrização";
const ABA_PERMISSOES = "Permissões";
type AbaDoFormulario = typeof ABA_PARAMETRIZACAO | typeof ABA_PERMISSOES;

export type Setor = { id: number; nome: string };

export function AbaDePersonas({
  contas,
  credenciais,
  personas,
  setores,
  onRecarregar,
}: {
  contas: ContaWhatsapp[];
  /**
   * As chaves de IA da empresa, para o rascunho automático.
   *
   * ⚠️ Vem de FORA, do drawer, e não de uma consulta daqui: a mesma lista já é
   * lida pela aba de automação, e buscar de novo seria a segunda consulta do
   * mesmo dado na mesma abertura.
   */
  credenciais: ConfigIA[] | null;
  /** ⚠️ De fora, pelo mesmo motivo dos provedores: a aba desmonta. */
  personas: Persona[] | null;
  setores: Setor[];
  onRecarregar: () => void;
}) {
  const [editando, setEditando] = useState<Persona | null>(null);
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil((personas?.length ?? 0) / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis =
    personas?.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA) ?? null;

  if (editando) {
    return (
      <FormularioDaPersona
        persona={editando}
        setores={setores}
        contas={contas}
        credenciais={credenciais}
        onFechar={() => setEditando(null)}
        onSalvou={() => {
          setEditando(null);
          onRecarregar();
        }}
      />
    );
  }

  return (
    <>
      <CabecalhoDeSecao
        titulo="Personas do atendimento"
        legenda="O que a IA pode resolver sozinha, por setor. Sem persona, ela continua só entendendo e encaminhando. Com persona, fecha sozinha o que estiver na lista e nada além, e nunca é autorizada a falar de valor, vencimento ou boleto."
        onIncluir={() => setEditando(PERSONA_VAZIA)}
        rotuloIncluir="Adicionar persona"
      />

      <TableArea minWidth={0}>
        <TableHead>
          <Th>Persona</Th>
          <Th>Onde vale</Th>
          <Th minWidth={90}>Situação</Th>
          <Th> </Th>
        </TableHead>

        <tbody>
          {personas == null ? (
            <SkeletonRows cols={4} rows={3} labels={["Persona", "Onde vale", "Situação", ""]} />
          ) : visiveis!.length === 0 ? (
            <EmptyRow colSpan={4} message="Nenhuma persona. A IA vai triar e encaminhar tudo." />
          ) : (
            visiveis!.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <div style={{ fontWeight: "var(--fw-semi)" }}>{p.nome}</div>

                  {/* O que ela resolve, cortado em uma linha: é o que distingue
                      duas personas do mesmo setor. */}
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 320,
                    }}
                  >
                    {p.podeResolver?.replace(/\s*\n\s*/g, " · ") ||
                      "Sem lista: só acolhe e encaminha"}
                  </div>
                </Td>

                <Td>
                  <div>{setores.find((s) => s.id === p.setorId)?.nome ?? "Qualquer setor"}</div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "var(--text-xs)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {rotuloDoNumero(contas, p.contaId)}
                  </div>
                </Td>

                <Td>
                  {p.ativo ? (
                    <Badge tom="success">ativa</Badge>
                  ) : (
                    <Badge tom="neutral">desligada</Badge>
                  )}
                </Td>

                {/*
                  ⚠️ Só editar. Excluir mora DENTRO do drawer, no fim.

                  Na linha ele ficava a um clique do editar, com o mesmo tamanho
                  e o mesmo cinza — e a linha erra sem dar tempo de ler qual
                  persona era.
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

      {(personas?.length ?? 0) > POR_PAGINA && (
        <Pagination
          page={paginaAtual}
          totalPages={totalPaginas}
          total={personas?.length ?? 0}
          pageSize={POR_PAGINA}
          onPage={setPagina}
        />
      )}

      <PrecisaDeAjuda
        duvidas={[
          {
            pergunta: "O que escrevo em pode resolver?",
            resposta:
              "Uma lista curta do que a IA fecha sozinha naquele setor: horário de atendimento, como enviar a nota, prazo padrão de retorno. Fora dessa lista ela encaminha, mesmo que pareça saber a resposta.",
          },
          {
            pergunta: "Ela pode falar de valores?",
            resposta:
              "Não, e persona nenhuma muda isso. Valor, vencimento e boleto continuam saindo só da consulta que exige CPF ou CNPJ e o código enviado ao e-mail do cadastro.",
          },
          {
            pergunta: "Preciso cadastrar persona?",
            resposta:
              "Não. Sem persona, a IA entende o pedido e encaminha para o setor certo, que é o comportamento padrão. Persona é permissão para ela resolver um recorte sem chamar ninguém.",
          },
          {
            pergunta: "Posso ter uma persona por número?",
            resposta:
              "Pode. Deixando o número em branco ela vale para todos; escolhendo um, só naquele. É o que permite o financeiro e o suporte atenderem com tons diferentes.",
          },
          {
            pergunta: "Não aparece nenhum setor na lista",
            resposta:
              "A persona pode ficar geral, sem setor, e vale para tudo que não tiver persona própria. Setor é cadastro à parte e ainda não tem tela própria.",
          },
        ]}
      />
    </>
  );
}

/** Persona em branco. Nasce ATIVA: quem cadastra quer que ela valha. */
const PERSONA_VAZIA: Persona = {
  id: 0,
  contaId: null,
  setorId: null,
  nome: "",
  descricao: null,
  podeResolver: null,
  permissoes: [],
  ativo: true,
};

function rotuloDoNumero(contas: ContaWhatsapp[], contaId: number | null): string {
  if (contaId == null) return "Todos os números";

  const c = contas.find((x) => x.id === contaId);
  if (!c) return "Número removido";

  return c.apelido || formatarTelefone(c.numero ?? "") || c.phoneNumberId;
}

function FormularioDaPersona({
  persona,
  setores,
  contas,
  credenciais,
  onFechar,
  onSalvou,
}: {
  persona: Persona;
  setores: Setor[];
  contas: ContaWhatsapp[];
  credenciais: ConfigIA[] | null;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState(persona);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [aba, setAba] = useState<AbaDoFormulario>(ABA_PARAMETRIZACAO);
  const [sugerindo, setSugerindo] = useState(false);

  const erros = problemas(rascunho);
  const geral = rascunho.setorId == null;

  function marcar(id: string, ligada: boolean) {
    setRascunho((r) => ({
      ...r,
      permissoes: ligada
        ? [...new Set([...r.permissoes, id])]
        : r.permissoes.filter((x) => x !== id),
    }));
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/atendimento/personas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: rascunho.id || null,
        contaId: rascunho.contaId,
        setorId: rascunho.setorId,
        nome: rascunho.nome.trim(),
        descricao: rascunho.descricao?.trim() || null,
        podeResolver: rascunho.podeResolver?.trim() || null,
        permissoes: rascunho.permissoes,
        ativo: rascunho.ativo,
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

    avisar("sucesso", "Persona salva.");
    onSalvou();
  }

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);

    const r = await fetch(`/api/v1/atendimento/personas/${rascunho.id}`, { method: "DELETE" });

    setExcluindo(false);

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível excluir");
      return;
    }

    avisar("sucesso", "Persona excluída.");
    onSalvou();
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      title={rascunho.id ? "Editar persona" : "Nova persona"}
      subtitle="Nunca autoriza dizer valor, vencimento ou boleto"
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
      {/*
        ⚠️ Duas abas, e não uma pilha só.

        Parametrização é quem ela É; Permissões é o que ela PODE. São perguntas
        de natureza diferente — uma é redação, a outra é autorização — e ler as
        duas na mesma coluna fazia a lista de consultas parecer mais um campo de
        texto do formulário.
      */}
      <PanelTabs
        tabs={[ABA_PARAMETRIZACAO, ABA_PERMISSOES]}
        active={aba}
        onChange={(t) => setAba(t as AbaDoFormulario)}
      />

      {aba === ABA_PARAMETRIZACAO && (
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Grupo
          primeiro
          titulo="A persona"
          legenda="O nome serve só para você achar esta linha na lista. O jeito de falar é o que a IA imita quando responde por ela."
        >
          <Field label="Nome" required hint="Só para você identificar aqui dentro.">
            <input
              style={inputStyle}
              value={rascunho.nome}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            />
          </Field>

          <Field
            label="Quem ela é"
            hint="O jeito de falar. Ex.: direta e prática, evita jargão, confirma antes de encerrar."
          >
            <textarea
              style={{ ...textareaStyle, minHeight: 80 }}
              value={rascunho.descricao ?? ""}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
            />

            {/*
              ⚠️ Só aparece com chave de IA cadastrada.

              Sem chave o botão não teria com que escrever, e um botão que abre
              para dizer "não dá" é pior que botão nenhum: quem não usa IA nem
              precisa saber que isto existe.
            */}
            {(credenciais ?? []).some((c) => c.ativo && c.temChave) && (
              <BotaoDeSugestao onClick={() => setSugerindo(true)} />
            )}
          </Field>
        </Grupo>

        <Grupo
          titulo="Onde ela vale"
          legenda="Os dois em branco fazem dela a persona geral, usada em tudo que não tiver uma própria. É o que permite o financeiro e o suporte atenderem com tons diferentes."
        >
          <Field label="Setor" hint="Vazio vale para o que não tiver persona própria.">
            <select
              style={selectStyle}
              value={rascunho.setorId ?? ""}
              onChange={(e) =>
                setRascunho({
                  ...rascunho,
                  setorId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Qualquer setor</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Número" hint="Vazio vale para todos os números da empresa.">
            <select
              style={selectStyle}
              value={rascunho.contaId ?? ""}
              onChange={(e) =>
                setRascunho({
                  ...rascunho,
                  contaId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Todos os números</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.apelido || formatarTelefone(c.numero ?? "") || `Número ${c.id}`}
                </option>
              ))}
            </select>
          </Field>
        </Grupo>

        <Grupo
          titulo="O que ela fecha sozinha"
          legenda="Um item por linha. Fora dessa lista a IA encaminha, mesmo que pareça saber a resposta. Valor, vencimento e boleto ficam de fora sempre, e escrevê-los aqui não muda isso."
        >
          <Field label="Pode resolver">
            <textarea
              style={{ ...textareaStyle, minHeight: 110 }}
              placeholder={
                "horário de atendimento e endereço\ncomo enviar a nota fiscal\nprazo padrão de retorno do setor"
              }
              value={rascunho.podeResolver ?? ""}
              onChange={(e) => setRascunho({ ...rascunho, podeResolver: e.target.value })}
            />
          </Field>

          <Field label="Ativa" hint="Desligada, o assunto volta a ser só encaminhado.">
            <ActiveToggle
              active={rascunho.ativo}
              onChange={() => setRascunho({ ...rascunho, ativo: !rascunho.ativo })}
            />
          </Field>
        </Grupo>

      </div>
      )}

      {aba === ABA_PERMISSOES && (
        <Permissoes
          geral={geral}
          escolhidas={rascunho.permissoes}
          onMarcar={marcar}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {sugerindo && (
          <PedirSugestao
            credenciais={(credenciais ?? []).filter((c) => c.ativo && c.temChave)}
            setorNome={setores.find((x) => x.id === rascunho.setorId)?.nome ?? null}
            onFechar={() => setSugerindo(false)}
            onPronto={(r) => {
              /*
               * ⚠️ Cai nos CAMPOS, e não no banco. O rascunho é revisado antes
               * de salvar: modelo escrevendo direto seria autorizar a IA a
               * definir o que ela mesma pode fazer.
               */
              setRascunho((atual) => ({
                ...atual,
                descricao: r.descricao,
                podeResolver: r.podeResolver,
                permissoes: r.permissoes,
              }));
              setSugerindo(false);
              avisar("sucesso", "Rascunho pronto", "Revise antes de salvar.");
            }}
          />
        )}

        {/* Persona nunca gravada não tem o que excluir: basta fechar. */}
        {rascunho.id > 0 && (
          <AreaDeExclusao nome={rascunho.nome.trim() || "esta persona"} onExcluir={excluir} excluindo={excluindo} />
        )}
      </div>
    </Drawer>
  );
}

/**
 * Tudo que impede o salvar, na ordem do formulário.
 *
 * ⚠️ Uma lista só, e não condições espalhadas pelo botão: a MESMA lista vira o
 * motivo mostrado no botão desabilitado. Botão cinza sem explicação é o jeito
 * mais rápido de fazer alguém desistir do cadastro.
 */
function problemas(p: Persona): string[] {
  const erros: string[] = [];

  if (p.nome.trim().length < 2) erros.push("Dê um nome a esta persona");
  if (p.nome.trim() && temPalavrao(p.nome)) erros.push("Escolha outro nome para esta persona");

  return erros;
}

/**
 * Excluir, no fim do formulário, atrás de uma sanfona.
 *
 * ⚠️ Fechada por padrão, e sem moldura, como no cadastro de chaves: excluir não
 * é o que se vem fazer aqui, e aberta ficaria a um clique de distância do
 * salvar.
 *
 * ⚠️ Aqui a exclusão APAGA de verdade, ao contrário da credencial de IA. Persona
 * é texto de instrução e nada aponta para ela: não há histórico de consumo nem
 * referência a preservar, então marcar em vez de apagar só deixaria linha morta
 * no banco.
 */
function AreaDeExclusao({
  nome,
  onExcluir,
  excluindo,
}: {
  nome: string;
  onExcluir: () => void;
  excluindo: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <section style={{ marginTop: 12 }}>
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
            Excluir esta persona
          </button>
        </div>
      )}

      {aberta && confirmando && (
        <div style={{ marginTop: 12, color: "var(--danger-text)" }}>
          <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--fw-semi)" }}>
            Excluir {nome}?
          </div>

          {/* O que ACONTECE, e não "esta ação não pode ser desfeita". */}
          <p
            style={{
              marginTop: 4,
              fontSize: "calc(var(--text-xs) + 1px)",
              color: "var(--text-tertiary)",
              lineHeight: "var(--lh-normal)",
            }}
          >
            A IA volta a só entender e encaminhar o que esta persona resolvia. As conversas já
            atendidas continuam como estão.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
            <Button size="sm" variant="danger" onClick={onExcluir} disabled={excluindo}>
              {excluindo ? "Excluindo…" : "Excluir"}
            </Button>

            <button
              type="button"
              onClick={() => setConfirmando(false)}
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
      )}
    </section>
  );
}

/** O mesmo agrupador das outras abas: título, legenda e os campos. */
function Grupo({
  titulo,
  legenda,
  primeiro,
  children,
}: {
  titulo: string;
  legenda: string;
  /** Primeiro do formulário: sem o respiro que separa um grupo do anterior. */
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
 * O que a persona pode fazer, agrupado por área.
 *
 * ⚠️ A geral só enxerga o que NÃO toca dado de cliente. Ela é quem atende quem
 * acabou de chegar, antes de qualquer identificação: mostrar a consulta de saldo
 * ali seria oferecer uma opção que o servidor recusa, e a pessoa só descobriria
 * ao salvar.
 */
function Permissoes({
  geral,
  escolhidas,
  onMarcar,
}: {
  geral: boolean;
  escolhidas: string[];
  onMarcar: (id: string, ligada: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {geral && (
        <p
          style={{
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          Esta é a persona geral: ela atende antes de o cliente se identificar, e por isso não
          consulta nada do cadastro. Dê um setor a ela, em Parametrização, para liberar as
          consultas.
        </p>
      )}

      {AREAS.map((area) => {
        const itens = PERMISSOES.filter(
          (p) => p.area === area.id && (!geral || !p.exigeIdentificacao),
        );

        if (itens.length === 0) return null;

        return (
          <section key={area.id}>
            <div
              style={{
                fontSize: "calc(var(--text-lg) + 2px)",
                fontWeight: "var(--fw-semi)",
                color: "var(--text-primary)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {area.rotulo}
            </div>
            <p
              style={{
                marginTop: 6,
                marginBottom: 10,
                fontSize: "calc(var(--text-xs) + 1px)",
                color: "var(--text-tertiary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {area.legenda}
            </p>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {itens.map((p, i) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={escolhidas.includes(p.id)}
                    onChange={(e) => onMarcar(p.id, e.target.checked)}
                    style={{ marginTop: 3, accentColor: "var(--primary)" }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "var(--text-sm)",
                        fontWeight: "var(--fw-semi)",
                      }}
                    >
                      {p.rotulo}

                      {/*
                        ⚠️ "em breve" aparece MARCÁVEL, e não escondido.

                        Deixar pronto antes de a tela existir é útil, mas quem
                        marca e não vê a IA responder aquilo concluiria que
                        quebrou.
                      */}
                      {p.emBreve && <Badge tom="neutral">em breve</Badge>}
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        fontSize: "calc(var(--text-xs) + 1px)",
                        color: "var(--text-tertiary)",
                        lineHeight: "var(--lh-normal)",
                      }}
                    >
                      {p.descricao}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * O convite para a IA escrever a persona.
 *
 * ⚠️ Fundo branco, texto e borda no verde da marca, com um halo que pulsa. É a
 * única coisa da tela que brilha, e de propósito: ela não é um campo a mais do
 * formulário, é um atalho que só existe para quem tem IA ligada. Sem o brilho
 * ela virava mais um botão secundário e ninguém descobria.
 */
function BotaoDeSugestao({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="brilha"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        marginTop: 8,
        height: "var(--h-btn-sm)",
        padding: "0 14px",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--primary)",
        background: "var(--surface)",
        color: "var(--primary)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--fw-semi)",
        fontFamily: "var(--font)",
        cursor: "pointer",
      }}
    >
      {/* Estrelas: o desenho que o sistema usa para "escrito por IA". */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3l1.9 4.7L18.6 9.6l-4.7 1.9L12 16.2l-1.9-4.7L5.4 9.6l4.7-1.9z" />
        <path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </svg>
      Pedir sugestão
    </button>
  );
}

/**
 * O contexto que a IA precisa para escrever a persona.
 *
 * ⚠️ Pede CONTEXTO, e não "gere uma persona". Sem saber o que a empresa faz e
 * como ela atende, o modelo devolve um texto que serve para qualquer negócio e
 * não descreve nenhum — e a pessoa apagaria tudo e escreveria à mão do mesmo
 * jeito, tendo gastado uma chamada paga no caminho.
 */
function PedirSugestao({
  credenciais,
  setorNome,
  onFechar,
  onPronto,
}: {
  credenciais: ConfigIA[];
  setorNome: string | null;
  onFechar: () => void;
  onPronto: (r: { descricao: string; podeResolver: string; permissoes: string[] }) => void;
}) {
  const { avisar } = useAvisos();
  const [credencialId, setCredencialId] = useState(credenciais[0]?.id ?? 0);
  const [contexto, setContexto] = useState("");
  const [pedindo, setPedindo] = useState(false);

  async function pedir() {
    if (pedindo) return;
    setPedindo(true);

    const r = await fetch("/api/v1/atendimento/personas/sugestao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credencialId, setorNome, contexto: contexto.trim() }),
    });

    setPedindo(false);
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      const detalhe = corpo?.error?.details?.[0];
      avisar(
        "atencao",
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível gerar o rascunho"),
      );
      return;
    }

    onPronto(corpo.data);
  }

  return (
    <Drawer
      open
      onClose={onFechar}
      nivel={3}
      title="Pedir sugestão"
      subtitle={setorNome ? `Persona do setor ${setorNome}` : "Persona geral"}
      acoes={
        <Button
          size="xs"
          variant="primary"
          onClick={() => void pedir()}
          disabled={pedindo || contexto.trim().length < 10 || !credencialId}
          title={contexto.trim().length < 10 ? "Conte um pouco do contexto" : undefined}
        >
          {pedindo ? "Escrevendo…" : "Gerar rascunho"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Field
          label="Chave de IA"
          hint="A chamada é cobrada nesta chave, como qualquer resposta do atendimento."
        >
          <select
            style={selectStyle}
            value={credencialId}
            onChange={(e) => setCredencialId(Number(e.target.value))}
          >
            {credenciais.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {c.modelo}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ marginTop: 18 }}>
        <label
          htmlFor="contexto"
          style={{
            display: "block",
            marginBottom: 4,
            fontSize: "var(--text-sm)",
            fontWeight: "var(--fw-semi)",
          }}
        >
          O que a IA precisa saber
        </label>

        <p
          style={{
            marginBottom: 8,
            fontSize: "calc(var(--text-xs) + 1px)",
            color: "var(--text-tertiary)",
            lineHeight: "var(--lh-normal)",
          }}
        >
          O que a empresa faz, quem escreve para este número e como você quer que ela soe. Quanto
          mais concreto, menos genérico volta.
        </p>

        <textarea
          id="contexto"
          rows={7}
          style={{ ...textareaStyle, minHeight: 130, width: "100%" }}
          placeholder={
            "Somos uma manutenção industrial em Poços de Caldas. Quem escreve aqui é o financeiro do cliente, quase sempre para saber de parcela ou pedir segunda via. Queremos um tom direto, educado e sem jargão."
          }
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
        />
      </div>

      <p
        style={{
          marginTop: 16,
          fontSize: "calc(var(--text-xs) + 1px)",
          color: "var(--text-tertiary)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        O que voltar cai nos campos para você revisar. Nada é salvo até você clicar em Salvar, e a
        IA nunca é autorizada a falar de valor, vencimento ou boleto fora das consultas marcadas em
        Permissões.
      </p>
    </Drawer>
  );
}
