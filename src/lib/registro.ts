import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Registro de cada evento na tabela eventos_meta (Supabase do Painel Sendflow).
 * Serve para: (1) não enviar duas vezes o mesmo event_id; (2) o painel mostrar
 * a saúde dos eventos e alertar se pararem. Sem SUPABASE_URL/KEY, o serviço
 * continua enviando à Meta — só não registra.
 */
let cliente: SupabaseClient | null | undefined;
function db(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  cliente = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cliente;
}

export type NovoRegistro = {
  landing: string;
  acao: string;
  event_name: string;
  event_id: string;
  telefone_chave: string | null;
  pais: string | null;
  qualificado: boolean | null;
  teste: boolean;
};

/** Reserva o event_id. Retorna "novo", "duplicado" ou "sem_registro" (banco indisponível). */
export async function reservar(r: NovoRegistro): Promise<"novo" | "duplicado" | "sem_registro"> {
  const c = db();
  if (!c) return "sem_registro";
  const { error } = await c.from("eventos_meta").insert(r);
  if (!error) return "novo";
  if (error.code === "23505") return "duplicado";
  console.error("[tracking] erro ao registrar evento", error.message);
  return "sem_registro";
}

export async function concluir(eventName: string, eventId: string, res: { ok: boolean; http: number | null; resposta: unknown; tentativas: number }) {
  const c = db();
  if (!c) return;
  const { error } = await c
    .from("eventos_meta")
    .update({
      status: res.ok ? "enviado" : "falhou",
      meta_http: res.http,
      meta_resposta: res.resposta as object,
      tentativas: res.tentativas,
      enviado_em: new Date().toISOString(),
    })
    .eq("event_name", eventName)
    .eq("event_id", eventId);
  if (error) console.error("[tracking] erro ao concluir registro", error.message);
}
