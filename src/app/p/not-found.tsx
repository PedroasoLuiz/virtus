/**
 * O 404 do link de cobranca.
 *
 * ⚠️ Pagina PROPRIA, e nao a do sistema. Quem cai aqui e o cliente, que nao tem
 * conta: mandar "Voltar ao inicio" o levaria para o login de um sistema que nao
 * e dele, que e o mesmo beco que o middleware evita deixando `/p/` fora da
 * guarda de sessao.
 *
 * ⚠️ E o texto nao diz "link invalido". A causa mais comum e legitima: a conta
 * foi CANCELADA, e a RPC publica se recusa a devolver cobranca cancelada de
 * proposito. Chamar isso de erro faria o cliente procurar defeito no que ele
 * fez, quando o que mudou foi do lado de ca.
 */

export const metadata = { title: "Cobrança não disponível" };

const AZUL = "#0A52B9";
const TINTA = "#101012";
const CINZA = "#86868B";

export default function CobrancaNaoEncontrada() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#eef0f4",
        fontFamily: "Helvetica, Arial, sans-serif",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "36px 28px",
          borderRadius: 14,
          background: "#ffffff",
          border: "1px solid #dfe3ea",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            margin: "0 auto",
            borderRadius: "50%",
            background: "#eef3fb",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 16 16"
            fill="none"
            stroke={AZUL}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 2h6l3 3v9h-9z" />
            <path d="M5.5 8.5h5" />
          </svg>
        </div>

        <h1 style={{ margin: "20px 0 0", fontSize: 20, fontWeight: 700, color: TINTA }}>
          Esta cobrança não está mais disponível
        </h1>

        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.7, color: CINZA }}>
          O link pode ter sido substituído por um mais recente, ou a cobrança foi
          cancelada por quem a emitiu. Se você recebeu este link há pouco tempo,
          responda o e-mail em que ele veio e peça o endereço atualizado.
        </p>
      </div>
    </main>
  );
}
