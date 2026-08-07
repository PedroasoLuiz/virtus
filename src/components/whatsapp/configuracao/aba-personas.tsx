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
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  inputStyle,
  selectStyle,
  textareaStyle,
} from "@/components/ui/kit";
import type { Persona } from "@/modules/atendimento/personas.types";
import { formatarTelefone, type ContaWhatsapp } from "@/modules/whatsapp/whatsapp.types";

/**
 * O que a IA pode resolver sozinha, por setor.
 *
 * ⚠️ Sem persona para um setor, o comportamento continua sendo encaminhar.
 * Persona e autorizacao, nao obrigacao.
 */

const POR_PAGINA = 10;

export type Setor = { id: number; nome: string };

export function AbaDePersonas({
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
      acoes={
        <Button
          size="xs"
          variant="primary"
          onClick={() => void salvar()}
          disabled={salvando || rascunho.nome.trim().length < 2}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
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
