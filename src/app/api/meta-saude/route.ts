import { NextResponse } from "next/server";
import { autorizado, consultarSaude } from "@/lib/saude";

/**
 * GET /api/meta-saude — números da própria Meta sobre o pixel (deduplicação, cobertura,
 * qualidade e volume das últimas 24 h). Só para o painel: Authorization: Bearer <TESTES_TOKEN>.
 */
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!autorizado(req.headers.get("authorization"))) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  const r = await consultarSaude();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
