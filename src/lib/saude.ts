import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Saúde do pixel na Meta, lida pela própria Meta (tráfego real, não teste):
 *   • Dataset Quality API: deduplicação (event_id no navegador e no servidor), cobertura
 *     da API de Conversões, qualidade de correspondência (EMQ) e frequência de envio;
 *   • estatísticas do pixel: quantos eventos de cada nome chegaram nas últimas 24 h.
 * Usa o MESMO pixel e token do envio (META_PIXEL_ID / META_CAPI_ACCESS_TOKEN):
 * o token nunca sai deste serviço. O painel chama com Authorization: Bearer <TESTES_TOKEN>.
 */

const VERSAO = () => process.env.META_SAUDE_GRAPH_VERSION?.trim() || "v25.0";
const BASE = () => (process.env.META_GRAPH_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");

export function autorizado(cabecalho: string | null, segredo = process.env.TESTES_TOKEN): boolean {
  const s = segredo?.trim();
  if (!s || !cabecalho?.toLowerCase().startsWith("bearer ")) return false;
  const a = createHash("sha256").update(cabecalho.slice(7).trim()).digest();
  const b = createHash("sha256").update(s).digest();
  return timingSafeEqual(a, b);
}

const CAMPOS_QUALIDADE = [
  "event_name",
  "event_match_quality{composite_score}",
  "event_coverage{percentage,goal_percentage}",
  "dedupe_key_feedback{dedupe_key,browser_events_with_dedupe_key{percentage},server_events_with_dedupe_key{percentage},overall_browser_coverage_from_dedupe_key{percentage}}",
  "data_freshness{upload_frequency}",
].join(",");

type Parte<T> = { ok: true; dados: T } | { ok: false; http: number | null; erro: string };

async function graph(caminho: string, params: Record<string, string>, token: string): Promise<Parte<unknown>> {
  const u = new URL(`${BASE()}/${VERSAO()}/${caminho}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  try {
    const r = await fetch(u, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
    if (!r.ok || j?.error) return { ok: false, http: r.status, erro: j?.error?.message?.slice(0, 300) ?? `HTTP ${r.status}` };
    return { ok: true, dados: j };
  } catch (e) {
    return { ok: false, http: null, erro: e instanceof Error ? e.message : String(e) };
  }
}

export type EventoQualidade = {
  evento: string;
  emq: number | null;
  cobertura: number | null;
  cobertura_meta: number | null;
  frequencia: string | null;
  dedup: { chave: string; navegador: number | null; servidor: number | null; cobertura_navegador: number | null }[];
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null);
const pct = (o: unknown) => num((o as { percentage?: unknown } | null)?.percentage);

/** Normaliza a resposta da Dataset Quality API (pura — testável). */
export function lerQualidade(j: unknown): EventoQualidade[] {
  const web = (j as { web?: unknown[] } | null)?.web;
  if (!Array.isArray(web)) return [];
  return web.map((w) => {
    const x = w as Record<string, unknown>;
    const ded = Array.isArray(x.dedupe_key_feedback) ? x.dedupe_key_feedback : [];
    return {
      evento: String(x.event_name ?? "?"),
      emq: num((x.event_match_quality as { composite_score?: unknown } | undefined)?.composite_score),
      cobertura: pct(x.event_coverage),
      cobertura_meta: num((x.event_coverage as { goal_percentage?: unknown } | undefined)?.goal_percentage),
      frequencia: ((x.data_freshness as { upload_frequency?: string } | undefined)?.upload_frequency) ?? null,
      dedup: ded.map((d) => {
        const y = d as Record<string, unknown>;
        return {
          chave: String(y.dedupe_key ?? "?"),
          navegador: pct(y.browser_events_with_dedupe_key),
          servidor: pct(y.server_events_with_dedupe_key),
          cobertura_navegador: pct(y.overall_browser_coverage_from_dedupe_key),
        };
      }),
    };
  });
}

/** Normaliza as estatísticas do pixel (aggregation=event) em total por evento (pura — testável). */
export function lerVolume(j: unknown): { evento: string; total: number }[] {
  const blocos = (j as { data?: unknown[] } | null)?.data;
  if (!Array.isArray(blocos)) return [];
  const soma = new Map<string, number>();
  for (const b of blocos) {
    const itens = (b as { data?: unknown[] }).data;
    if (!Array.isArray(itens)) continue;
    for (const i of itens) {
      const x = i as { value?: unknown; count?: unknown };
      const n = num(x.count);
      if (typeof x.value === "string" && n != null) soma.set(x.value, (soma.get(x.value) ?? 0) + n);
    }
  }
  return [...soma].map(([evento, total]) => ({ evento, total })).sort((a, b) => b.total - a.total);
}

export async function consultarSaude() {
  const pixel = process.env.META_PIXEL_ID?.trim();
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!pixel || !token) return { ok: false as const, erro: "META_PIXEL_ID/META_CAPI_ACCESS_TOKEN não configurados" };
  const agora = Math.floor(Date.now() / 1000);
  const [q, v] = await Promise.all([
    graph("dataset_quality", { dataset_id: pixel, fields: `web{${CAMPOS_QUALIDADE}}` }, token),
    graph(`${pixel}/stats`, { aggregation: "event", start_time: String(agora - 86_400), end_time: String(agora) }, token),
  ]);
  return {
    ok: true as const,
    pixel,
    consultado_em: new Date().toISOString(),
    qualidade: q.ok ? { ok: true as const, eventos: lerQualidade(q.dados) } : q,
    volume_24h: v.ok ? { ok: true as const, eventos: lerVolume(v.dados) } : v,
  };
}
