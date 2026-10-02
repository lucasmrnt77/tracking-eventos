/**
 * REGRAS OFICIAIS DE QUALIFICAÇÃO (confirmadas pelo Emiliano em 02/10/2026).
 * Este é o ÚNICO lugar com essas regras. Qualquer mudança aqui precisa
 * passar nos testes de tests/regras.test.ts (que cobrem todas as combinações).
 *
 * Página geral — "Lead Qualificado":
 *   • Argentina: "Sí" qualifica todos; "No hoy" só homens de 35 a 64.
 *   • Outros países (inclusive Uruguai): "Sí" ou "No hoy" qualificam todos.
 *   • "Imposible" nunca qualifica.
 * Página trader: não há perguntas — todo clique para entrar no grupo qualifica.
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

const FAIXAS_AR_NO_HOY: Faixa[] = ["35_44", "45_54", "55_64"];

export function qualificaGeral(p: { pais: string | null; resposta: unknown; genero: unknown; faixa: unknown }): boolean {
  const resposta = normalizarResposta(p.resposta);
  if (resposta === "si_puedo") return true;
  if (resposta !== "no_pero_podria") return false; // "Imposible" ou vazio nunca qualifica
  if (p.pais !== "AR") return true;
  const genero = normalizarGenero(p.genero);
  const faixa = normalizarFaixa(p.faixa);
  return genero === "hombre" && faixa !== null && FAIXAS_AR_NO_HOY.includes(faixa);
}

export type Landing = "general" | "trader";
export type Acao = "lead" | "qualificacao";

/** Nomes dos eventos — os MESMOS já usados nas campanhas. Não renomear. */
export const EVENTOS: Record<Landing, Record<Acao, string>> = {
  general: { lead: "Lead General", qualificacao: "Lead Qualificado" },
  trader: { lead: "Lead Trader", qualificacao: "Lead Trader Qualificado" },
};

/** Decide se a ação gera evento e qual. */
export function decidir(landing: Landing, acao: Acao, p: { pais: string | null; resposta?: unknown; genero?: unknown; faixa?: unknown }) {
  if (acao === "lead") return { evento: EVENTOS[landing].lead, qualificado: null as boolean | null };
  const qualificado = landing === "trader" ? true : qualificaGeral({ pais: p.pais, resposta: p.resposta, genero: p.genero, faixa: p.faixa });
  return { evento: qualificado ? EVENTOS[landing].qualificacao : null, qualificado };
}
