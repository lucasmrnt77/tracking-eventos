import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { decidir, normalizarFaixa, normalizarGenero, normalizarResposta, type Acao, type Landing } from "@/lib/regras";
import { resolverPais, telefoneChave } from "@/lib/pais";
import { enviarMeta } from "@/lib/meta";
import { reservar, concluir } from "@/lib/registro";
import { cabecalhosCors, origemPermitida } from "@/lib/cors";

/**
 * POST /api/evento — chamado pelo t.js das landings.
 * Corpo: { acao: "lead"|"qualificacao", landing: "general"|"trader", event_id, telefone,
 *          pais_geo?, idade?, genero?, resposta?, fbp?, fbc?, url?, teste? }
 * Resposta imediata: { ok, evento, event_id, qualificado } — o t.js usa isso para
 * disparar o pixel com o MESMO event_id. O envio à Meta acontece depois (after).
 */
export const maxDuration = 30;

const LANDINGS = new Set<Landing>(["general", "trader"]);
const ACOES = new Set<Acao>(["lead", "qualificacao"]);
const texto = (v: unknown, max = 500) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cabecalhosCors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const origem = req.headers.get("origin");
  const cors = cabecalhosCors(origem);
  const responder = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: cors });
  if (!origemPermitida(origem)) return responder({ ok: false, erro: "origem_nao_permitida" }, 403);

  let b: Record<string, unknown>;
  try {
    const bruto = await req.text();
    if (bruto.length > 10_000) return responder({ ok: false, erro: "corpo_grande_demais" }, 413);
    b = JSON.parse(bruto);
  } catch {
    return responder({ ok: false, erro: "corpo_invalido" }, 400);
  }

  const landing = b.landing as Landing;
  const acao = b.acao as Acao;
  if (!LANDINGS.has(landing) || !ACOES.has(acao)) return responder({ ok: false, erro: "landing_ou_acao_invalida" }, 400);

  const telefone = texto(b.telefone, 40);
  const pais = resolverPais(telefone, texto(b.pais_geo, 2) ?? req.headers.get("x-vercel-ip-country"));
  const eventId = typeof b.event_id === "string" && /^[A-Za-z0-9._-]{8,100}$/.test(b.event_id) ? b.event_id : randomUUID();
  const respostas = {
    faixa: normalizarFaixa(b.idade ?? b.faixa ?? b.age_range),
    genero: normalizarGenero(b.genero ?? b.gender),
    resposta: normalizarResposta(b.resposta ?? b.respuesta),
  };
  const { evento, qualificado } = decidir(landing, acao, { pais, ...respostas });
  const teste = b.teste === true;

  if (evento) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent");
    const eventTime = Math.floor(Date.now() / 1000);
    after(async () => {
      const reserva = await reservar({
        landing, acao, event_name: evento, event_id: eventId,
        telefone_chave: telefoneChave(telefone), pais, qualificado, teste,
      });
      if (reserva === "duplicado") return; // mesmo evento já enviado (clique duplo, recarga)
      const res = await enviarMeta({
        evento, eventId, eventTime, url: texto(b.url, 1000), telefone, pais, ip, userAgent,
        fbp: texto(b.fbp, 200), fbc: texto(b.fbc, 300), teste,
        customData: {
          landing,
          lead_type: acao === "lead" ? "general" : "qualified",
          ...(pais ? { country: pais } : {}),
          ...(respostas.faixa ? { age_range: respostas.faixa } : {}),
          ...(respostas.genero ? { gender: respostas.genero } : {}),
          ...(respostas.resposta ? { respuesta: respostas.resposta } : {}),
        },
      });
      if (!res.ok) console.error("[tracking] Meta recusou/falhou", evento, eventId, res.http, JSON.stringify(res.resposta).slice(0, 300));
      if (reserva === "novo") await concluir(evento, eventId, res);
    });
  }

  return responder({ ok: true, evento, event_id: eventId, qualificado });
}

/** Verificação rápida de saúde: GET /api/evento */
export async function GET() {
  return NextResponse.json({
    ok: true,
    servico: "tracking-eventos",
    meta_configurada: !!(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN),
    registro_configurado: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
