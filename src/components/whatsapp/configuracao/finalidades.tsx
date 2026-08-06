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
  PanelTabs,
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

type Aba = "Parametrização" | "Exibição";

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
  if (!vinculo) {
    return (
      <Badge tom="neutral">
        <Relogio />
        não configurado
      </Badge>
    );
  }

  if (carregando) {
    return (
      <Badge tom="neutral">
        <Relogio />
        conferindo
      </Badge>
    );
  }

  if (!modelo) {
    return (
      <Badge tom="danger">
        <Atencao />
        modelo não aprovado
      </Badge>
    );
  }

  if (vinculo.parametros.length !== modelo.parametros) {
    return (
      <Badge tom="danger">
        <Atencao />
        o modelo mudou
      </Badge>
    );
  }

  return (
    <Badge tom="success">
      <Certo />
      pronto
    </Badge>
  );
}

/*
 * Os símbolos da situação.
 *
 * ⚠️ Formas diferentes, e não a mesma bolinha em três cores: quem enxerga pouca
 * diferença entre vermelho e cinza continua lendo o relógio como "falta fazer"
 * e o certo como "feito". A cor é reforço, não o único sinal.
 */
const TRACO = {
  width: 11,
  height: 11,
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { flexShrink: 0 },
  "aria-hidden": true,
};

function Certo() {
  return (
    <svg {...TRACO}>
      <path d="M3.6 10.6l4 4 8.8-9.2" />
    </svg>
  );
}

function Relogio() {
  return (
    <svg {...TRACO}>
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 5.8V10l2.8 1.8" />
    </svg>
  );
}

function Atencao() {
  return (
    <svg {...TRACO}>
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 6.2v4.4M10 13.4v.1" />
    </svg>
  );
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
  const [aba, setAba] = useState<Aba>("Parametrização");

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
      {/*
        ⚠️ Duas abas, e não uma pilha só.

        Parametrização é onde se DECIDE; Exibição é onde se CONFERE. Numa
        coluna única, a prévia e o dicionário ficavam abaixo dos seletores, e
        justamente quem estava mapeando precisava rolar para conferir e voltar
        para corrigir. Separadas, cada aba responde a uma pergunta inteira.
      */}
      <PanelTabs
        tabs={["Parametrização", "Exibição"]}
        active={aba}
        onChange={(t) => setAba(t as Aba)}
      />

      {aba === "Parametrização" && (
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
          </>
        )}

        {vinculo && <Desfazer onRemover={remover} ocupado={salvando} />}
      </div>
      )}

      {aba === "Exibição" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <Secao
            primeiro
            titulo="Como vai chegar"
            legenda="O seu texto com os valores de exemplo no lugar. É assim que o cliente vê."
          >
            {modelo ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius-lg)",
                  /*
                    ⚠️ Em camadas, e não `backgroundColor` direto.

                    `--kanban-coluna-bg` é translúcido (alfa 0.35): sozinho, ele
                    deixa passar o branco do drawer e some. Sobre uma base
                    sólida, ele rende a mesma cor das colunas do quadro, que é
                    onde essa cor já quer dizer "fundo de conteúdo".
                  */
                  background:
                    "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--lh-normal)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {comFormatacaoDoWhatsapp(previaDoCorpo(modelo.corpo, exemplos))}
              </div>
            ) : (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                Escolha o modelo em Parametrização para ver como a mensagem fica.
              </p>
            )}
          </Secao>

          <Dicionario finalidade={finalidade} parametros={parametros} botao={botao} />
        </div>
      )}
    </Drawer>
  );
}

/**
 * Desfazer o vínculo, atrás de uma sanfona.
 *
 * ⚠️ Fechada por padrão, pelo mesmo motivo do excluir chave: não é o que se vem
 * fazer aqui, e aberta ficaria a um clique de distância de salvar.
 */
function Desfazer({ onRemover, ocupado }: { onRemover: () => void; ocupado: boolean }) {
  const [aberta, setAberta] = useState(false);

  return (
    <section style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
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

      {aberta && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={onRemover}
            disabled={ocupado}
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
              lineHeight: "var(--lh-normal)",
            }}
          >
            O modelo continua aprovado na Meta. O que para é o envio desta finalidade, que passa a
            falhar dizendo que falta configurar.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * O que cada variável significa, e onde ela caiu.
 *
 * ⚠️ Não é um glossário parado. A etiqueta da esquerda mostra em QUAL marcador
 * a variável foi usada, ou que ela ficou de fora — o que transforma a lista num
 * conferidor do mapeamento feito logo acima. Sem isso, descobrir que o valor
 * ficou sem lugar exigia contar os seletores de novo.
 */
function Dicionario({
  finalidade,
  parametros,
  botao,
}: {
  finalidade: Finalidade;
  parametros: string[];
  botao: string | null;
}) {
  const todas = finalidade.botao
    ? [...finalidade.variaveis, finalidade.botao]
    : finalidade.variaveis;

  function ondeEntra(chave: string): { rotulo: string; usada: boolean } {
    const i = parametros.indexOf(chave);
    if (i >= 0) return { rotulo: `{{${i + 1}}}`, usada: true };
    if (botao === chave) return { rotulo: "botão", usada: true };
    return { rotulo: "sem uso", usada: false };
  }

  return (
    <Secao
      titulo="O que o sistema tem para dar"
      legenda="São os únicos valores que esta finalidade sabe preencher. O que não estiver aqui precisa ser texto fixo dentro do seu modelo."
    >
      <dl style={{ display: "grid", gap: 0, margin: 0 }}>
        {todas.map((v, i) => {
          const onde = ondeEntra(v.chave);

          return (
            <div
              key={v.chave}
              style={{
                display: "flex",
                gap: 10,
                padding: "10px 0",
                borderTop: i === 0 ? "1px solid var(--border)" : "none",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/*
                Largura fixa: as etiquetas empilham numa coluna só, e o olho
                desce por elas procurando o "sem uso" sem ler o resto.
              */}
              <span
                style={{
                  flexShrink: 0,
                  width: 62,
                  paddingTop: 1,
                  fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono, monospace)",
                  color: onde.usada ? "var(--primary)" : "var(--text-tertiary)",
                }}
              >
                {onde.rotulo}
              </span>

              <div style={{ minWidth: 0 }}>
                <dt style={{ fontSize: "var(--text-sm)", fontWeight: "var(--fw-semi)" }}>
                  {v.rotulo}
                </dt>
                <dd
                  style={{
                    margin: "3px 0 0",
                    fontSize: "calc(var(--text-xs) + 1px)",
                    color: "var(--text-tertiary)",
                    lineHeight: "var(--lh-normal)",
                  }}
                >
                  {v.descricao}
                </dd>

                {/* O exemplo com a cara de dado, e não de continuação da frase. */}
                <dd
                  style={{
                    display: "inline-block",
                    margin: "6px 0 0",
                    padding: "2px 7px",
                    borderRadius: "var(--radius-full)",
                    background:
                      "linear-gradient(var(--kanban-coluna-bg), var(--kanban-coluna-bg)), var(--sidebar-bg)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {v.exemplo}
                </dd>
              </div>
            </div>
          );
        })}
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
