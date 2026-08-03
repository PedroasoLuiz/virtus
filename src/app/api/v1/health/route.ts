import { handler } from "@/shared/http/handler";
import { ok } from "@/shared/http/response";

/** Sonda de disponibilidade. Publica de proposito. */
export const GET = handler({ auth: false }, async () =>
  ok({
    status: "ok",
    versao: process.env.NEXT_PUBLIC_APP_VERSION,
    commit: process.env.NEXT_PUBLIC_APP_COMMIT,
    ambiente: process.env.NEXT_PUBLIC_APP_ENV,
  }),
);
