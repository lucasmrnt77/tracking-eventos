# tracking-eventos

Serviço único de eventos Meta (pixel + API de Conversões) das landings dos lançamentos.
As landings **não têm regra nem token**: só carregam o `t.js` e chamam `tde(...)`.
Mudar ou refazer uma página não quebra o evento, desde que essas chamadas continuem lá.

## Eventos (mesmos nomes de antes — as campanhas otimizam por eles)

| Landing | Quando | Chamada na página | Evento |
|---|---|---|---|
| general | abre a página de obrigado | `tde("lead", { telefone })` | Lead General |
| general | responde as 3 perguntas | `tde("qualificar", { telefone, idade, genero, resposta })` | Lead Qualificado (se qualificar) |
| trader | abre a página de obrigado | `tde("lead", { telefone })` | Lead Trader |
| trader | clica para entrar no grupo | `tde("qualificar", { telefone })` | Lead Trader Qualificado |

Se `telefone` não for passado, o t.js usa `?tel=` ou `?phone=` da URL.

## Regras (oficiais, 02/10/2026) — só em `src/lib/regras.ts`

* Lead General / Lead Trader: todos que chegam à página de obrigado.
* Lead Qualificado (geral): Argentina — "Sí" todos, "No hoy" só homens 35–64; outros países (inclusive UY) — "Sí" ou "No hoy" todos; "Imposible" nunca.
* País = DDI do telefone; geolocalização só se o telefone não identificar.
* `tests/regras.test.ts` cobre todas as combinações. Mudou regra → `npm test` tem que passar.

## Como funciona

1. A página chama `tde(...)`. O t.js gera o `event_id`, lê os cookies `_fbp`/`_fbc` (cria `_fbc` a partir de `fbclid`) e chama `POST /api/evento`.
2. O servidor decide o evento e responde na hora. O t.js dispara o pixel com o **mesmo** `event_id` (a Meta deduplica).
3. Depois da resposta, o servidor registra em `eventos_meta` (Supabase do painel) e envia à Meta pela CAPI, com telefone/país criptografados (até 3 tentativas).
4. Mesmo `event_id` duas vezes, ou recarregar a página, não gera evento duplicado.

## Teste sem afetar campanhas

Abra a página com `?tde_teste=1`: os eventos vão para **Gerenciador de Eventos → Eventos de teste** (precisa de `META_TEST_EVENT_CODE`).

## Saúde

`GET /api/evento` → mostra se Meta e registro estão configurados. Detalhe por evento na tabela `eventos_meta`.
