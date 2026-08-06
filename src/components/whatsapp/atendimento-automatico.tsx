"use client";

import { useState } from "react";
import { PrecisaDeAjuda } from "@/components/ui/ajuda";
import { Drawer } from "@/components/ui/drawer";
import { useAvisos } from "@/components/ui/avisos";
import {
  AcoesDaLinha,
  ActiveToggle,
  Alert,
  Badge,
  BotaoDeAcao,
  Button,
  EmptyRow,
  Pagination,
  Field,
  CabecalhoDeSecao,
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
  CONFIG_IA_PADRAO,
  MODELOS_POR_PROVEDOR,
  PROVEDORES,
  type ConfigIA,
} from "@/modules/ia/ia.types";
import type { Persona } from "@/modules/atendimento/personas.types";
import { formatarTelefone, type ContaWhatsapp } from "@/modules/whatsapp/whatsapp.types";

/**
 * Atendimento automatico: o estado, os provedores e quem recebe resposta.
 *
 * ⚠️ O `Alert` do topo nao e enfeite: e a resposta a unica pergunta que traz
 * alguem a esta tela, que e "por que o bot nao respondeu?". Ele vem ANTES dos
 * cadastros porque a causa quase sempre e estado — sem chave, desligado, ou
 * preso na trava de teste — e nao configuracao errada.
 *
 * Personas moram na aba ao lado. Empilhadas aqui, viravam a terceira tabela de
 * uma rolagem so, e as tres pareciam a mesma coisa.
 */

/** Mesmo tamanho de pagina da aba de numeros: as tres listas convivem. */
const POR_PAGINA = 8;

