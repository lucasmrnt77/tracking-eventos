import "server-only";
import { createHash } from "node:crypto";
import { telefoneParaMeta } from "./pais";

/**
 * Envio à Meta pela API de Conversões (CAPI).
 * Variáveis: META_PIXEL_ID, META_CAPI_ACCESS_TOKEN, META_TEST_EVENT_CODE (opcional),
 * META_GRAPH_VERSION (padrão v21.0), META_GRAPH_URL (só para testes).
 */

export type ContextoEvento = {
  evento: string;
  eventId: string;
  eventTime: number; // segundos
  url: string | null;
  telefone: string | null;
  email?: string | null;
  pais: string | null;
  ip: string | null;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
  customData: Record<string, unknown>;
  teste: boolean;
};

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/**
 * Requisição de teste sem código de "Eventos de teste" configurado: NÃO pode ir para a Meta,
 * senão vira evento real nas campanhas. Puro — testável.
 */
export function bloquearTesteSemCodigo(teste: boolean, testEventCode?: string | null): boolean {
  return teste && !testEventCode?.trim();
}

/** Monta o payload exato enviado à Meta (puro — testável). */
export function montarPayload(c: ContextoEvento, testEventCode?: string | null) {
  const user_data: Record<string, unknown> = {};
  const tel = c.telefone ? telefoneParaMeta(c.telefone) : "";
  if (tel) {
    user_data.ph = [sha(tel)];
    user_data.external_id = [sha(tel)];
  }
  const email = c.email?.trim().toLowerCase() ?? "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) user_data.em = [sha(email)];
  if (c.pais) user_data.country = [sha(c.pais.toLowerCase())];
  if (c.ip) user_data.client_ip_address = c.ip;
  if (c.userAgent) user_data.client_user_agent = c.userAgent;
  if (c.fbp) user_data.fbp = c.fbp;
  if (c.fbc) user_data.fbc = c.fbc;

  const evento: Record<string, unknown> = {
    event_name: c.evento,
    event_time: c.eventTime,
    event_id: c.eventId,
    action_source: "website",
    user_data,
    custom_data: c.customData,
  };
  if (c.url) evento.event_source_url = c.url;

  const payload: Record<string, unknown> = { data: [evento] };
  if (c.teste && testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

export type ResultadoMeta = { ok: boolean; http: number | null; resposta: unknown; tentativas: number };

export async function enviarMeta(c: ContextoEvento): Promise<ResultadoMeta> {
  const pixel = process.env.META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixel || !token) return { ok: false, http: null, resposta: { erro: "META_PIXEL_ID/META_CAPI_ACCESS_TOKEN não configurados" }, tentativas: 0 };

  const codigoTeste = process.env.META_TEST_EVENT_CODE?.trim() || null;
  if (bloquearTesteSemCodigo(c.teste, codigoTeste)) {
    return { ok: false, http: null, resposta: { erro: "teste sem META_TEST_EVENT_CODE: não enviado à Meta" }, tentativas: 0 };
  }

  const base = (process.env.META_GRAPH_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
  const versao = process.env.META_GRAPH_VERSION?.trim() || "v21.0";
  const corpo = { ...montarPayload(c, codigoTeste), access_token: token };

  let ultimo: ResultadoMeta = { ok: false, http: null, resposta: null, tentativas: 0 };
  // Até 3 tentativas para falhas de rede / 5xx / 429. Erros 4xx (ex.: token inválido) não adianta repetir.
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const r = await fetch(`${base}/${versao}/${pixel}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(8000),
      });
      const texto = await r.text();
      let resposta: unknown = texto.slice(0, 1000);
      try { resposta = JSON.parse(texto); } catch { /* texto puro */ }
      ultimo = { ok: r.ok, http: r.status, resposta, tentativas: tentativa };
      if (r.ok || (r.status < 500 && r.status !== 429)) return ultimo;
    } catch (e) {
      ultimo = { ok: false, http: null, resposta: { erro: e instanceof Error ? e.message : String(e) }, tentativas: tentativa };
    }
    await new Promise((res) => setTimeout(res, 400 * tentativa));
  }
  return ultimo;
}
