/* LNP on the web: sign-in, team access, and the `window.claude.use("user" | "crm")` interface the page reads its data
   through, served by Supabase. Loaded before the page: `use()` resolves once the person is signed in. */
(function () {
  "use strict";
  var cfg = window.LNP_WEB_CONFIG || {};
  var hash = location.hash || "";
  // an invitation or reset link from Team access: #lnp-link=<token hash>&type=invite|recovery. The token is spent only
  // when the person saves a password, so a link preview opening the page first does not use it up.
  var pending = /lnp-link=([^&]+)/.exec(hash), pendingType = /type=(invite|recovery)/.exec(hash);
  pending = pending ? { token: decodeURIComponent(pending[1]), type: pendingType ? pendingType[1] : "invite" } : null;
  var linkType = pending ? pending.type : /type=(invite|recovery|signup|magiclink)/.exec(hash);
  linkType = pending ? linkType : linkType ? linkType[1] : null;
  var linkError = /error_description=([^&]+)/.exec(hash);

  // nothing of the app shows until the person is signed in
  document.documentElement.classList.add("lnp-locked");
  var lock = document.createElement("style");
  lock.textContent = "html.lnp-locked #app{visibility:hidden}";
  (document.head || document.documentElement).appendChild(lock);

  var sb = null, ctx = null, settle;
  var ready = new Promise(function (r) { settle = r; });
  window.claude = { web: true, use: function (name) { return ready.then(function (c) { return name === "user" ? USER : name === "crm" ? CRM : null; }); } };

  // CRM (docs/crm): relational crm_* tables on the same client. Row-level security decides what each person reads;
  // writes go only through the crm_* functions of web/supabase/004_crm_rpc.sql. Used by app/crm/data.js.
  var CRM = {
    from: function (table) { if (!/^crm_[a-z_]+$/.test(table)) throw new Error("Not a CRM table"); return sb.from(table); },
    rpc: async function (fn, args) {
      if (!/^crm_[a-z_]+$/.test(fn)) throw new Error("Not a CRM function");
      var r = await sb.rpc(fn, args || {});
      if (r.error) { var e = new Error(r.error.message); e.code = r.error.code; throw e; }
      return r.data;
    },
    me: async function () { var r = await sb.from("crm_members").select("*").eq("id", ctx.user.id).maybeSingle(); return r.data || null; },
    subscribe: function (tables, fn) {
      var ch = sb.channel("crm-" + Math.random().toString(36).slice(2));
      tables.forEach(function (t) { ch.on("postgres_changes", { event: "*", schema: "public", table: t }, function (p) { fn(t, p); }); });
      ch.subscribe();
      return function () { sb.removeChannel(ch); };
    }
  };
  var USER = {
    id: async function () { return ctx.user.id; },
    me: async function () { return { id: ctx.user.id, name: ctx.user.email, email: ctx.user.email }; },
    isOwner: function () { return ctx.role === "admin"; },
    canEdit: function () { return ctx.role === "admin"; },
    can: async function (what) { return what === "data.write" ? ctx.role === "admin" || ctx.role === "member" : null; },
    profiles: async function (ids) { var o = {}; ids.forEach(function (id) { o[id] = { id: id, name: id === ctx.user.id ? ctx.user.email : "" }; }); return o; }
  };

  // ---------------- screens: sign in, set a password, no access ----------------
  var CSS = ''
    + '.lnp-newver{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483001;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 18px;background:#1E2A5E;color:#fff;border-radius:12px;box-shadow:0 6px 24px rgba(12,19,48,.25);font:15px/1.4 Poppins,system-ui,sans-serif}'
    + '.lnp-newver button{font:inherit;font-weight:600;border:0;border-radius:9px;padding:6px 14px;background:#fff;color:#1E2A5E;cursor:pointer}'
    + '#lnp-gate{position:fixed;inset:0;z-index:2147483000;background:#F7F8FB;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '#lnp-gate .card{width:min(420px,100%);background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:32px;display:flex;flex-direction:column;gap:16px;box-sizing:border-box}'
    + '#lnp-gate .logo{font-family:Poppins,Arial,sans-serif;font-size:32px;font-weight:600}#lnp-gate .logo span{color:#5B8DF7}'
    + '#lnp-gate h1{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '#lnp-gate p{margin:0;font-size:15px;line-height:1.55;color:#5A6478}'
    + '#lnp-gate label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600}'
    + '#lnp-gate input{font:inherit;font-size:15px;letter-spacing:0;text-transform:none;font-weight:400;color:#1E2A5E;padding:11px 12px;border:1px solid #7A849E;border-radius:10px;background:#fff;outline:none}'
    + '#lnp-gate input:focus{border-color:#1E2A5E}'
    + '#lnp-gate .btn{border:0;background:#1E2A5E;color:#FFFFFF;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:12px 16px;cursor:pointer}'
    + '#lnp-gate .btn[disabled]{opacity:.6;cursor:default}'
    + '#lnp-gate .lnk{border:0;background:none;font:inherit;font-size:13px;color:#2B6CF5;cursor:pointer;padding:0;align-self:flex-start}'
    + '#lnp-gate .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}'
    + '#lnp-gate .ok{font-size:13px;color:#1E5E38;background:#E6F2EA;border-radius:8px;padding:8px 10px}'
    + '.lnp-acct{background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:28px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '.lnp-acct h2{margin:0 0 6px;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '.lnp-acct .who{font-size:15px;color:#222C4E;overflow-wrap:anywhere}.lnp-acct .q{font-size:13px;color:#5A6478;margin-top:4px}'
    + '.lnp-acct button{min-height:44px;padding:0 18px;border:1px solid #7A849E;border-radius:10px;background:#fff;color:#1E2A5E;font:inherit;font-size:15px;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.lnp-acct button:hover{border-color:#1E2A5E}'
    + '#lnp-team{font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '#lnp-team .card{width:100%;background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box}'
    + '#lnp-team h2{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:26px}'
    + '#lnp-team .q{font-size:13px;color:#5A6478;line-height:1.5}'
    + '#lnp-team .inv{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}'
    + '#lnp-team label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600}'
    + '#lnp-team input,#lnp-team select{font:inherit;font-size:15px;letter-spacing:0;text-transform:none;font-weight:400;color:#1E2A5E;padding:9px 10px;border:1px solid #7A849E;border-radius:10px;background:#fff}'
    + '#lnp-team .btn{border:0;background:#1E2A5E;color:#FFFFFF;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;white-space:nowrap}'
    + '#lnp-team .btnl{border:1px solid #AECBF2;background:#fff;color:#1E2A5E;font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:6px 11px;cursor:pointer;white-space:nowrap}'
    + '#lnp-team .btnl:hover{border-color:#1E2A5E}#lnp-team .rm{color:#9B1C12}#lnp-team .rm:hover{border-color:#B42318}'
    + '#lnp-team table{width:100%;border-collapse:collapse;font-size:15px}'
    + '#lnp-team th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600;padding:6px 8px;border-bottom:1px solid #E3ECFB}'
    + '#lnp-team td{padding:10px 8px;border-bottom:1px solid #E3ECFB;vertical-align:middle}'
    + '#lnp-team td .s{font-size:12px;color:#5A6478}'
    + '#lnp-team .linkbox{background:#F7F8FB;border:1px solid #E3ECFB;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px}'
    + '#lnp-team .linkbox code{font-variant-numeric:tabular-nums;font-size:12px;word-break:break-all;color:#222C4E}'
    + '#lnp-team .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}'
    + '.lnp-access{display:flex;flex-direction:column;gap:20px}'
    + '.lnp-access .card{background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:24px 28px;display:flex;flex-direction:column;gap:18px}'
    + '.lnp-access h2{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '.lnp-access .q{font-size:13px;color:#5A6478;line-height:1.5;margin:0}'
    + '.lnp-access .mh{display:flex;align-items:center;gap:14px}'
    + '.lnp-access .em{font-family:Poppins,Arial,sans-serif;font-size:17px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.lnp-access .st{font-size:13px;color:#5A6478}'
    + '.lnp-access .btnl{border:1px solid #AECBF2;background:#fff;color:#1E2A5E;font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:7px 12px;cursor:pointer;white-space:nowrap}.lnp-access .btnl:hover{border-color:#1E2A5E}'
    + '.lnp-access .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}'
    + '.lnp-access .area{border:1px solid #E3ECFB;border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;background:#F7F8FB}'
    + '.lnp-access .area.off{background:#fff}'
    + '.lnp-access label{display:flex;align-items:center;gap:9px;font-size:15px;color:#1E2A5E;cursor:pointer}'
    + '.lnp-access .an{font-weight:600;font-size:15px;padding-bottom:6px;border-bottom:1px solid #E3ECFB;margin-bottom:2px}'
    + '.lnp-access .cnt{margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px;font-weight:500;color:#5A6478}'
    + '.lnp-access .gn{margin-top:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600}'
    + '.lnp-access input[type=checkbox]{width:16px;height:16px;accent-color:#1E2A5E;margin:0;flex-shrink:0}'
    + '.lnp-access .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}';

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  var gate = null;
  function showGate(view, msg) {
    if (!gate) { gate = h("div", { id: "lnp-gate", role: "dialog", "aria-modal": "true", "aria-label": "Connexion à LNP" }); document.body.appendChild(gate); }
    gate.textContent = "";
    var card = h("div", { "class": "card" }, [h("div", { "class": "logo" }, ["LNP ", h("span", { text: "Ventes" })])]);
    // C7 (2026-11-09): an error is announced to screen readers; the tab says where the person is
    var note = msg ? h("div", { "class": msg.ok ? "ok" : "err", role: msg.ok ? "status" : "alert", text: msg.text }) : null;
    document.title = view === "signin" || !view ? "LNP · Connexion" : "LNP";
    if (view === "config") {
      card.appendChild(h("h1", { text: "Pas encore configuré" }));
      card.appendChild(h("p", { text: "La connexion à la base de données manque. Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le projet Vercel, puis rechargez la page." }));
    } else if (view === "loading") {
      card.appendChild(h("p", { text: "Connexion en cours…" }));
    } else if (view === "denied") {
      card.appendChild(h("h1", { text: "Pas encore d’accès" }));
      card.appendChild(h("p", { text: "Vous êtes connecté avec " + (ctx && ctx.user ? ctx.user.email : "") + ", mais ce compte ne fait pas partie de l’équipe LNP. Demandez à un administrateur de vous inviter." }));
      card.appendChild(h("button", { "class": "btn", type: "button", text: "Se déconnecter", onclick: signOut }));
    } else if (view === "noscreens") {
      card.appendChild(h("h1", { text: "Aucun écran ouvert pour l’instant" }));
      card.appendChild(h("p", { text: "Vous faites partie de l’équipe LNP, mais aucun écran ne vous est encore ouvert. Demandez à un administrateur d’en ouvrir dans Paramètres › Accès." }));
      card.appendChild(h("button", { "class": "btn", type: "button", text: "Se déconnecter", onclick: signOut }));
    } else if (view === "setpw") {
      var p1 = h("input", { type: "password", autocomplete: "new-password", minlength: "8", required: "" });
      var p2 = h("input", { type: "password", autocomplete: "new-password", minlength: "8", required: "" });
      var go = h("button", { "class": "btn", type: "submit", text: "Enregistrer mon mot de passe" });
      card.appendChild(h("h1", { text: linkType === "recovery" ? "Choisissez un nouveau mot de passe" : "Bienvenue sur LNP" }));
      card.appendChild(h("p", { text: "Choisissez le mot de passe qui vous servira à vous connecter" + (ctx && ctx.user ? " avec " + ctx.user.email : "") + ". 8 caractères au moins." }));
      if (note) card.appendChild(note);
      var f = h("form", { style: "display:flex;flex-direction:column;gap:14px" }, [
        h("label", {}, ["Mot de passe", p1]), h("label", {}, ["Répétez le mot de passe", p2]), go]);
      f.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (p1.value.length < 8) return showGate("setpw", { text: "Utilisez au moins 8 caractères." });
        if (p1.value !== p2.value) return showGate("setpw", { text: "Les deux mots de passe ne sont pas identiques." });
        go.disabled = true;
        if (pending) {
          var v = await sb.auth.verifyOtp({ type: pending.type, token_hash: pending.token });
          pending = null;
          if (v.error) { linkType = null; return showGate("signin", { text: "Ce lien a déjà servi ou a expiré. Demandez-en un nouveau à un administrateur (Accès de l’équipe › Nouveau lien d’invitation)." }); }
        }
        var r = await sb.auth.updateUser({ password: p1.value });
        if (r.error) return showGate("setpw", { text: authFr(r.error.message) });
        linkType = null;
        enter();
      });
      card.appendChild(f);
      setTimeout(function () { p1.focus(); }, 0);
    } else {
      var em = h("input", { type: "email", autocomplete: "username", required: "", placeholder: "vous@exemple.fr" });
      if (msg && msg.email) em.value = msg.email;   // the e-mail typed stays after an error
      var pw = h("input", { type: "password", autocomplete: "current-password", required: "" });
      var btn = h("button", { "class": "btn", type: "submit", text: "Se connecter" });
      card.appendChild(h("h1", { text: "Connexion" }));
      card.appendChild(h("p", { text: "LNP est réservé à l’équipe LNP. Utilisez l’adresse e-mail avec laquelle vous avez été invité." }));
      if (note) card.appendChild(note);
      var form = h("form", { style: "display:flex;flex-direction:column;gap:14px" }, [
        h("label", {}, ["E-mail", em]), h("label", {}, ["Mot de passe", pw]), btn]);
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        btn.disabled = true; btn.textContent = "Connexion…";
        var r = await sb.auth.signInWithPassword({ email: em.value.trim(), password: pw.value });
        if (r.error) return showGate("signin", { email: em.value.trim(), text: /invalid/i.test(r.error.message) ? "E-mail ou mot de passe incorrect." : authFr(r.error.message) });
        enter();
      });
      card.appendChild(form);
      card.appendChild(h("p", { style: "font-size:13px", text: "Mot de passe oublié ? Demandez un lien de réinitialisation à un administrateur (Accès de l’équipe)." }));
      setTimeout(function () { (em.value ? pw : em).focus(); }, 0);
    }
    gate.appendChild(card);
  }
  // Supabase Auth answers in English: the messages a person can meet here, in French (LNP, Romain 2026-11-03)
  function authFr(m) {
    m = String(m || "");
    if (/should be different/i.test(m)) return "Le nouveau mot de passe doit être différent de l’ancien.";
    if (/at least \d+ characters|password should be/i.test(m)) return "Ce mot de passe est trop court ou trop simple.";
    if (/weak|pwned|leaked|compromised/i.test(m)) return "Ce mot de passe est trop facile à deviner : choisissez-en un autre.";
    if (/not confirmed/i.test(m)) return "Cette adresse n’est pas encore confirmée : utilisez le lien d’invitation reçu.";
    if (/rate limit|too many|security purposes/i.test(m)) return "Trop de tentatives : patientez un instant, puis réessayez.";
    if (/expired|invalid.*(token|link|otp)|otp.*(expired|invalid)/i.test(m)) return "Ce lien a déjà servi ou a expiré. Demandez-en un nouveau à un administrateur.";
    if (/network|fetch/i.test(m)) return "Connexion au serveur impossible : vérifiez votre réseau, puis réessayez.";
    return "La connexion a échoué. Réessayez, ou demandez de l’aide à un administrateur.";
  }
  function hideGate() { if (gate) { gate.remove(); gate = null; } }

  async function signOut() { try { await sb.auth.signOut(); } catch (e) {} location.replace(location.pathname); }

  async function enter() {
    showGate("loading");
    var s = await sb.auth.getSession();
    var session = s.data && s.data.session;
    if (!session) return showGate("signin");
    if (linkType === "invite" || linkType === "recovery") { ctx = { user: session.user, role: null }; return showGate("setpw"); }
    var me = {};
    try { var rr = await fetch("/api/me", { headers: { Authorization: "Bearer " + session.access_token } }); me = await rr.json(); } catch (e) {}
    ctx = { user: session.user, role: me.role || null, access: me.access || [], token: session.access_token };
    if (!ctx.role) return showGate("denied");
    if (!ctx.access.length) return showGate("noscreens");
    applyAccess();
    hideGate();
    document.documentElement.classList.remove("lnp-locked");
    settle(ctx);
    account();
  }

  // ---------------- screens each person may open (Settings › Access) ----------------
  var AREAS = [
    { key: "ss", name: "Ventes", home: "salescockpit", groups: [["Sales System", [["salescockpit", "Cockpit commercial"], ["salescycle", "Cycle de vente"], ["crm", "CRM"]], "Ventes"], ["Training", [["entrainement", "Découverte"], ["academie", "Maîtrise de l’offre"]], "Entraînement"]] },
    { key: "settings", name: "Paramètres", home: "settings", groups: [["Settings", [["settings", "Alertes et notifications"]], "Paramètres"]] },
    // not a screen: the LNP connector in Claude (docs/crm/17-claude-connector.md); admins only by default
    { key: "claude", name: "Claude", nav: false, groups: [["Claude", [["claude", "Connecteur Claude"]]]] }
  ];
  // g[0] is the group's key (the sidebar's data-navgrp, nav.py), g[2] its French title when it differs.
  // The Access panel lists only what this edition's sidebar shows (LNP: Ventes and Paramètres) and the Claude connector.
  function inNav(id) {
    var keep = window.LNP_EDITION && window.LNP_EDITION.keep;   // the page's screens (app/build.py)
    return id === "claude" || !keep || keep.indexOf(id) >= 0;
  }
  var NAV = AREAS.filter(function (a) { return a.nav !== false; });
  var fileOf = {}, idOf = {};
  function areaIds(a) { var o = []; a.groups.forEach(function (g) { g[1].forEach(function (x) { o.push(x[0]); }); }); return o; }
  function areaOf(id) { return NAV.filter(function (a) { return areaIds(a).indexOf(id) >= 0; })[0]; }
  function shownIds(a) { return areaIds(a).filter(inNav); }
  function allowed(id) { return id === "account" || ctx.access.indexOf(id) >= 0; }   // everyone keeps Settings › Account (sign out)
  function slug(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function goScreen(id) {
    var app = document.getElementById("app"); if (!app || !fileOf[id]) return;
    var a = document.createElement("a"); a.setAttribute("href", fileOf[id]); a.style.display = "none";
    app.appendChild(a); a.click(); a.remove();
  }
  function applyAccess() {
    document.querySelectorAll("template[data-file]").forEach(function (t) { var id = t.id.replace("tpl-", ""); fileOf[id] = t.getAttribute("data-file"); idOf[fileOf[id]] = id; });
    if (ctx.role === "admin") document.documentElement.classList.add("lnp-admin");
    // hide what is not open: sidebar entries, view tabs, empty groups, systems with nothing open
    var css = [];
    Object.keys(fileOf).forEach(function (id) {
      if (allowed(id)) return;
      var f = fileOf[id];
      css.push('#app [data-navitems] a[href="' + f + '"]', '#app [data-topbar] a[href="' + f + '"]');
    });
    NAV.forEach(function (a) {
      var any = areaIds(a).some(allowed);
      a.groups.forEach(function (g) {
        if (!g[1].some(function (x) { return allowed(x[0]); })) { var k = a.key + "-" + slug(g[0]); css.push('#app [data-navgrp="' + k + '"]', '#app [data-navitems="' + k + '"]'); }
      });
      if (a.key === "settings") return;   // the Settings button stays: everyone reaches Settings › Account (sign out), admins Access
      if (!any) css.push('#app [aria-label="Changer de système"] a[href="' + fileOf[a.home] + '"]');
    });
    var st = document.createElement("style"); st.textContent = css.join(",\n") + "{display:none!important}"; document.head.appendChild(st);
    // block navigation to a closed screen; a system switch lands on its first open screen
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if (!a) return;
      var id = idOf[a.getAttribute("href")]; if (!id || allowed(id)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var ar = areaOf(id), alt = ar ? areaIds(ar).filter(allowed)[0] : null;
      if (!alt && ar && ar.key === "settings") alt = "account";
      if (alt) goScreen(alt);
    }, true);
    // start on an open screen
    var cur = document.querySelector('#app nav [data-navitems] a[aria-current="page"]');
    var curId = cur ? idOf[cur.getAttribute("href")] : "cockpit";
    if (!allowed(curId)) { var first = null; NAV.some(function (a) { first = areaIds(a).filter(allowed)[0]; return !!first; }); if (first) goScreen(first); }
  }

  // the admin panel, drawn into Settings › Access
  var acc = { data: null, loading: false, err: "", saved: {} };
  async function loadAccess() {
    if (acc.loading) return; acc.loading = true;
    try { acc.data = await api("GET"); acc.err = ""; } catch (e) { acc.err = e.message; }
    acc.loading = false; drawAccess();
  }
  async function saveAccess(m, list) {
    acc.saved[m.user_id] = "Enregistrement…"; drawAccess();
    try { var j = await api("POST", { action: "access", user_id: m.user_id, access: list }); m.access = j.access; acc.saved[m.user_id] = "Enregistré"; }
    catch (e) { acc.saved[m.user_id] = e.message; }
    drawAccess();
  }
  function drawAccess() {
    document.querySelectorAll("[data-access]").forEach(function (box) {
      if (ctx.role !== "admin") return;
      box.setAttribute("data-access-drawn", "1");
      box.textContent = "";
      box.className = "lnp-access";
      if (acc.err) { box.appendChild(h("div", { "class": "err", text: acc.err })); return; }
      if (!acc.data) { box.appendChild(h("div", { "class": "card" }, [h("p", { "class": "q", text: "Chargement de l’équipe…" })])); if (!acc.loading) loadAccess(); return; }
      box.appendChild(h("div", { "class": "card" }, [h("h2", { text: "Qui ouvre quoi" }), h("p", { "class": "q", text: "Par défaut, tout le monde ouvre tout, nouveaux venus compris. Décochez un espace (Ventes, Paramètres) pour le fermer entièrement à cette personne, ou décochez des écrans un par un. Ce qui est fermé disparaît de son menu et ne peut plus être ouvert. Les administrateurs peuvent aussi être restreints, mais gardent Paramètres › Accès ; personne ne change ses propres accès. La case Claude permet d’utiliser le connecteur LNP dans Claude (lecture seule, réservé aux administrateurs par défaut). Cela cache des écrans, pas des données : les règles du CRM décident toujours quels prospects chacun voit." })]));
      if (acc.data.members.length < 2) box.appendChild(h("div", { "class": "card" }, [h("h2", { text: "Personne à configurer pour l’instant" }), h("p", { "class": "q", text: "Invitez des personnes avec Accès de l’équipe, dans Paramètres › Compte. Elles commencent avec tout ouvert." })]));
      acc.data.members.forEach(function (m) {
        var isMe = m.user_id === acc.data.me;
        var head = h("div", { "class": "mh" }, [
          h("div", { style: "flex:1;min-width:0" }, [h("div", { "class": "em", text: m.email + (m.user_id === acc.data.me ? " (vous)" : "") }),
            h("div", { "class": "q", text: (ROLE_TXT[m.role] || m.role) + (m.lastSignIn ? " · dernière connexion le " + new Date(m.lastSignIn).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : " · ne s’est pas encore connecté") })]),
          acc.saved[m.user_id] ? h("span", { "class": "st", text: acc.saved[m.user_id] }) : null,
          isMe ? null : h("button", { "class": "btnl", type: "button", text: "Tout ouvrir", onclick: function () { saveAccess(m, null); } })]);
        var card = h("div", { "class": "card" }, [head]);
        if (isMe) { card.appendChild(h("p", { "class": "q", text: "C’est vous : un autre administrateur peut changer vos accès." })); box.appendChild(card); return; }
        var set = {}; (m.access || []).forEach(function (x) { set[x] = 1; });
        var grid = h("div", { "class": "grid" });
        AREAS.forEach(function (a) {
          var ids = shownIds(a), n = ids.filter(function (x) { return set[x]; }).length;
          if (!ids.length) return;
          var all = h("input", { type: "checkbox", "aria-label": "Tout ouvrir dans " + a.name });
          all.checked = n === ids.length; all.indeterminate = n > 0 && n < ids.length;
          all.addEventListener("change", function () { var next = Object.assign({}, set); ids.forEach(function (x) { if (all.checked) next[x] = 1; else delete next[x]; }); saveAccess(m, Object.keys(next)); });
          var col = h("div", { "class": "area" + (n ? "" : " off") }, [h("label", { "class": "an" }, [all, h("span", { text: a.name }), h("span", { "class": "cnt", text: n + "/" + ids.length })])]);
          a.groups.forEach(function (g) {
            if (a.groups.length > 1) col.appendChild(h("div", { "class": "gn", text: g[2] || g[0] }));
            g[1].filter(function (x) { return inNav(x[0]); }).forEach(function (x) {
              var cb = h("input", { type: "checkbox" }); cb.checked = !!set[x[0]];
              cb.addEventListener("change", function () { var next = Object.assign({}, set); if (cb.checked) next[x[0]] = 1; else delete next[x[0]]; saveAccess(m, Object.keys(next)); });
              col.appendChild(h("label", { "class": "sc" }, [cb, h("span", { text: x[1] })]));
            });
          });
          grid.appendChild(col);
        });
        card.appendChild(grid);
        box.appendChild(card);
      });
    });
  }

  // ---------------- Settings › Account: who is signed in, sign out, Team access (Romain, 2026-10-26: not in the sidebar) ----
  function account() {
    var paint = function () {
      if (ctx.role === "admin" && document.querySelector("[data-access]:not([data-access-drawn])")) drawAccess();
      document.querySelectorAll("[data-account]:not([data-account-drawn])").forEach(function (box) {
        box.setAttribute("data-account-drawn", "1");
        box.textContent = "";
        box.appendChild(h("section", { "class": "lnp-acct" }, [
          h("div", { style: "flex:1;min-width:240px" }, [h("h2", { text: "Connecté" }),
            h("div", { "class": "who", text: ctx.user.email }),
            h("div", { "class": "q", text: (ROLE_TXT[ctx.role] || ctx.role) + (ctx.role === "viewer" ? " · lecture seule" : "") })]),
          h("button", { type: "button", text: "Se déconnecter", onclick: signOut })]));
        if (ctx.role === "admin") { var t = h("div", { id: "lnp-team", role: "region", "aria-label": "Accès de l’équipe" }); box.appendChild(t); team(t); }
      });
    };
    paint();
    new MutationObserver(paint).observe(document.body, { childList: true, subtree: true });
    sb.auth.onAuthStateChange(function (ev, session) { if (session) ctx.token = session.access_token; if (ev === "SIGNED_OUT") location.replace(location.pathname); });
  }

  async function api(method, body) {
    var s = await sb.auth.getSession();
    var r = await fetch("/api/team", { method: method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + (s.data.session ? s.data.session.access_token : "") }, body: body ? JSON.stringify(body) : undefined });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || "La requête a échoué.");
    return j;
  }
  var ROLE_TXT = { admin: "Administrateur · gère l’équipe", member: "Membre · lit et modifie", viewer: "Lecteur · lit seulement" };
  function team(wrap) {
    var card = h("div", { "class": "card" });
    wrap.appendChild(card);
    var flash = null;
    function linkBox(title, email, link) {
      var copy = h("button", { "class": "btnl", type: "button", text: "Copier le lien" });
      copy.addEventListener("click", function () { navigator.clipboard.writeText(link).then(function () { copy.textContent = "Copié"; }); });
      return h("div", { "class": "linkbox" }, [h("strong", { text: title }),
        h("span", { text: "Envoyez ce lien à " + email + " (Slack, e-mail…). Il ouvre LNP et lui demande de choisir un mot de passe. Il ne sert qu’une fois ; s’il ne marche plus, créez-en un nouveau ici (Nouveau lien d’invitation)." }),
        h("code", { text: link }), h("div", {}, [copy])]);
    }
    function roleSel(v) {
      var s = h("select", {});
      Object.keys(ROLE_TXT).forEach(function (k) { var o = h("option", { value: k, text: ROLE_TXT[k] }); if (k === v) o.selected = true; s.appendChild(o); });
      return s;
    }
    async function draw(err) {
      card.textContent = "";
      card.appendChild(h("div", { style: "display:flex;flex-direction:column;gap:4px" }, [h("h2", { text: "Accès de l’équipe" }),
        h("div", { "class": "q", text: "Qui peut ouvrir LNP, et ce que chacun peut faire. Invitez quelqu’un, puis envoyez-lui son lien. Les écrans que chacun ouvre : l’onglet Accès. Le numéro WhatsApp Business de chacun rattache ses messages aux prospects." })]));
      if (err) card.appendChild(h("div", { "class": "err", text: err }));
      var em = h("input", { type: "email", placeholder: "nom@exemple.fr", style: "min-width:240px" });
      var rs = roleSel("member");
      var inv = h("button", { "class": "btn", type: "button", text: "Inviter" });
      inv.addEventListener("click", async function () {
        inv.disabled = true;
        try { var j = await api("POST", { action: "invite", email: em.value, role: rs.value }); flash = linkBox("Invitation prête pour " + j.email, j.email, j.link); draw(); }
        catch (e) { draw(e.message); }
      });
      card.appendChild(h("div", { "class": "inv" }, [h("label", { style: "flex:1" }, ["E-mail", em]), h("label", {}, ["Rôle", rs]), inv]));
      if (flash) card.appendChild(flash);
      var tbl = h("table", {}, [h("thead", {}, [h("tr", {}, [h("th", { text: "Membre" }), h("th", { text: "Rôle" }), h("th", { text: "Fonction" }), h("th", { text: "WhatsApp Business" }), h("th", { text: "" })])])]);
      var tb = h("tbody", {}); tbl.appendChild(tb);
      card.appendChild(tbl);
      tb.appendChild(h("tr", {}, [h("td", { colspan: "5", "class": "q", text: "Chargement…" })]));
      var data;
      try { data = await api("GET"); } catch (e) { tb.textContent = ""; tb.appendChild(h("tr", {}, [h("td", { colspan: "5" }, [h("div", { "class": "err", text: e.message })])])); return; }
      tb.textContent = "";
      data.members.forEach(function (m) {
        var self = m.user_id === data.me;
        var sel = roleSel(m.role);
        sel.disabled = self;
        sel.addEventListener("change", async function () { try { await api("POST", { action: "role", user_id: m.user_id, role: sel.value }); draw(); } catch (e) { draw(e.message); } });
        var reset = h("button", { "class": "btnl", type: "button", text: m.confirmed ? "Lien de réinitialisation" : "Nouveau lien d’invitation" });
        reset.addEventListener("click", async function () { try { var j = await api("POST", { action: "reset", user_id: m.user_id }); flash = linkBox((m.confirmed ? "Lien de réinitialisation du mot de passe pour " : "Nouveau lien d’invitation pour ") + j.email, j.email, j.link); draw(); } catch (e) { draw(e.message); } });
        var rm = h("button", { "class": "btnl rm", type: "button", text: "Retirer" });
        rm.addEventListener("click", function () {
          var go = async function () { try { await api("POST", { action: "remove", user_id: m.user_id }); flash = null; draw(); } catch (e) { draw(e.message); } };
          if (!window.lnpConfirm) { if (rm.dataset.sure !== "1") { rm.dataset.sure = "1"; rm.textContent = "Confirmer le retrait"; return; } return go(); }
          window.lnpConfirm({ title: "Retirer cette personne ?", body: m.email + " ne pourra plus se connecter à LNP. Son travail reste dans les données partagées.", ok: "Retirer l’accès", onOk: go });
        });
        // the WhatsApp Business number links this person's messages to them (saved when the field is left)
        var wa = h("input", { type: "tel", value: m.whatsapp || "", placeholder: "+33 6 12 34 56 78", "aria-label": "Numéro WhatsApp Business de " + m.email, style: "width:170px" });
        wa.addEventListener("change", async function () {
          try { var j = await api("POST", { action: "whatsapp", user_id: m.user_id, number: wa.value }); wa.value = j.whatsapp || ""; m.whatsapp = wa.value; }
          catch (e) { draw(e.message); }
        });
        // the job in the CRM (054): sales rep or setter; an admin stays admin
        var fnc;
        if (m.crm_role === "sales" || m.crm_role === "setter") {
          fnc = h("select", { "aria-label": "Fonction de " + m.email }, [h("option", { value: "sales", text: "Commercial" }), h("option", { value: "setter", text: "Setter" })]);
          fnc.value = m.crm_role;
          fnc.addEventListener("change", async function () { try { await api("POST", { action: "crmrole", user_id: m.user_id, crm_role: fnc.value }); m.crm_role = fnc.value; } catch (e) { draw(e.message); } });
        } else fnc = h("span", { "class": "s", text: m.crm_role === "admin" ? "Administrateur" : m.crm_role ? "Lecteur" : "—" });
        var last = m.lastSignIn ? "Dernière connexion le " + new Date(m.lastSignIn).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "Invité · ne s’est pas encore connecté";
        tb.appendChild(h("tr", {}, [
          h("td", {}, [h("div", { text: m.email + (self ? " (vous)" : "") }), h("div", { "class": "s", text: last })]),
          h("td", {}, [sel]),
          h("td", {}, [fnc]),
          h("td", {}, [wa]),
          h("td", { style: "text-align:right;white-space:nowrap" }, self ? [] : [reset, " ", rm])]));
      });
    }
    draw();
  }

  // ---------------- the version of the page (2026-11-08) ----------------
  // A browser can show a page it kept in its cache, such as a tab it reopens when it starts: an older version than the one
  // deployed, without the newer screens. The page carries its build id (web/build_web.py) and compares it with
  // /version.json: at the opening it reloads once by itself; later (when the person comes back to the tab, at most every
  // 10 min) it offers to reload, so nothing typed is lost.
  var verAt = 0, verBar = null;
  function newer(cb) {
    var mine = window.LNP_BUILD; if (!mine || !window.fetch) return;
    verAt = Date.now();
    fetch("/version.json?t=" + verAt, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { if (v && v.build && v.build !== mine) cb(v.build); }, function () {});
  }
  function offerReload() {
    if (verBar || !document.body) return;
    verBar = h("div", { "class": "lnp-newver", role: "status" }, [
      h("span", { text: "Une nouvelle version de LNP est disponible." }),
      h("button", { type: "button", text: "Recharger", onclick: function () { location.reload(); } })]);
    document.body.appendChild(verBar);
  }
  function watchVersion() {
    newer(function (b) {
      var k = "lnp-reloaded-for", done = null;
      try { done = sessionStorage.getItem(k); sessionStorage.setItem(k, b); } catch (e) {}
      if (done === b) offerReload(); else location.reload();   // once only: never a reload loop
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible" && Date.now() - verAt > 600000) newer(offerReload);
    });
  }

  // ---------------- start ----------------
  function boot() {
    watchVersion();
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    if (!cfg.url || !cfg.anonKey || !window.supabase) return showGate("config");
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    if (linkError) { history.replaceState(null, "", location.pathname); return showGate("signin", { text: authFr(decodeURIComponent(linkError[1].replace(/\+/g, " "))) }); }
    if (pending) { history.replaceState(null, "", location.pathname); return showGate("setpw"); }
    enter();
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
