"use client";

import { useState } from "react";
import { useAvisos } from "@/components/ui/avisos";
import { Drawer } from "@/components/ui/drawer";
import { comFormatacaoDoWhatsapp } from "@/components/whatsapp/formatacao";
import {
  Badge,
  BotaoDeAcao,
  Button,
  CabecalhoDeSecao,
  Field,
  TableArea,
  TableHead,
  Td,
  Th,
  Tr,
  selectStyle,
} from "@/components/ui/kit";
import {
  FINALIDADES,
  previaDoCorpo,
  type Finalidade,
  type VinculoDeModelo,
} from "@/modules/whatsapp/finalidades";
import type { Modelo } from "@/modules/whatsapp/whatsapp.types";

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

export function Finalidades({
  contaId,
  modelos,
  vinculos,
  onMudou,
}: {
  contaId: number;
  /** Os aprovados deste número, já lidos da Meta. Nulo enquanto carregam. */
  modelos: Modelo[] | null;
  vinculos: VinculoDeModelo[] | null;
  onMudou: () => void;
}) {
  const [editando, setEditando] = useState<Finalidade | null>(null);

  return (
    <>
      <CabecalhoDeSecao
        titulo="O que o sistema envia"
        legenda="Cada item aqui é uma mensagem que o sistema dispara. Você aprova o modelo com o texto que quiser no painel da Meta e diz, aqui, qual campo dele recebe o quê. Sem esse vínculo, o envio não acontece."
      />

      <TableArea minWidth={0}>
        <TableHead>
          <Th>Finalidade</Th>
          <Th>Modelo vinculado</Th>
          <Th minWidth={90}>Situação</Th>
          <Th> </Th>
        </TableHead>

        <tbody>
          {FINALIDADES.map((f) => {
            const v = vinculos?.find((x) => x.finalidade === f.id) ?? null;
            const modelo = v ? (modelos?.find((m) => m.nome === v.modeloNome) ?? null) : null;

            return (
              <Tr key={f.id}>
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
                    <span style={{ fontFamily: "var(--font-mono, monospace)" }}>{v.modeloNome}</span>
                  ) : (
                    <span style={{ color: "var(--text-tertiary)" }}>nenhum</span>
                  )}
                </Td>

                <Td>
                  <SituacaoDoVinculo vinculo={v} modelo={modelo} carregando={modelos == null} />
                </Td>

                <Td>
                  <BotaoDeAcao rotulo="Configurar" onClick={() => setEditando(f)}>
                    <path d="M11.6 2.6a1.6 1.6 0 0 1 2.3 2.3L5.6 13.2l-3 .7.7-3z" />
                  </BotaoDeAcao>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </TableArea>

      {editando && (
        <FormularioDoVinculo
          contaId={contaId}
          finalidade={editando}
          modelos={modelos ?? []}
          vinculo={vinculos?.find((x) => x.finalidade === editando.id) ?? null}
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

/**
 * ⚠️ "Vinculado" não basta: o modelo pode ter saído de aprovado, ou ganhado
 * mais um campo, depois do vínculo. Quem só olha a tela precisa ver isso antes
 * de descobrir por um envio que falhou.
 */
function SituacaoDoVinculo({
  vinculo,
  modelo,
  carregando,
}: {
  vinculo: VinculoDeModelo | null;
  modelo: Modelo | null;
  carregando: boolean;
}) {
  if (!vinculo) return <Badge tom="neutral">não configurado</Badge>;
  if (carregando) return <span style={{ color: "var(--text-tertiary)" }}>conferindo…</span>;
  if (!modelo) return <Badge tom="danger">modelo não aprovado</Badge>;

  if (vinculo.parametros.length !== modelo.parametros) {
    return <Badge tom="danger">o modelo mudou</Badge>;
  }

  return <Badge tom="success">pronto</Badge>;
}

function FormularioDoVinculo({
  contaId,
  finalidade,
  modelos,
  vinculo,
  onFechar,
  onSalvou,
}: {
  contaId: number;
  finalidade: Finalidade;
  modelos: Modelo[];
  vinculo: VinculoDeModelo | null;
  onFechar: () => void;
  onSalvou: () => void;
}) {
  const { avisar } = useAvisos();
  const [nome, setNome] = useState(vinculo?.modeloNome ?? "");
  const [parametros, setParametros] = useState<string[]>(vinculo?.parametros ?? []);
  const [botao, setBotao] = useState<string | null>(vinculo?.botaoParam ?? null);
  const [salvando, setSalvando] = useState(false);

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
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void salvar()}
            disabled={salvando || faltando}
            title={faltando ? "Escolha o modelo e o que entra em cada campo" : undefined}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Secao
          primeiro
          titulo="O modelo"
          legenda={`${finalidade.descricao} Escolha um dos seus modelos aprovados neste número.`}
        >
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

        {!nome && (
          <Sugestao finalidade={finalidade} />
        )}

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

              {finalidade.botao && (
                <Field
                  label="Botão do modelo"
                  hint={finalidade.botao.descricao}
                >
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
            </Secao>

            <Secao
              titulo="Como vai chegar"
              legenda="O seu texto com os valores de exemplo no lugar. É assim que o cliente vê."
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--kanban-coluna-bg)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--lh-normal)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {comFormatacaoDoWhatsapp(previaDoCorpo(modelo.corpo, exemplos))}
              </div>
            </Secao>
          </>
        )}

        <Dicionario finalidade={finalidade} />

        {vinculo && (
          <div>
            <button
              type="button"
              onClick={() => void remover()}
              disabled={salvando}
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
              }}
            >
              O modelo continua aprovado na Meta. O que para é o envio automático desta finalidade.
            </p>
          </div>
        )}
      </div>
    </Drawer>
  );
}

