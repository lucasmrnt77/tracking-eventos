/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { paisDoTelefone, resolverPais, telefoneParaMeta, telefoneChave } from "../src/lib/pais";
import { montarPayload } from "../src/lib/meta";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

test("país pelo DDI do telefone, geolocalização só como reserva", () => {
  assert.equal(paisDoTelefone("5491122334455"), "AR");
  assert.equal(paisDoTelefone("+598 99 123 456"), "UY");
  assert.equal(paisDoTelefone("5561981670097"), "BR");
  assert.equal(paisDoTelefone("0054 11 2233 4455"), "AR");
  assert.equal(paisDoTelefone("123"), null);
  // Telefone manda, mesmo que a geolocalização diga outro país (decisão de 02/10)
  assert.equal(resolverPais("5491122334455", "UY"), "AR");
  assert.equal(resolverPais("999", "uy"), "UY");
  assert.equal(resolverPais(null, null), null);
});

test("telefone no formato da Meta", () => {
  assert.equal(telefoneParaMeta("541122334455"), "5491122334455");
  assert.equal(telefoneParaMeta("5491122334455"), "5491122334455");
  assert.equal(telefoneParaMeta("598099123456"), "59899123456");
  assert.equal(telefoneChave("+598 99 123 456"), "99123456");
});

test("payload da CAPI: dados criptografados, event_id e teste", () => {
  const p = montarPayload({
    evento: "Lead Qualificado", eventId: "abc-12345678", eventTime: 1790900000, url: "https://x/gracias-video?tel=1",
    telefone: "541122334455", pais: "AR", ip: "1.2.3.4", userAgent: "UA", fbp: "fb.1.1.2", fbc: null,
    customData: { landing: "general" }, teste: true,
  }, "TEST123") as { data: Record<string, any>[]; test_event_code?: string };
  const e = p.data[0];
  assert.equal(e.event_name, "Lead Qualificado");
  assert.equal(e.event_id, "abc-12345678");
  assert.equal(e.action_source, "website");
  assert.deepEqual(e.user_data.ph, [sha("5491122334455")]);
  assert.deepEqual(e.user_data.external_id, [sha("5491122334455")]);
  assert.deepEqual(e.user_data.country, [sha("ar")]);
  assert.equal(e.user_data.fbc, undefined);
  assert.equal(p.test_event_code, "TEST123");
  // Sem "teste", nunca manda test_event_code
  const real = montarPayload({ ...({} as any), evento: "Lead General", eventId: "x".repeat(8), eventTime: 1, url: null, telefone: null, pais: null, ip: null, userAgent: null, fbp: null, fbc: null, customData: {}, teste: false }, "TEST123") as any;
  assert.equal(real.test_event_code, undefined);
  assert.deepEqual(real.data[0].user_data, {});
});

test("payload da CAPI: e-mail criptografado quando válido, ignorado quando inválido", () => {
  const base = {
    evento: "Lead General", eventId: "abc-12345678", eventTime: 1790900000, url: null,
    telefone: "59899123456", pais: "UY", ip: null, userAgent: null, fbp: null, fbc: null,
    customData: {}, teste: false,
  };
  const com = montarPayload({ ...base, email: " Teste@Gmail.com " }) as { data: Record<string, any>[] };
  assert.deepEqual(com.data[0].user_data.em, [sha("teste@gmail.com")]);
  const sem = montarPayload({ ...base, email: "invalido" }) as { data: Record<string, any>[] };
  assert.equal("em" in sem.data[0].user_data, false);
});

test("teste sem código de Eventos de teste nunca vai para a Meta", async () => {
  const { bloquearTesteSemCodigo } = await import("../src/lib/meta");
  assert.equal(bloquearTesteSemCodigo(true, null), true);
  assert.equal(bloquearTesteSemCodigo(true, "  "), true);
  assert.equal(bloquearTesteSemCodigo(true, "TEST1"), false);
  assert.equal(bloquearTesteSemCodigo(false, null), false);
});