export function AtendimentoAutomatico({
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

  async function remover(provedor: string) {
    const r = await fetch(`/api/v1/ia/provedores/${provedor}`, { method: "DELETE" });

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
      {erro && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="danger" title="Não foi possível carregar">
            {erro}
          </Alert>
        </div>
      )}

      {/*
        ⚠️ Aviso e EXCECAO, nao placar.
        
        Um `Alert` verde dizendo "esta tudo bem" a cada visita ensina a ignorar
        a caixa, e ai o dia em que ela ficar ambar tambem passa batido. Estando
        tudo certo, a tabela abaixo ja mostra quem esta ativo.
      */}
      {provedores != null && ligados.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert variant="warning" title="Sem provedor ativo, o bot não responde">
            Cadastre uma chave e deixe pelo menos um provedor ligado.
          </Alert>
        </div>
      )}

      <CabecalhoDeSecao
        titulo="Provedores de IA"
        legenda="A chave que faz o atendimento automático funcionar. O de ordem 1 responde; os outros existem para o dia em que ele estiver fora do ar ou sem cota, e são tentados na sequência. Quem recebe resposta é decidido em cada número, na aba Números."
        onIncluir={() =>
          setEditando({ ...CONFIG_IA_PADRAO, ordem: (provedores?.length ?? 0) + 1 })
        }
        rotuloIncluir="Adicionar provedor"
      />

        <TableArea minWidth={0}>
          <TableHead>
                <Th>Provedor</Th>
                <Th>Situação</Th>
          <Th> </Th>
          </TableHead>

            <tbody>
              {provedores == null ? (
                <EmptyRow colSpan={3} message="Carregando…" />
              ) : visiveis!.length === 0 ? (
                <EmptyRow
                  colSpan={3}
                  message="Nenhum provedor. Sem chave, o bot não responde a ninguém."
                />
              ) : (
                visiveis!.map((p) => (
                  <Tr key={p.provedor}>
                    {/*
                      Provedor e modelo na MESMA celula, um sob o outro: e a
                      anatomia dos cartoes de conversa, e evita a tabela de seis
                      colunas que ninguem le da esquerda para a direita.
                    */}
                    <Td>
                      {/* ⚠️ Flag SEMPRE depois do titulo: quem le procura o
                          nome primeiro, e a etiqueta na frente empurra o nome
                          para uma posicao que muda a cada linha. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: "var(--fw-semi)" }}>
                          {PROVEDORES.find((x) => x.valor === p.provedor)?.rotulo ?? p.provedor}
                        </span>
                        <Badge tom={p.ordem === 1 ? "info" : "neutral"}>
                          {p.ordem === 1 ? "principal" : `reserva ${p.ordem}`}
                        </Badge>
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: "var(--text-xs)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {p.modelo}
                      </div>
                    </Td>

                    <Td>
                      {!p.temChave ? (
                        <Badge tom="danger">falta a chave</Badge>
                      ) : p.ativo ? (
                        <Badge tom="success">ativo</Badge>
                      ) : (
                        <Badge tom="neutral">desligado</Badge>
                      )}
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                        </BotaoDeAcao>
                        <BotaoDeAcao rotulo="Remover" onClick={() => void remover(p.provedor)}>
                          <path d="M3.4 4.6h9.2M6.4 4.6V3.4h3.2v1.2M5 4.6l.5 8.4h5l.5-8.4" />
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
        total={provedores?.length ?? 0}
        pageSize={POR_PAGINA}
        onPage={setPagina}
      />

      <PrecisaDeAjuda
        duvidas={[
          {
            pergunta: "O bot não está respondendo",
            resposta:
              "São três coisas, nesta ordem: existe provedor ativo com chave? O número que recebeu a mensagem está com responder a todos ligado, ou com aquele contato na lista? E alguém da equipe respondeu à mão nas últimas duas horas, o que cala o bot de propósito?",
          },
          {
            pergunta: "Para que serve mais de um provedor?",
            resposta:
              "Provedor cai, estoura cota e recusa conteúdo. Com uma chave só, qualquer um dos três para o atendimento inteiro. O de ordem 1 responde, e os outros são tentados na sequência quando ele falha.",
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

  // Já cadastrado significa que há chave no vault: em branco mantém, não apaga.
  const jaTemChave = existentes.some((p) => p.provedor === rascunho.provedor && p.temChave);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);

    const r = await fetch("/api/v1/ia/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provedor: rascunho.provedor,
        modelo: rascunho.modelo.trim(),
        ativo: rascunho.ativo,
        ordem: rascunho.ordem,
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

  return (
    <Drawer
      open
      onClose={onFechar}
      title={jaTemChave ? "Editar provedor" : "Adicionar provedor"}
      subtitle="A chave fica cifrada e nunca volta para a tela"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || (!jaTemChave && chave.trim().length < 20)}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <Field label="Provedor">
        <select
          style={selectStyle}
          value={rascunho.provedor}
          onChange={(e) => {
            const provedor = e.target.value as ConfigIA["provedor"];
            const padrao = PROVEDORES.find((p) => p.valor === provedor)?.modeloPadrao ?? "";
            /*
             * Troca o modelo junto: `gpt-5-mini` não existe no Gemini, e manter
             * o antigo produziria erro só no primeiro atendimento de verdade.
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

      <Field label="Modelo" hint="A lista é sugestão: modelo novo pode ser digitado direto.">
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

      <Field label="Ordem" hint="1 responde. Os demais são tentados quando ele falha.">
        <input
          style={inputStyle}
          type="number"
          min={1}
          max={9}
          value={rascunho.ordem}
          onChange={(e) => setRascunho({ ...rascunho, ordem: Number(e.target.value) || 1 })}
        />
      </Field>

      <Field
        label="Chave da API"
        required={!jaTemChave}
        hint={jaTemChave ? "Em branco mantém a atual." : undefined}
      >
        <input
          style={inputStyle}
          type="password"
          autoComplete="off"
          placeholder={jaTemChave ? "Deixe em branco para manter" : "cole a chave"}
          value={chave}
          onChange={(e) => setChave(e.target.value)}
        />
      </Field>

      <Field label="Ativo" hint="Desligado, este provedor não é tentado.">
        <ActiveToggle
          active={rascunho.ativo}
          onChange={() => setRascunho({ ...rascunho, ativo: !rascunho.ativo })}
        />
      </Field>
    </Drawer>
  );
}

// ── Personas ────────────────────────────────────────────────────

export type Setor = { id: number; nome: string };

/**
 * O que a IA pode resolver sozinha, por setor.
 *
 * ⚠️ Sem persona para um setor, o comportamento continua sendo encaminhar.
 * Persona e autorizacao, nao obrigacao: quem nao cadastra nenhuma segue com o
 * bot que so tria e passa adiante.
 */
export function Personas({
  contas,
  personas,
  setores,
  onRecarregar,
}: {
  contas: ContaWhatsapp[];
  /** ⚠️ De fora, pelo mesmo motivo dos provedores: a aba desmonta. */
  personas: Persona[] | null;
  setores: Setor[];
  onRecarregar: () => void;
}) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Persona | null>(null);
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil((personas?.length ?? 0) / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis =
    personas?.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA) ?? null;

  async function excluir(id: number) {
    const r = await fetch(`/api/v1/atendimento/personas/${id}`, { method: "DELETE" });

    if (!r.ok) {
      const corpo = await r.json().catch(() => null);
      avisar("atencao", corpo?.error?.message ?? "Não foi possível excluir");
      return;
    }

    avisar("sucesso", "Persona excluída.");
    onRecarregar();
  }

  if (editando) {
    return (
      <FormularioDaPersona
        persona={editando}
        setores={setores}
        contas={contas}
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
        onIncluir={() =>
          setEditando({
            id: 0,
            contaId: null,
            setorId: null,
            nome: "",
            descricao: null,
            podeResolver: null,
            ativo: true,
          })
        }
        rotuloIncluir="Adicionar persona"
      />

        <TableArea minWidth={0}>
          <TableHead>
                <Th>Persona</Th>
                <Th>Onde vale</Th>
          <Th> </Th>
          </TableHead>

            <tbody>
              {personas == null ? (
                <EmptyRow colSpan={3} message="Carregando…" />
              ) : visiveis!.length === 0 ? (
                <EmptyRow
                  colSpan={3}
                  message="Nenhuma persona. A IA vai triar e encaminhar tudo."
                />
              ) : (
                visiveis!.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: "var(--fw-semi)" }}>{p.nome}</span>
                        {!p.ativo && <Badge tom="neutral">desligada</Badge>}
                      </div>
                      {/* O que ela resolve, cortado em uma linha: e o que
                          distingue duas personas do mesmo setor. */}
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
                        {contas.find((c) => c.id === p.contaId)?.apelido ??
                          (p.contaId
                            ? formatarTelefone(
                                contas.find((c) => c.id === p.contaId)?.numero ?? "",
                              )
                            : "Todos os números")}
                      </div>
                    </Td>

                    <Td>
                      <AcoesDaLinha>
                        <BotaoDeAcao rotulo="Editar" onClick={() => setEditando(p)}>
                          <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                        </BotaoDeAcao>
                        <BotaoDeAcao rotulo="Excluir" onClick={() => void excluir(p.id)}>
                          <path d="M3.4 4.6h9.2M6.4 4.6V3.4h3.2v1.2M5 4.6l.5 8.4h5l.5-8.4" />
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
        total={personas?.length ?? 0}
        pageSize={POR_PAGINA}
        onPage={setPagina}
      />

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
            pergunta: "Não aparece nenhum setor na lista",
            resposta:
              "A persona pode ficar geral, sem setor, e vale para tudo que não tiver persona própria. Setor é cadastro à parte e ainda não tem tela própria.",
          },
        ]}
      />
    </>
  );
}

function FormularioDaPersona({
  persona,
  setores,
  contas,
  onFechar,
  onSalvou,
}: {
  persona: Persona;
  setores: Setor[];
  contas: ContaWhatsapp[];
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [rascunho, setRascunho] = useState(persona);
  const [salvando, setSalvando] = useState(false);

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

  return (
    <Drawer
      open
      onClose={onFechar}
      title={rascunho.id ? "Editar persona" : "Nova persona"}
      subtitle="Nunca autoriza dizer valor, vencimento ou boleto"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || rascunho.nome.trim().length < 2}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <Field label="Nome" required hint="Só para você identificar aqui dentro.">
        <input
          style={inputStyle}
          value={rascunho.nome}
          onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
        />
      </Field>

      <Field label="Setor" hint="Vazio vale para o que não tiver persona própria.">
        <select
          style={selectStyle}
          value={rascunho.setorId ?? ""}
          onChange={(e) =>
            setRascunho({ ...rascunho, setorId: e.target.value ? Number(e.target.value) : null })
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
            setRascunho({ ...rascunho, contaId: e.target.value ? Number(e.target.value) : null })
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

      <Field
        label="Quem ela é"
        hint="O jeito de falar. Ex.: direta e prática, evita jargão, confirma antes de encerrar."
      >
        <textarea
          style={{ ...textareaStyle, minHeight: 80 }}
          value={rascunho.descricao ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
        />
      </Field>

      <Field
        label="Pode resolver"
        hint="Um item por linha. Fora dessa lista, ela encaminha."
      >
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
    </Drawer>
  );
}
