/**
 * REGRAS OFICIAIS DE QUALIFICAÇÃO (mapa mental do funil, atualizado em 22/10/2026;
 * antes: confirmadas pelo Emiliano em 02/10 e 13/10).
 * Este é o ÚNICO lugar com essas regras. Qualquer mudança aqui precisa
 * passar nos testes de tests/regras.test.ts (que cobrem todas as combinações).
 *
 * Página geral — "Lead Qualificado":
 *   • Argentina: "Sí" qualifica todos; "No hoy" qualifica homens até 64 anos (menor de 25 a 55–64)
 *     e mulheres de 35 a 44; homens +65 e as demais mulheres não.
 *   • Outros países (inclusive Uruguai): "Sí" ou "No hoy" qualificam todos.
 *   • "Imposible" nunca qualifica.
 * Página trader — "Lead Trader Qualificado" (Argentina e Uruguai), no clique para entrar no grupo:
 *   • "Menos de 3 meses", "6 a 12 meses" e "de 1 año" qualificam;
 *   • "Nunca hice" não qualifica;
 *   • sem a experiência informada (páginas antigas): qualifica, como antes.
 * "Lead General" / "Lead Trader": todos que chegam à página de obrigado.
 */

export type Resposta = "si_puedo" | "no_pero_podria" | "no_imposible";
export type Genero = "hombre" | "mujer";
export type Faixa = "menor_25" | "25_34" | "35_44" | "45_54" | "55_64" | "mayor_65";

/** Aceita o código do formulário ou o texto em espanhol. */
export function normalizarResposta(v: unknown): Resposta | null {
  const t = String(v ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t === "si_puedo" || t === "si" || t.startsWith("sí") || t.startsWith("si,") || t.startsWith("si ")) return "si_puedo";
  if (t === "no_pero_podria" || t.includes("organizar")) return "no_pero_podria";
  if (t === "no_imposible" || t.includes("imposible")) return "no_imposible";
  return null;
}

export function normalizarGenero(v: unknown): Genero | null {
  const t = String(v ?? "").trim().toLowerCase();
  if (["hombre", "masculino", "homem", "m", "male"].includes(t)) return "hombre";
  if (["mujer", "femenino", "mulher", "f", "female"].includes(t)) return "mujer";
  return null;
}

export function normalizarFaixa(v: unknown): Faixa | null {
  const t = String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const ok: Faixa[] = ["menor_25", "25_34", "35_44", "45_54", "55_64", "mayor_65"];
  if ((ok as string[]).includes(t)) return t as Faixa;
  if (t.startsWith("menor")) return "menor_25";
  if (t.startsWith("mayor") || t.startsWith("+65") || t.startsWith("65")) return "mayor_65";
  for (const f of ["25_34", "35_44", "45_54", "55_64"] as Faixa[]) if (t.startsWith(f.slice(0, 2))) return f;
  return null;
}

// Argentina, "No hoy": homens até 64 anos; mulheres só de 35 a 44
const FAIXAS_AR_NO_HOY_HOMEM: Faixa[] = ["menor_25", "25_34", "35_44", "45_54", "55_64"];
const FAIXAS_AR_NO_HOY_MULHER: Faixa[] = ["35_44"];

export type Experiencia = "nunca" | "menos_3" | "6_12" | "1_mais";

/** Aceita o código do formulário Trader ("menos-3-meses", "6-12-meses", "de-1-año", "nunca") ou o texto. */
export function normalizarExperiencia(v: unknown): Experiencia | null {
  const t = String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!t) return null;
  if (t.startsWith("nunca")) return "nunca";
  if (t.includes("menos")) return "menos_3";
  if (t.startsWith("6") || t.includes("6-12") || t.includes("6 a 12")) return "6_12";
  if (t.includes("ano") || t.startsWith("1") || t.includes("mas de")) return "1_mais";
  return null;
}

/** Trader: qualifica quem já opera (inclusive "menos de 3 meses"); "Nunca hice" não. Sem a informação, qualifica. */
export function qualificaTrader(experiencia: unknown): boolean {
  return normalizarExperiencia(experiencia) !== "nunca";
}

export function qualificaGeral(p: { pais: string | null; resposta: unknown; genero: unknown; faixa: unknown }): boolean {
  const resposta = normalizarResposta(p.resposta);
  if (resposta === "si_puedo") return true;
  if (resposta !== "no_pero_podria") return false; // "Imposible" ou vazio nunca qualifica
  if (p.pais !== "AR") return true;
  const genero = normalizarGenero(p.genero);
  const faixa = normalizarFaixa(p.faixa);
  if (faixa === null) return false;
  if (genero === "hombre") return FAIXAS_AR_NO_HOY_HOMEM.includes(faixa);
  if (genero === "mujer") return FAIXAS_AR_NO_HOY_MULHER.includes(faixa);
  return false;
}

export type Landing = "general" | "trader";
export type Acao = "lead" | "qualificacao";

/** Nomes dos eventos — os MESMOS já usados nas campanhas. Não renomear. */
export const EVENTOS: Record<Landing, Record<Acao, string>> = {
  general: { lead: "Lead General", qualificacao: "Lead Qualificado" },
  trader: { lead: "Lead Trader", qualificacao: "Lead Trader Qualificado" },
};

/** Decide se a ação gera evento e qual. */
export function decidir(landing: Landing, acao: Acao, p: { pais: string | null; resposta?: unknown; genero?: unknown; faixa?: unknown; experiencia?: unknown }) {
  if (acao === "lead") return { evento: EVENTOS[landing].lead, qualificado: null as boolean | null };
  const qualificado = landing === "trader"
    ? qualificaTrader(p.experiencia)
    : qualificaGeral({ pais: p.pais, resposta: p.resposta, genero: p.genero, faixa: p.faixa });
  return { evento: qualificado ? EVENTOS[landing].qualificacao : null, qualificado };
}
