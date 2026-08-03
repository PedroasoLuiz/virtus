"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/kit";

/**
 * Drawer de formulario.
 *
 * Concentra o que todo cadastro repete: envio, estado de "salvando", exibicao
 * de erro da API e refresh da listagem ao fechar. A tela concreta so descreve
 * os campos.
 *
 * Largura 540 por padrao — mesma do SIC para formulario; 720 fica para tela de
 * detalhe, que tem tabela dentro.
 */
export function FormDrawer<T>({
  aberto,
  titulo,
  subtitulo,
  onClose,
  valores,
  url,
  metodo,
  children,
  larguraDrawer = 540,
  podeSalvar = true,
  aoSalvar,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  /** Corpo enviado. Montado pela tela a partir do seu proprio estado. */
  valores: () => T;
  url: string;
  metodo: "POST" | "PATCH";
  children: React.ReactNode;
  larguraDrawer?: number;
  podeSalvar?: boolean;
  aoSalvar?: () => void;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);

    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores()),
      });

      const corpo = await resposta.json().catch(() => null);

      if (!resposta.ok) {
        // `details` traz o campo que o Zod recusou; mostrar so "Dados
        // invalidos" obrigaria o usuario a adivinhar qual.
        const detalhe = corpo?.error?.details?.[0];
        setErro(
          detalhe
            ? `${detalhe.campo}: ${detalhe.mensagem}`
            : (corpo?.error?.message ?? "Nao foi possivel salvar."),
        );
        return;
      }

      aoSalvar?.();
      onClose();
      // Recarrega os dados do servidor para a linha aparecer atualizada.
      router.refresh();
    } catch {
      setErro("Falha de conexao. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Drawer
      open={aberto}
      onClose={onClose}
      title={titulo}
      subtitle={subtitulo}
      width={larguraDrawer}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {erro && (
            <span
              role="alert"
              style={{
                flex: 1,
                fontSize: "var(--text-sm)",
                color: "var(--danger-text)",
                lineHeight: "var(--lh-snug)",
              }}
            >
              {erro}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Button size="sm" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={salvar}
              disabled={salvando || !podeSalvar}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </Drawer>
  );
}
