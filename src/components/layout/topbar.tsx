import { BuscaGlobal } from "@/components/layout/busca-global";
import { MenuUsuario } from "@/components/layout/menu-usuario";
import type { DadosDoPerfil, EmpresaDoPerfil } from "@/components/layout/perfil-drawer";

/**
 * Barra superior: a busca no meio, a identidade do usuario a direita.
 *
 * Sem fundo proprio — faz parte da casca cinza.
 *
 * ⚠️ A identidade subiu do rodape da barra lateral para ca. La ela dividia
 * espaco com a navegacao; aqui fica onde todo sistema a poe, e a barra lateral
 * volta a ser so menu.
 */
export function Topbar({
  aviso,
  email,
  usuarioNome,
  usuarioFoto,
  emailPendente,
  dadosDoUsuario,
  empresas,
  empresaAtualId,
  interno,
}: {
  aviso: "demo" | null;
  email: string;
  usuarioNome: string | null;
  usuarioFoto: string | null;
  /** Endereco novo esperando confirmacao, para a gaveta de perfil. */
  emailPendente: string | null;
  /** O cadastro pessoal, para a gaveta de perfil. */
  dadosDoUsuario: DadosDoPerfil;
  /** As empresas do acesso, para a aba de empresas do perfil. */
  empresas: EmpresaDoPerfil[];
  empresaAtualId: number | null;
  interno: boolean;
}) {
  return (
    <header
      style={{
        height: "var(--h-topbar)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 12px",
        position: "relative",
        zIndex: 50,
      }}
    >
      <BuscaGlobal />

      {/*
        ⚠️ ABSOLUTO a direita, e nao no fluxo: a busca fica CENTRADA na tela, e
        no fluxo ela seria empurrada para a esquerda pelo tamanho do avatar e do
        aviso — que muda conforme o nome e o modo de demonstracao.
      */}
      <div
        style={{
          position: "absolute",
          right: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {aviso && <Aviso />}

        <MenuUsuario
          email={email}
          nome={usuarioNome}
          foto={usuarioFoto}
          emailPendente={emailPendente}
          dados={dadosDoUsuario}
          empresas={empresas}
          empresaAtualId={empresaAtualId}
          interno={interno}
        />
      </div>
    </header>
  );
}

/**
 * Aparece so quando o Supabase nao esta configurado: ninguem deve confundir
 * dado de demonstracao com dado real.
 */
function Aviso() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--fw-semi)",
        background: "var(--warning-bg)",
        color: "var(--warning-text)",
        border: "1px solid var(--warning-border)",
      }}
    >
      Dados de demonstração
    </span>
  );
}
