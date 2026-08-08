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
 * ⚠️ A largura e a MESMA de todo drawer do sistema, e nao uma so para formulario.
 * Havia um 540 aqui contra os 620 do resto: abrir a ficha de uma pessoa e depois
 * o endereco dela fazia a segunda tela nascer mais estreita que a primeira, sem
 * nada que explicasse a diferenca. Quem quiser outra largura pede explicitamente.
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
  larguraDrawer,
  podeSalvar = true,
  aoSalvar,
  nivel,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  /** Corpo enviado. Montado pela tela a partir do seu proprio estado. */
  valores: () => T;
  url: string;
  /** PUT existe para o filho que se corrige inteiro: endereco, conta bancaria. */
  metodo: "POST" | "PATCH" | "PUT";
  children: React.ReactNode;
  larguraDrawer?: number;
  podeSalvar?: boolean;
  aoSalvar?: () => void;
  /**
   * Em que andar abrir.
   *
   * ⚠️ 2 para o formulario que nasce DE DENTRO de outro drawer — o endereco, que
   * abre da ficha da pessoa. Sem isto ele nasceria atras de quem o abriu.
   */
  nivel?: 1 | 2 | 3;
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
      nivel={nivel}
      /*
       * ⚠️ O salvar sobe para o cabeçalho; o ERRO fica embaixo.
       *
       * São coisas de natureza diferente. O botão é a ação, e no cabeçalho ele
       * está sempre à mão, sem depender de quanto o formulário rolou. A mensagem
       * de erro é texto, pode ter duas linhas, e espremida entre ícones ficaria
       * ilegível justamente na hora em que precisa ser lida.
       */
      acoes={
        <Button size="xs" variant="primary" onClick={salvar} disabled={salvando || !podeSalvar}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      }
      footer={
        erro ? (
          <span
            role="alert"
            style={{
              display: "block",
              fontSize: "var(--text-sm)",
              color: "var(--danger-text)",
              lineHeight: "var(--lh-snug)",
            }}
          >
            {erro}
          </span>
        ) : undefined
      }
    >
      {/*
        ⚠️ O vao e o TOKEN do formulario, e nao um 8 escrito aqui.

        Campos colados entre si (3), titulo colado no primeiro campo (12), e o vao
        grande so entre um assunto e outro (22). O 8 daqui ficava no meio do
        caminho entre os tres e desmanchava a divisao que eles desenham.
      */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--form-gap-campo)" }}
      >
        {children}
      </div>
    </Drawer>
  );
}
