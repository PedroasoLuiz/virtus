"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import {
  Button,
  CampoNumerico,
  Field,
  Formulario,
  GrupoDeCampos,
  inputStyle,
  selectStyle,
  SeletorBuscavel,
} from "@/components/ui/kit";
import { useAvisos } from "@/components/ui/avisos";

/**
 * Cadastro de cartão.
 *
 * ⚠️ NÃO há campo de CVV, e não deve haver. Armazenar CVV é proibido pelo
 * PCI-DSS sem exceção — nem cifrado, nem com consentimento. Ele existe para
 * autorizar uma transação no momento dela, e o sistema não transaciona.
 *
 * ⚠️ E o número são só os 4 ÚLTIMOS dígitos. É o que basta para dizer qual
 * cartão é; o PAN completo exigiria cifragem e controle de acesso que este
 * sistema não tem. O servidor recorta de novo, porque limite de tela é
 * conveniência e não garantia.
 */

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "Outra"];

type Conta = { id: number; nome: string };
type Banco = { id: number; codigo: string; nome: string };

export function NovoCartaoDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { avisar } = useAvisos();

  const [apelido, setApelido] = useState("");
  const [bandeira, setBandeira] = useState("");
  const [ultimosDigitos, setUltimosDigitos] = useState("");
  const [diaFechamento, setDiaFechamento] = useState(1);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [limite, setLimite] = useState(0);

  const [bancoId, setBancoId] = useState<number | null>(null);
  const [nomeDoBanco, setNomeDoBanco] = useState<string | null>(null);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [contaBancariaId, setContaBancariaId] = useState("");
  const [contas, setContas] = useState<Conta[]>([]);

  const [salvando, setSalvando] = useState(false);

  /*
   * A busca filtra a lista JA CARREGADA, e nao vai ao servidor a cada tecla.
   *
   * São 52 bancos do sistema mais os da empresa: a lista inteira cabe numa
   * resposta, e filtrar em memória responde na hora. Uma consulta por tecla
   * gastaria ida e volta para um conjunto que não muda.
   */
  const buscarBancos = useCallback(
    async (termo: string) => {
      const alvo = termo.trim().toLowerCase();

      return bancos
        // Acha pelo NOME e pelo CÓDIGO: quem sabe "237" digita 237.
        .filter((b) => !alvo || b.nome.toLowerCase().includes(alvo) || b.codigo.includes(alvo))
        .slice(0, 20)
        .map((b) => ({ id: b.id, nome: `${b.codigo} · ${b.nome}` }));
    },
    [bancos],
  );

  useEffect(() => {
    const controle = new AbortController();

    fetch("/api/v1/bancos", { signal: controle.signal })
      .then(async (r) => {
        if (!r.ok) return;
        const corpo = await r.json();
        setBancos((corpo.data ?? []) as Banco[]);
      })
      .catch(() => {
        // Silencioso: sem a lista o campo obrigatório já trava o salvar.
      });

    fetch("/api/v1/contas-bancarias", { signal: controle.signal })
      .then(async (r) => {
        const corpo = await r.json();
        if (r.ok) setContas(corpo.data);
      })
      .catch(() => {
        // Silencioso: a conta de débito é opcional.
      });

    return () => controle.abort();
  }, []);

  const motivoTravado =
    apelido.trim().length === 0
      ? "Dê um apelido ao cartão"
      : !bancoId
        ? "Escolha o banco emissor"
        : undefined;

  async function criar() {
    setSalvando(true);

    const r = await fetch("/api/v1/contas-pagar/cartoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apelido: apelido.trim(),
        bandeira: bandeira || null,
        ultimosDigitos: ultimosDigitos.replace(/\D/g, "").slice(-4) || null,
        diaFechamento,
        diaVencimento,
        limite,
        bancoId,
        contaBancariaId: contaBancariaId ? Number(contaBancariaId) : null,
      }),
    });

    const dados = await r.json().catch(() => null);
    setSalvando(false);

    if (!r.ok) {
      avisar("atencao", dados?.error?.message ?? "Não foi possível criar o cartão");
      return;
    }

    avisar("sucesso", "Cartão cadastrado");
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Novo cartão"
      acoes={
        <span title={motivoTravado}>
          <Button size="xs" variant="primary" disabled={salvando || !!motivoTravado} onClick={criar}>
            {salvando ? "Criando…" : "Criar cartão"}
          </Button>
        </span>
      }
    >
      <Formulario>
        <GrupoDeCampos
          primeiro
          titulo="Qual cartão é"
          legenda="O apelido é como ele aparece nas telas. Os quatro dígitos servem para distinguir dois cartões do mesmo banco."
        >
          <Field label="Apelido" required>
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              maxLength={255}
              placeholder="Cartão empresarial, Nubank PJ"
              style={inputStyle}
            />
          </Field>

          <Field label="Bandeira">
            <select
              value={bandeira}
              onChange={(e) => setBandeira(e.target.value)}
              style={selectStyle}
            >
              <option value="">Não informar</option>
              {BANDEIRAS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          {/*
            ⚠️ QUATRO dígitos, e o campo nem aceita mais. O número completo do
            cartão não é guardado aqui, e o CVV não é guardado em lugar nenhum.
          */}
          <Field
            label="4 últimos dígitos"
            hint="Só isto. O número completo e o CVV não são guardados pelo sistema."
          >
            <input
              value={ultimosDigitos}
              onChange={(e) => setUltimosDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              style={{ ...inputStyle, width: 110 }}
            />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="O ciclo"
          legenda="Compra feita depois do fechamento entra na fatura seguinte. É o que o cartão faz, e o sistema diz o mesmo."
        >
          <Field label="Dia do fechamento" required>
            <input
              type="number"
              min={1}
              max={31}
              value={diaFechamento}
              onChange={(e) =>
                setDiaFechamento(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
              }
              style={inputStyle}
            />
          </Field>

          <Field
            label="Dia do vencimento"
            hint="Menor que o fechamento significa vencer no mês seguinte."
          >
            <input
              type="number"
              min={1}
              max={31}
              value={diaVencimento}
              onChange={(e) =>
                setDiaVencimento(Math.min(31, Math.max(1, Number(e.target.value) || 1)))
              }
              style={inputStyle}
            />
          </Field>

          <Field label="Limite">
            <CampoNumerico valor={limite} escala={100} aoMudar={setLimite} />
          </Field>
        </GrupoDeCampos>

        <GrupoDeCampos
          titulo="Quem emite"
          legenda="A instituição do cartão. É ela que cobra a fatura, e não o fornecedor das compras."
        >
          {/*
            ⚠️ Escolhe-se o BANCO, e não um fornecedor. O banco é o que a pessoa
            sabe; o cadastro que recebe o dinheiro é detalhe contábil, e o
            fechamento da fatura o resolve sozinho — achando o cadastro pelo nome
            do banco, ou criando um. Pedir o fornecedor aqui seria a mesma
            informação duas vezes.

            A lista traz os bancos do sistema mais os que a empresa cadastrou.
          */}
          <Field label="Emissor" required hint="A lista traz os bancos do sistema e os seus.">
            <SeletorBuscavel
              valor={bancoId}
              rotulo={nomeDoBanco}
              placeholder="Digite o nome ou o código"
              buscar={buscarBancos}
              aoEscolher={(b) => {
                setBancoId(b?.id ?? null);
                setNomeDoBanco(b?.nome ?? null);
              }}
            />
          </Field>

          {/*
            ⚠️ A conta de débito é só uma anotação, e não entra na baixa. Baixar
            no cartão não tira do saldo de conta nenhuma: o dinheiro sai quando a
            conta a pagar da fatura for paga, e ali se escolhe de onde.
          */}
          <Field
            label="Conta de débito"
            hint="Onde a fatura costuma ser paga. Não afeta o saldo: quem decide é a baixa da fatura."
          >
            <select
              value={contaBancariaId}
              onChange={(e) => setContaBancariaId(e.target.value)}
              style={selectStyle}
            >
              <option value="">Não informar</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Field>
        </GrupoDeCampos>
      </Formulario>
    </Drawer>
  );
}
