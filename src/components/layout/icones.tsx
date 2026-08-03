"use client";

/**
 * Icones do menu. Tracado de 1.6px em grade de 16 — mesma familia do SIC.
 *
 * Sem biblioteca externa e sem emoji: cada icone e um path curto, e trocar um
 * deles nao arrasta um pacote inteiro.
 */
export function Icon({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: color ?? "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "faturas":
      return (
        <svg {...p}>
          <rect x="1" y="4" width="14" height="9" rx="1.5" />
          <path d="M1 7.5h14" />
          <circle cx="10.5" cy="10.5" r="1.2" />
          <path d="M4 10.5h2.5" />
        </svg>
      );
    case "banco":
      return (
        <svg {...p}>
          <path d="M8 1.5L14.5 5H1.5L8 1.5z" />
          <path d="M3 5v6M6.5 5v6M9.5 5v6M13 5v6M1.5 13.5h13" />
        </svg>
      );
    case "pessoas":
      return (
        <svg {...p}>
          <circle cx="8" cy="5" r="2.5" />
          <path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" />
        </svg>
      );
    case "relatorios":
      return (
        <svg {...p}>
          <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
          <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
        </svg>
      );
    case "operacional":
      return (
        <svg {...p}>
          <rect x="1" y="5" width="9" height="7" rx="1" />
          <path d="M10 7l3.5 1.5V12H10V7z" />
          <circle cx="3.5" cy="12.5" r="1" />
          <circle cx="11.5" cy="12.5" r="1" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...p}>
          <path d="M1.5 6.2V4a1 1 0 011-1h11a1 1 0 011 1v2.2a1.8 1.8 0 000 3.6V12a1 1 0 01-1 1h-11a1 1 0 01-1-1V9.8a1.8 1.8 0 000-3.6z" />
          <path d="M10 3v10" strokeDasharray="1.6 1.6" />
        </svg>
      );
    case "caixa":
      return (
        <svg {...p}>
          <path d="M1.5 5L8 1.5 14.5 5v6L8 14.5 1.5 11V5z" />
          <path d="M1.5 5L8 8.5 14.5 5M8 8.5v6" />
        </svg>
      );
    case "config":
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M10.54 10.54l1.41 1.41M3.05 12.95l1.41-1.41M10.54 5.46l1.41-1.41" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="M4 6l4 4 4-4" />
        </svg>
      );
    case "recolher":
      return (
        <svg {...p}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <path d="M6 2.5v11M10.5 6.5L8.5 8l2 1.5" />
        </svg>
      );
    case "expandir":
      return (
        <svg {...p}>
          <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
          <path d="M6 2.5v11M8.5 6.5L10.5 8l-2 1.5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
  }
}
