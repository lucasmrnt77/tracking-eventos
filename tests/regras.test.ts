import { test } from "node:test";
import assert from "node:assert/strict";
import { decidir, qualificaGeral, normalizarResposta, normalizarFaixa, normalizarGenero, EVENTOS } from "../src/lib/regras";

// Regra oficial reescrita de forma independente, como tabela, para comparar com o código.
function esperado(pais: string | null, resposta: string | null, genero: string | null, faixa: string | null): boolean {
  if (resposta === "si_puedo") return true;
  if (resposta === "no_imposible" || resposta === null) return false;
  // "No hoy"
  if (pais === "AR") {
    if (genero === "hombre") return ["menor_25", "25_34", "35_44", "45_54", "55_64"].includes(faixa ?? "");
    if (genero === "mujer") return faixa === "35_44";
    return false;
  }
  return true;
}

test("todas as combinações país × resposta × gênero × idade", () => {
  const paises = ["AR", "UY", "BR", "CL", "US", null];
  const respostas = ["si_puedo", "no_pero_podria", "no_imposible", null];
  const generos = ["hombre", "mujer", null];
  const faixas = ["menor_25", "25_34", "35_44", "45_54", "55_64", "mayor_65", null];
  let n = 0;
  for (const p of paises) for (const r of respostas) for (const g of generos) for (const f of faixas) {
    assert.equal(qualificaGeral({ pais: p, resposta: r, genero: g, faixa: f }), esperado(p, r, g, f), `${p} ${r} ${g} ${f}`);
    n++;
  }
  assert.equal(n, 6 * 4 * 3 * 7);
});

test("casos-chave da regra oficial", () => {
  const q = (pais: string, resposta: string, genero: string, faixa: string) => qualificaGeral({ pais, resposta, genero, faixa });
  assert.equal(q("AR", "si_puedo", "mujer", "menor_25"), true, "AR Sí vale para todos");
  assert.equal(q("AR", "no_pero_podria", "hombre", "35_44"), true);
  assert.equal(q("AR", "no_pero_podria", "hombre", "55_64"), true);
  assert.equal(q("AR", "no_pero_podria", "hombre", "menor_25"), true, "AR No hoy: homem menor de 25 qualifica");
  assert.equal(q("AR", "no_pero_podria", "hombre", "25_34"), true, "AR No hoy: homem 25–34 qualifica");
  assert.equal(q("AR", "no_pero_podria", "hombre", "mayor_65"), false, "AR No hoy: homem +65 não");
  assert.equal(q("AR", "no_pero_podria", "mujer", "35_44"), true, "AR No hoy: mulher 35–44 qualifica");
  assert.equal(q("AR", "no_pero_podria", "mujer", "45_54"), false, "AR No hoy: mulher fora de 35–44 não");
  assert.equal(q("AR", "no_pero_podria", "mujer", "menor_25"), false);
  assert.equal(q("UY", "no_pero_podria", "mujer", "menor_25"), true, "UY No hoy vale para todos");
  assert.equal(q("UY", "no_imposible", "hombre", "35_44"), false, "Imposible nunca");
  assert.equal(q("AR", "no_imposible", "hombre", "35_44"), false);
});

test("aceita os textos em espanhol do formulário", () => {
  assert.equal(normalizarResposta("Sí, podría hacerlo sin problema"), "si_puedo");
  assert.equal(normalizarResposta("No hoy, pero podría organizarme para conseguirlo"), "no_pero_podria");
  assert.equal(normalizarResposta("No, hoy sería imposible"), "no_imposible");
  assert.equal(normalizarFaixa("35 a 44 años"), "35_44");
  assert.equal(normalizarFaixa("Menor de 25"), "menor_25");
  assert.equal(normalizarFaixa("+65"), "mayor_65");
  assert.equal(normalizarGenero("Hombre"), "hombre");
});

test("trader: qualifica quem já opera (inclusive menos de 3 meses); Nunca hice não", () => {
  const q = (experiencia: unknown) => decidir("trader", "qualificacao", { pais: "AR", experiencia });
  assert.deepEqual(q("6-12-meses"), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(q("de-1-año"), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(q("6 a 12 meses"), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(q("menos-3-meses"), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(q("Menos de 3 meses"), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(q("Nunca hice"), { evento: null, qualificado: false });
  assert.deepEqual(q("nunca"), { evento: null, qualificado: false });
  // Sem experiência (páginas antigas): continua qualificando
  assert.deepEqual(q(undefined), { evento: "Lead Trader Qualificado", qualificado: true });
});

test("decidir: nomes dos eventos e trader sem experiência qualificado", () => {
  assert.deepEqual(decidir("general", "lead", { pais: "AR" }), { evento: "Lead General", qualificado: null });
  assert.deepEqual(decidir("trader", "lead", { pais: "UY" }), { evento: "Lead Trader", qualificado: null });
  assert.deepEqual(decidir("trader", "qualificacao", { pais: "AR" }), { evento: "Lead Trader Qualificado", qualificado: true });
  assert.deepEqual(decidir("general", "qualificacao", { pais: "AR", resposta: "no_pero_podria", genero: "mujer", faixa: "35_44" }), { evento: "Lead Qualificado", qualificado: true });
  assert.deepEqual(decidir("general", "qualificacao", { pais: "AR", resposta: "no_pero_podria", genero: "mujer", faixa: "25_34" }), { evento: null, qualificado: false });
  assert.deepEqual(decidir("general", "qualificacao", { pais: "UY", resposta: "no_pero_podria", genero: "mujer", faixa: "35_44" }), { evento: "Lead Qualificado", qualificado: true });
  // Nomes não podem mudar: as campanhas otimizam por eles.
  assert.deepEqual(EVENTOS, {
    general: { lead: "Lead General", qualificacao: "Lead Qualificado" },
    trader: { lead: "Lead Trader", qualificacao: "Lead Trader Qualificado" },
  });
});
