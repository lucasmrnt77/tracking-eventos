/**
 * REGRAS OFICIAIS DE QUALIFICAÇÃO. Este é o ÚNICO lugar com essas regras. Qualquer mudança aqui precisa
 * passar nos testes de tests/regras.test.ts (que cobrem todas as combinações).
 *
 * Desde 27/10/2026 existem DUAS regras para as páginas General, Jubilados e General/Jubilados
 * (decisão do Emi: "hasta finalizar los test mantendremos la misma cualificación… solo cambiaremos el evento en Meta"):
 *
 * A) EVENTO NA META (qualificaMeta) — regra nova, validada pelo Emi em 27/10/2026.
 *    Decide se vai "… Qualificado" ou "… Desqualificado" (pixel do navegador e servidor).
 *   1) Desqualificados por PERFIL — em QUALQUER resposta, inclusive "Sí":
 *      • Uruguai: mulher 55–64 e homem +65.
 *      • Argentina e TODOS OS OUTROS PAÍSES (também sem país conhecido): toda mulher, menos 45–54; homem +65.
 *   2) Os demais: "Sí" qualifica; "Imposible" (ou vazio) nunca; "No hoy" qualifica no Uruguai e, na
 *      Argentina e outros países, só com gênero e idade informados (sobram homem até 55–64 e mulher 45–54).
 *   Sem gênero ou idade informados, o filtro de perfil não se aplica.
 *
 * B) CRITÉRIO DA PLANILHA E DO PAINEL (qualificaGeral) — regra anterior (22/10 e 23/10), continua até o
 *    fim dos testes. É o "qualificado" devolvido à página e gravado na inscrição.
 *   • Uruguai: "Sí" ou "No hoy" qualificam todos.
 *   • Argentina e TODOS OS OUTROS PAÍSES: "Sí" qualifica todos; "No hoy" qualifica homens até 64 anos
 *     (menor de 25 a 55–64) e mulheres de 35 a 44; homens +65 e as demais mulheres não.
 *   • "Imposible" nunca qualifica.
 *
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

// Argentina e outros países (todos menos o Uruguai), "No hoy": homens até 64 anos; mulheres só de 35 a 44
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

/** B) Critério da planilha e do painel (regra anterior, até o fim dos testes). */
export function qualificaGeral(p: { pais: string | null; resposta: unknown; genero: unknown; faixa: unknown }): boolean {
  const resposta = normalizarResposta(p.resposta);
  if (resposta === "si_puedo") return true;
  if (resposta !== "no_pero_podria") return false; // "Imposible" ou vazio nunca qualifica
  if (p.pais === "UY") return true; // Uruguai: "No hoy" qualifica todos; o resto segue a regra da Argentina
  const genero = normalizarGenero(p.genero);
  const faixa = normalizarFaixa(p.faixa);
  if (faixa === null) return false;
  if (genero === "hombre") return FAIXAS_AR_NO_HOY_HOMEM.includes(faixa);
  if (genero === "mujer") return FAIXAS_AR_NO_HOY_MULHER.includes(faixa);
  return false;
}

/** Perfil desqualificado (27/10): vale para qualquer resposta. Sem gênero ou idade, não se aplica. */
export function desqualificadoPorPerfil(pais: string | null, genero: Genero | null, faixa: Faixa | null): boolean {
  if (!genero || !faixa) return false;
  if (pais === "UY") return (genero === "mujer" && faixa === "55_64") || (genero === "hombre" && faixa === "mayor_65");
  // Argentina e outros países
  if (genero === "hombre") return faixa === "mayor_65";
  return faixa !== "45_54";
}

/** A) Evento na Meta (regra nova de 27/10). */
export function qualificaMeta(p: { pais: string | null; resposta: unknown; genero: unknown; faixa: unknown }): boolean {
  const resposta = normalizarResposta(p.resposta);
  if (resposta !== "si_puedo" && resposta !== "no_pero_podria") return false; // "Imposible" ou vazio nunca qualifica
  const genero = normalizarGenero(p.genero);
  const faixa = normalizarFaixa(p.faixa);
  if (desqualificadoPorPerfil(p.pais, genero, faixa)) return false;
  if (resposta === "si_puedo") return true;
  if (p.pais === "UY") return true; // Uruguai: "No hoy" qualifica (fora do perfil desqualificado)
  // Argentina e outros países: "No hoy" só com gênero e idade informados (sobram homem até 55–64 e mulher 45–54)
  return genero !== null && faixa !== null;
}

export type Landing = "general" | "trader" | "jubilados" | "genjub";
export type Acao = "lead" | "qualificacao";

/** Nomes dos eventos — os MESMOS já usados nas campanhas. Não renomear. */
export const EVENTOS: Record<Landing, Record<Acao, string>> = {
  general: { lead: "Lead General", qualificacao: "Lead General Qualificado" },
  trader: { lead: "Lead Trader", qualificacao: "Lead Trader Qualificado" },
  // Jubilados (24/10): eventos próprios (lead e qualificado), mesma regra da General
  jubilados: { lead: "Lead Jubilado", qualificacao: "Lead Jubilado Qualificado" },
  // General/Jubilados (24/10): idem, qualificado próprio
  genjub: { lead: "Lead GeneralJubilados", qualificacao: "Lead Qualificado GeneralJubilados" },
};

/** Desqualificado (24/10): quem clicou no grupo e NÃO passou na regra da página. */
export const DESQUALIFICADO: Record<Landing, string> = {
  general: "Lead General Desqualificado",
  trader: "Lead Trader Desqualificado",
  jubilados: "Lead Jubilado Desqualificado",
  genjub: "Lead Desqualificado GeneralJubilados",
};

/**
 * Decide se a ação gera evento e qual.
 *   evento / qualificado_meta → regra nova (A), o que vai para a Meta;
 *   qualificado → critério da planilha e do painel (B), devolvido à página e gravado na inscrição.
 * Na Trader as duas são iguais.
 */
export function decidir(landing: Landing, acao: Acao, p: { pais: string | null; resposta?: unknown; genero?: unknown; faixa?: unknown; experiencia?: unknown }) {
  if (acao === "lead") return { evento: EVENTOS[landing].lead, qualificado: null as boolean | null, qualificado_meta: null as boolean | null };
  if (landing === "trader") {
    const q = qualificaTrader(p.experiencia);
    return { evento: q ? EVENTOS.trader.qualificacao : DESQUALIFICADO.trader, qualificado: q, qualificado_meta: q };
  }
  const dados = { pais: p.pais, resposta: p.resposta, genero: p.genero, faixa: p.faixa };
  const meta = qualificaMeta(dados);
  return { evento: meta ? EVENTOS[landing].qualificacao : DESQUALIFICADO[landing], qualificado: qualificaGeral(dados), qualificado_meta: meta };
}
