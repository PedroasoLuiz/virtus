import { logoutAction } from "@/modules/sessao/sessao.actions";

/**
 * Sair, no portal.
 *
 * Botão solto e não menu de usuário: no portal a única ação de conta é essa, e
 * um menu de um item só é uma gaveta para guardar um objeto.
 */
export function SairDoPortal() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        style={{
          height: "var(--h-btn)",
          padding: "0 12px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-strong)",
          background: "var(--surface)",
          color: "var(--text-primary)",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font)",
          cursor: "pointer",
        }}
      >
        Sair
      </button>
    </form>
  );
}
