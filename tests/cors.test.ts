import { test } from "node:test";
import assert from "node:assert/strict";
import { origemPermitida } from "../src/lib/cors";

test("origens permitidas, com * para prévias da Vercel", () => {
  process.env.ORIGENS_PERMITIDAS = "https://eventotra.metodoconsistente.com, https://captura-general-*.vercel.app";
  assert.equal(origemPermitida("https://eventotra.metodoconsistente.com"), true);
  assert.equal(origemPermitida("https://captura-general-abc123-lucas.vercel.app"), true);
  assert.equal(origemPermitida("https://captura-general.evil.com"), false);
  assert.equal(origemPermitida("https://outro.vercel.app"), false);
  assert.equal(origemPermitida(null), false);
});
