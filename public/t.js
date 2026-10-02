/*!
 * tracking-eventos — t.js
 * Única peça que vai dentro das landings. Toda a regra fica no servidor.
 *
 * Uso na landing (uma vez, no <head> ou no layout):
 *   <script>window.tde=window.tde||function(){(tde.q=tde.q||[]).push(arguments)}</script>
 *   <script async src="https://SEU-TRACKING.vercel.app/t.js" data-landing="general"></script>
 *
 * Página de obrigado, ao abrir:       tde("lead", { telefone: "59899123456" })
 * Ao responder as 3 perguntas:        tde("qualificar", { telefone, idade, genero, resposta })
 * Página trader, clique no grupo:     tde("qualificar", { telefone })
 *
 * O servidor decide se o evento vale, envia à Meta (CAPI) e devolve o nome e o
 * event_id; só então o pixel dispara com o MESMO event_id (a Meta não conta em dobro).
 * Teste sem afetar campanhas: abra a página com ?tde_teste=1 (vai para "Eventos de teste").
 */
(function (w, d) {
  "use strict";
  if (w.tde && w.tde.versao) return; // já carregado

  var atual = d.currentScript;
  var BASE = atual ? new URL(atual.src).origin : "";
  var PIXEL = (atual && atual.getAttribute("data-pixel")) || "4290138017915368";
  var LANDING = (atual && atual.getAttribute("data-landing")) || "";
  // Só para o caso de o servidor não responder: o "lead" ainda dispara no pixel.
  var LEAD_RESERVA = { general: "Lead General", trader: "Lead Trader" };

  function cookie(n) {
    var m = d.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function qs(n) {
    try { return new URLSearchParams(w.location.search).get(n); } catch (e) { return null; }
  }
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  }
  function fbc() {
    var c = cookie("_fbc");
    if (c) return c;
    var id = qs("fbclid");
    if (!id) return null;
    var v = "fb.1." + Date.now() + "." + id;
    try { d.cookie = "_fbc=" + v + "; path=/; max-age=7776000; SameSite=Lax"; } catch (e) { /* ignora */ }
    return v;
  }
  function garantirPixel() {
    if (w.fbq) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(w, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    w.fbq("init", PIXEL);
    w.fbq("track", "PageView");
  }
  function pixel(nome, landing, eventId) {
    try { if (w.fbq) w.fbq("trackCustom", nome, { landing: landing }, { eventID: eventId }); } catch (e) { /* ignora */ }
  }
  function ler(k) {
    try { var v = w.sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function salvar(k, v) {
    try { w.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignora */ }
  }

  function enviar(acao, dados) {
    dados = dados || {};
    var landing = dados.landing || LANDING;
    var telefone = dados.telefone || qs("tel") || qs("phone") || "";
    var chave = "tde:" + landing + ":" + acao + ":" + String(telefone).replace(/\D/g, "");
    var avisar = typeof dados.onResultado === "function" ? dados.onResultado : function () {};

    // Recarregar a página ou clicar duas vezes não gera um segundo evento.
    var anterior = ler(chave);
    if (anterior) { avisar(anterior); return Promise.resolve(anterior); }

    garantirPixel();
    var eventId = uuid();
    var corpo = {
      acao: acao,
      landing: landing,
      event_id: eventId,
      telefone: telefone || null,
      pais_geo: dados.pais || qs("country") || null,
      idade: dados.idade || null,
      genero: dados.genero || null,
      resposta: dados.resposta || null,
      fbp: cookie("_fbp"),
      fbc: fbc(),
      url: w.location.href,
      teste: qs("tde_teste") === "1" || dados.teste === true
    };

    var ctrl = w.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 5000) : null;
    return fetch(BASE + "/api/evento", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (res && res.evento) pixel(res.evento, landing, res.event_id);
        if (res && res.ok) salvar(chave, res);
        avisar(res);
        return res;
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        var res = { ok: false, evento: null, event_id: eventId, qualificado: null };
        if (acao === "lead" && LEAD_RESERVA[landing]) { res.evento = LEAD_RESERVA[landing]; pixel(res.evento, landing, eventId); }
        avisar(res);
        return res;
      });
  }

  var fila = (w.tde && w.tde.q) || [];
  w.tde = function (comando, dados) {
    if (comando === "lead") return enviar("lead", dados);
    if (comando === "qualificar") return enviar("qualificacao", dados);
    return Promise.resolve(null);
  };
  w.tde.versao = "1";
  for (var i = 0; i < fila.length; i++) w.tde.apply(null, fila[i]);
})(window, document);
