"use client";

/**
 * Se este lançamento já bate com o extrato do banco.
 *
 * ⚠️ Duas MARCAS diferentes, e não a mesma marca em duas cores.
 *
 * Antes, o não conferido era o mesmo círculo com visto, só que cinza. Cinza
 * claro num visto lê como "conferido, discretamente": a forma afirma o que a
 * cor tenta negar, e quem varre a lista rápido conta como pronto o que ainda
 * não foi. Agora conferido é visto cheio e pendente é relógio vazado — duas
 * silhuetas que não se confundem nem de longe nem em preto e branco.
 *
 * É o mesmo par da tabela de baixas, e de propósito: conferir no extrato é o
 * mesmo gesto nas duas telas, e dois desenhos para ele fariam aprender duas
 * vezes.
 *
 * ⚠️ Mora em arquivo próprio porque nasceu dentro do drawer do extrato, que
 * hoje importa a tabela — deixado lá, a tabela teria de importar de volta o
 * arquivo que a importa.
 *
 * ⚠️ `onClick` é OPCIONAL, e a ausência dele não é detalhe de implementação.
 * Sem ele a marca vira leitura pura, que é o que a tabela precisa enquanto
 * conciliar não tiver gesto próprio: um alvo que parece botão e não responde é
 * pior que uma marca que nunca prometeu nada.
 */
export function VistoDeConferencia({
  conciliado,
  onClick,
}: {
  conciliado: boolean;
  onClick?: () => void;
}) {
  const rotulo = conciliado
    ? "Conferido no extrato do banco"
    : onClick
      ? "Marcar como conferido"
      : "Ainda não conferido no extrato do banco";

  const desenho = conciliado ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      {/* Cheio: o conferido fecha a pergunta, e forma cheia é o que se lê como
          resolvido sem precisar da cor. */}
      <circle cx="8" cy="8" r="6.4" fill="currentColor" />
      <path
        d="M5.2 8.2l1.9 1.9 3.7-3.9"
        stroke="var(--surface)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Vazado: o que falta não pode ter o mesmo peso do que já foi resolvido,
          senão as duas marcas competem na mesma coluna. */}
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.7V8l2.1 1.5" />
    </svg>
  );

  const base: React.CSSProperties = {
    display: "inline-grid",
    placeItems: "center",
    width: 14,
    height: 14,
    flexShrink: 0,
    padding: 0,
    border: "none",
    background: "none",
    /*
     * ⚠️ `--primary` no conferido, e não `--success`.
     *
     * O `--success` é o verde genérico dos avisos; este é um estado do sistema,
     * e a cor da marca o liga ao resto da interface em vez de a uma mensagem.
     * (Escrito quando a marca era verde; hoje é o azul, e o que vale é o token.)
     *
     * ⚠️ E o amarelo SÓLIDO no pendente: o `--warning` é âmbar escuro calibrado
     * para ler como texto, e some quando vira um traço de 14px.
     */
    color: conciliado ? "var(--primary)" : "var(--warning-solido)",
  };

  if (!onClick) {
    return (
      <span title={rotulo} aria-label={rotulo} style={base}>
        {desenho}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={conciliado}
      style={{ ...base, cursor: "pointer" }}
    >
      {desenho}
    </button>
  );
}