/** O que cada variável significa, com exemplo. Vale para criar o modelo lá. */
function Dicionario({ finalidade }: { finalidade: Finalidade }) {
  const todas = finalidade.botao
    ? [...finalidade.variaveis, finalidade.botao]
    : finalidade.variaveis;

  return (
    <Secao
      titulo="O que o sistema tem para dar"
      legenda="Estes são os únicos valores que esta finalidade sabe preencher. O que não estiver aqui precisa ser texto fixo no modelo."
    >
      <dl style={{ display: "grid", gap: 10, margin: 0 }}>
        {todas.map((v) => (
          <div key={v.chave}>
            <dt style={{ fontSize: "var(--text-sm)", fontWeight: "var(--fw-semi)" }}>{v.rotulo}</dt>
            <dd
              style={{
                margin: "2px 0 0",
                fontSize: "calc(var(--text-xs) + 1px)",
                color: "var(--text-tertiary)",
                lineHeight: "var(--lh-normal)",
              }}
            >
              {v.descricao} Exemplo: <strong style={{ color: "var(--text-secondary)" }}>{v.exemplo}</strong>
            </dd>
          </div>
        ))}
      </dl>
    </Secao>
  );
}

/** Um corpo pronto para copiar no painel da Meta, para quem ainda não tem. */
function Sugestao({ finalidade }: { finalidade: Finalidade }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Secao
      titulo="Não tem um modelo para isto?"
      legenda="Crie no painel da Meta com o texto abaixo, ou escreva o seu. Depois que a Meta aprovar, ele aparece na lista acima."
    >
      <div
        style={{
          padding: "10px 12px",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--kanban-coluna-bg)",
          fontSize: "var(--text-sm)",
          lineHeight: "var(--lh-normal)",
        }}
      >
        {finalidade.corpoSugerido}
      </div>

      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(finalidade.corpoSugerido);
          setCopiado(true);
        }}
        style={{
          marginTop: 8,
          border: "none",
          background: "transparent",
          padding: 0,
          fontSize: "var(--text-sm)",
          color: "var(--primary)",
          cursor: "pointer",
        }}
      >
        {copiado ? "Copiado" : "Copiar o texto"}
      </button>
    </Secao>
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
