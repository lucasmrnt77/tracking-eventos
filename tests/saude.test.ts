import { test } from "node:test";
import assert from "node:assert/strict";
import { autorizado, lerQualidade, lerVolume } from "../src/lib/saude";

test("saúde: só com o token certo", () => {
  assert.equal(autorizado("Bearer abc", "abc"), true);
  assert.equal(autorizado("Bearer x", "abc"), false);
  assert.equal(autorizado(null, "abc"), false);
  assert.equal(autorizado("Bearer abc", ""), false);
});

test("saúde: lê a Dataset Quality API", () => {
  const r = lerQualidade({ web: [{
    event_name: "Lead Qualificado",
    event_match_quality: { composite_score: 7.4 },
    event_coverage: { percentage: 88, goal_percentage: 75 },
    data_freshness: { upload_frequency: "real_time" },
    dedupe_key_feedback: [{ dedupe_key: "event_id", browser_events_with_dedupe_key: { percentage: 99 }, server_events_with_dedupe_key: { percentage: "100" }, overall_browser_coverage_from_dedupe_key: { percentage: 87 } }],
  }, { event_name: "PageView" }] });
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { evento: "Lead Qualificado", emq: 7.4, cobertura: 88, cobertura_meta: 75, frequencia: "real_time",
    dedup: [{ chave: "event_id", navegador: 99, servidor: 100, cobertura_navegador: 87 }] });
  assert.deepEqual(r[1].dedup, []);
  assert.deepEqual(lerQualidade(null), []);
});

test("saúde: soma o volume por evento", () => {
  const v = lerVolume({ data: [
    { start_time: "a", data: [{ value: "Lead", count: 2 }, { value: "PageView", count: 10 }] },
    { start_time: "b", data: [{ value: "Lead", count: "3" }] },
  ] });
  assert.deepEqual(v, [{ evento: "PageView", total: 10 }, { evento: "Lead", total: 5 }]);
});

test("fontes: navegador × servidor de um evento (aggregation=event_source)", async () => {
  const { lerFontes, QUALIFICADOS } = await import("../src/lib/saude");
  assert.deepEqual(QUALIFICADOS, ["Lead General Qualificado", "Lead Trader Qualificado", "Lead Jubilado Qualificado", "Lead Qualificado GeneralJubilados"]);
  const j = { data: [
    { start_time: "a", data: [{ value: "BROWSER", count: 12 }, { value: "SERVER", count: 10 }] },
    { start_time: "b", data: [{ value: "BROWSER", count: "3" }, { value: "SERVER", count: 5 }] },
  ] };
  const f = lerFontes("Lead General Qualificado", j);
  assert.equal(f.navegador, 15);
  assert.equal(f.servidor, 15);
  assert.deepEqual(lerFontes("X", { data: [] }), { evento: "X", ok: true, navegador: 0, servidor: 0, fontes: [] });
  const desconhecido = lerFontes("X", { data: [{ data: [{ value: "OUTRO", count: 4 }] }] });
  assert.equal(desconhecido.navegador, null);
  assert.equal(desconhecido.servidor, null);
  assert.deepEqual(desconhecido.fontes, [{ valor: "OUTRO", total: 4 }]);
});
