"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { PanelTabs } from "@/components/ui/kit";
import type { ContaWhatsapp, Modelo } from "@/modules/whatsapp/whatsapp.types";
import type { ConfigIA } from "@/modules/ia/ia.types";
import type { Persona } from "@/modules/atendimento/personas.types";
import { AbaDeNumeros } from "./aba-numeros";
import { AbaDeModelos } from "./aba-modelos";
import { AbaDeProvedores } from "./aba-provedores";
import { AbaDePersonas, type Setor } from "./aba-personas";

/**
 * Configuração do WhatsApp: a casca e os dados, nada mais.
 *
 * ⚠️ Este arquivo NÃO desenha tela. Ele monta o drawer, decide qual aba está
 * aberta e guarda o que as abas leem. Antes eram 1149 linhas cuidando de
 * números, modelos, prévia e webhook no mesmo lugar, e mexer em qualquer um
 * significava rolar por todos.
 *
 * ⚠️ `nivel={2}` não é detalhe de estilo. Este drawer abre de DENTRO do painel
 * do WhatsApp, que é um `aside` fixo em 401: no nível padrão o véu ficava atrás
 * dele, o chat continuava clicável ao fundo e a configuração parecia meio
 * modal.
 *
 * ⚠️ Os dados moram AQUI, e não em cada aba. As abas montam e desmontam a cada
 * troca de guia; com o estado dentro delas, voltar mostrava "carregando" e
 * refazia consulta de dado já lido. Num SaaS isso multiplica por usuário e por
 * sessão, e a de modelos ainda sai para a Meta, não para o nosso banco.
 */

type Aba = "Números" | "Modelos" | "Automação" | "Personas";

export function ConfiguracaoDeContas({
  contas,
  onFechar,
  onMudou,
}: {
  contas: ContaWhatsapp[];
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [aba, setAba] = useState<Aba>("Números");

  /*
   * Os modelos já lidos da Meta, por conta. Zeram quando o painel fecha, que é
   * a hora em que faz sentido perguntar de novo.
   */
  const [modelosPorConta, setModelosPorConta] = useState<Record<number, Modelo[]>>({});
  const [provedores, setProvedores] = useState<ConfigIA[] | null>(null);
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);

  const guardarModelos = useCallback((contaId: number, lista: Modelo[]) => {
    setModelosPorConta((atual) => ({ ...atual, [contaId]: lista }));
  }, []);

  const carregarProvedores = useCallback(async () => {
    const r = await fetch("/api/v1/ia/config");
    const corpo = await r.json().catch(() => null);

    if (!r.ok) {
      /*
       * Falha APARECE. Silenciada, a lista vazia diria "não há provedor", que é
       * outra coisa: já custou uma aba em branco sem explicação nenhuma.
       */
      const detalhe = corpo?.error?.details?.[0];
      setErroIA(
        detalhe
          ? `${detalhe.campo}: ${detalhe.mensagem}`
          : (corpo?.error?.message ?? "Não foi possível carregar"),
      );
      setProvedores([]);
      return;
    }

    setErroIA(null);
    setProvedores(corpo.data ?? []);
  }, []);

  const carregarPersonas = useCallback(async () => {
    const [rp, rs] = await Promise.all([
      fetch("/api/v1/atendimento/personas"),
      fetch("/api/v1/atendimento/setores"),
    ]);

    const cp = await rp.json().catch(() => null);
    setPersonas(rp.ok ? (cp?.data ?? []) : []);

    // Setor é opcional na persona, então falhar aqui não impede cadastrar: a
    // lista fica vazia e a persona nasce geral.
    const cs = await rs.json().catch(() => null);
    setSetores(rs.ok ? (cs?.data ?? []) : []);
  }, []);

  // Carrega ao ENTRAR na aba, e só na primeira vez.
  /*
   * As credenciais sao lidas tambem quando a aba de NUMEROS abre: o cadastro
   * precisa delas para o seletor de chave, e sem isto o campo apareceria vazio
   * ate alguem visitar a aba de automacao antes.
   */
  useEffect(() => {
    if ((aba === "Automação" || aba === "Números") && provedores == null) {
      const t = setTimeout(() => void carregarProvedores(), 0);
      return () => clearTimeout(t);
    }

    if (aba === "Personas" && personas == null) {
      const t = setTimeout(() => void carregarPersonas(), 0);
      return () => clearTimeout(t);
    }
  }, [aba, provedores, personas, carregarProvedores, carregarPersonas]);

  return (
    <Drawer open onClose={onFechar} title="Configuração do WhatsApp" nivel={2}>
      {/*
        Quatro nomes CURTOS. "Atendimento automático" sozinho ocupava metade da
        barra e empurrava os outros, e a aba mais usada é a primeira.
      */}
      <PanelTabs
        tabs={["Números", "Modelos", "Automação", "Personas"]}
        active={aba}
        onChange={(t) => setAba(t as Aba)}
      />

      {aba === "Números" && (
        <AbaDeNumeros contas={contas} credenciais={provedores} onMudou={onMudou} />
      )}

      {aba === "Modelos" && (
        <AbaDeModelos contas={contas} cache={modelosPorConta} onCarregou={guardarModelos} />
      )}

      {aba === "Automação" && (
        <AbaDeProvedores
          provedores={provedores}
          erro={erroIA}
          onRecarregar={() => void carregarProvedores()}
        />
      )}

      {aba === "Personas" && (
        <AbaDePersonas
          contas={contas}
          personas={personas}
          setores={setores}
          onRecarregar={() => void carregarPersonas()}
        />
      )}
    </Drawer>
  );
}
