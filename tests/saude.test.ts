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
