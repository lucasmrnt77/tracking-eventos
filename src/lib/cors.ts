/**
 * Origens permitidas: ORIGENS_PERMITIDAS = lista separada por vírgula.
 * Aceita "*" dentro do host para prévias da Vercel, ex.:
 *   https://eventotra.metodoconsistente.com,https://captura-general-*.vercel.app
 * Vazia: libera tudo fora de produção; em produção bloqueia (falha segura).
 */
function padroes(): RegExp[] {
  return (process.env.ORIGENS_PERMITIDAS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]*") + "$", "i"));
}

export function origemPermitida(origem: string | null): boolean {
  const ps = padroes();
  if (ps.length === 0) return process.env.NODE_ENV !== "production";
  return !!origem && ps.some((p) => p.test(origem));
}

export function cabecalhosCors(origem: string | null): Record<string, string> {
  if (!origem || !origemPermitida(origem)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
