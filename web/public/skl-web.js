/* LNP on the web: sign-in, team access, and the same `window.claude.use("db" | "user")` interface the
   app uses inside a claude.ai Artifact, served by Supabase. Loaded before the app, so the app itself is
   unchanged: store.js and the LNP Map wait for `use()`, which resolves once the person is signed in. */
(function () {
  "use strict";
  var cfg = window.SKL_WEB_CONFIG || {};
  var hash = location.hash || "";
  // an invitation or reset link from Team access: #skl-link=<token hash>&type=invite|recovery. The token is spent only
  // when the person saves a password, so a link preview opening the page first does not use it up.
  var pending = /skl-link=([^&]+)/.exec(hash), pendingType = /type=(invite|recovery)/.exec(hash);
  pending = pending ? { token: decodeURIComponent(pending[1]), type: pendingType ? pendingType[1] : "invite" } : null;
  var linkType = pending ? pending.type : /type=(invite|recovery|signup|magiclink)/.exec(hash);
  linkType = pending ? linkType : linkType ? linkType[1] : null;
  var linkError = /error_description=([^&]+)/.exec(hash);

  // nothing of the app shows until the person is signed in
  document.documentElement.classList.add("skl-locked");
  var lock = document.createElement("style");
  lock.textContent = "html.skl-locked #app{visibility:hidden}";
  (document.head || document.documentElement).appendChild(lock);

  var sb = null, ctx = null, settle;
  var ready = new Promise(function (r) { settle = r; });
  window.claude = { web: true, use: function (name) { return ready.then(function (c) { return name === "db" ? DB : name === "user" ? USER : name === "assets" ? ASSETS : name === "crm" ? CRM : null; }); } };

  // ---------------- data: one cache per collection, kept live by Supabase Realtime ----------------
  var cols = {}, channel = null;
  function col(name) {
    if (!cols[name]) cols[name] = { map: new Map(), subs: [], loaded: false, loading: null };
    return cols[name];
  }
  function snapshot(c) {
    var docs = [];
    c.map.forEach(function (body, id) { docs.push({ id: id, data: function () { return JSON.parse(JSON.stringify(body)); } }); });
    return { docs: docs, size: docs.length, empty: docs.length === 0 };
  }
  function emit(name) { var c = col(name), s = snapshot(c); c.subs.forEach(function (fn) { try { fn(s); } catch (e) { console.error(e); } }); }
  function load(name) {
    var c = col(name);
    if (c.loading) return c.loading;
    c.loading = (async function () {
      var from = 0, size = 1000;
      for (;;) {
        var r = await sb.from("docs").select("id, body").eq("col", name).range(from, from + size - 1);
        if (r.error) throw r.error;
        r.data.forEach(function (row) { c.map.set(row.id, row.body); });
        if (r.data.length < size) break;
        from += size;
      }
      c.loaded = true;
    })();
    return c.loading;
  }
  function live() {
    if (channel) return;
    channel = sb.channel("skl-docs").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, function (p) {
      var row = p.eventType === "DELETE" ? p.old : p["new"];
      if (!row || !row.col || !cols[row.col]) return;
      var c = cols[row.col];
      if (p.eventType === "DELETE") c.map.delete(row.id); else c.map.set(row.id, row.body);
      emit(row.col);
    }).subscribe();
  }
  function fail(e) {
    var err = new Error((e && e.message) || "Échec de l’enregistrement");
    var denied = e && (e.code === "42501" || /row-level security|permission/i.test(e.message || ""));
    err.code = denied ? "invalid_argument" : "unavailable";
    return err;
  }
  function docRef(name, id) {
    return {
      id: id,
      get: async function () { await load(name); var b = col(name).map.get(id); return { id: id, exists: b !== undefined, data: function () { return b === undefined ? undefined : JSON.parse(JSON.stringify(b)); } }; },
      set: async function (body) {
        var clean = JSON.parse(JSON.stringify(body));
        var r = await sb.from("docs").upsert({ col: name, id: id, body: clean });
        if (r.error) throw fail(r.error);
        col(name).map.set(id, clean); emit(name);
      },
      update: async function (patch) { var cur = col(name).map.get(id) || {}; return this.set(Object.assign({}, cur, patch)); },
      "delete": async function () {
        var r = await sb.from("docs").delete().eq("col", name).eq("id", id);
        if (r.error) throw fail(r.error);
        col(name).map.delete(id); emit(name);
      }
    };
  }
  function collectionRef(name) {
    return {
      doc: function (id) { return docRef(name, id); },
      get: async function () { await load(name); return snapshot(col(name)); },
      onSnapshot: function (fn, onErr) {
        var c = col(name);
        c.subs.push(fn);
        live();
        load(name).then(function () { fn(snapshot(c)); }, function (e) { if (onErr) onErr(e); else console.error(e); });
        return function () { c.subs = c.subs.filter(function (x) { return x !== fn; }); };
      }
    };
  }
  var DB = {
    collection: collectionRef,
    doc: function (path) { var i = path.lastIndexOf("/"); return docRef(path.slice(0, i), path.slice(i + 1)); }
  };
  // Library files: private Supabase Storage, through short-lived signed URLs issued by /api/files
  async function filesApi(body) {
    var s = await sb.auth.getSession();
    var r = await fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (s.data.session ? s.data.session.access_token : "") }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var err = new Error(j.error || "La demande de fichier a échoué."); err.code = r.status === 403 ? "not_granted" : "unavailable"; throw err; }
    return j;
  }
  var ASSETS = {
    upload: async function (file) {
      var t = await filesApi({ action: "upload", name: file.name, type: file.type, size: file.size });
      var up = await sb.storage.from("library").uploadToSignedUrl(t.path, t.token, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) { var e = new Error(up.error.message); e.code = "unavailable"; throw e; }
      return { id: t.path, name: file.name, contentType: file.type || "", sizeBytes: file.size };
    },
    open: async function (id, opts) { return (await filesApi({ action: "url", path: id, download: opts && opts.download ? opts.download : "" })).url; }
  };
  // CRM (docs/crm): relational crm_* tables on the same client. Row-level security decides what each person reads;
  // writes go only through the crm_* functions of web/supabase/004_crm_rpc.sql. Used by skl-os/crm/data.js.
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
    + '#skl-gate{position:fixed;inset:0;z-index:2147483000;background:#F7F8FB;display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '#skl-gate .card{width:min(420px,100%);background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:32px;display:flex;flex-direction:column;gap:16px;box-sizing:border-box}'
    + '#skl-gate .logo{font-family:Poppins,Arial,sans-serif;font-size:30px;font-weight:600}#skl-gate .logo span{color:#5B8DF7}'
    + '#skl-gate h1{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '#skl-gate p{margin:0;font-size:14px;line-height:1.55;color:#5A6478}'
    + '#skl-gate label{display:flex;flex-direction:column;gap:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600}'
    + '#skl-gate input{font:inherit;font-size:15px;letter-spacing:0;text-transform:none;font-weight:400;color:#1E2A5E;padding:11px 12px;border:1px solid #AECBF2;border-radius:10px;background:#fff;outline:none}'
    + '#skl-gate input:focus{border-color:#1E2A5E}'
    + '#skl-gate .btn{border:0;background:#1E2A5E;color:#5B8DF7;font:inherit;font-size:15px;font-weight:600;border-radius:10px;padding:12px 16px;cursor:pointer}'
    + '#skl-gate .btn[disabled]{opacity:.6;cursor:default}'
    + '#skl-gate .lnk{border:0;background:none;font:inherit;font-size:13px;color:#2B6CF5;cursor:pointer;padding:0;align-self:flex-start}'
    + '#skl-gate .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}'
    + '#skl-gate .ok{font-size:13px;color:#1E5E38;background:#E6F2EA;border-radius:8px;padding:8px 10px}'
    + '.skl-acct{background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:28px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '.skl-acct h2{margin:0 0 6px;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '.skl-acct .who{font-size:15px;color:#222C4E;overflow-wrap:anywhere}.skl-acct .q{font-size:13px;color:#5A6478;margin-top:4px}'
    + '.skl-acct button{min-height:44px;padding:0 18px;border:1px solid #AECBF2;border-radius:10px;background:#fff;color:#1E2A5E;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}'
    + '.skl-acct button:hover{border-color:#1E2A5E}'
    + '#skl-team{font-family:"Poppins",system-ui,sans-serif;color:#1E2A5E}'
    + '#skl-team .card{width:100%;background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:28px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box}'
    + '#skl-team h2{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:24px}'
    + '#skl-team .q{font-size:13px;color:#5A6478;line-height:1.5}'
    + '#skl-team .inv{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}'
    + '#skl-team label{display:flex;flex-direction:column;gap:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;font-weight:600}'
    + '#skl-team input,#skl-team select{font:inherit;font-size:14px;letter-spacing:0;text-transform:none;font-weight:400;color:#1E2A5E;padding:9px 10px;border:1px solid #AECBF2;border-radius:10px;background:#fff}'
    + '#skl-team .btn{border:0;background:#1E2A5E;color:#5B8DF7;font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;white-space:nowrap}'
    + '#skl-team .btnl{border:1px solid #AECBF2;background:#fff;color:#1E2A5E;font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:6px 11px;cursor:pointer;white-space:nowrap}'
    + '#skl-team .btnl:hover{border-color:#1E2A5E}#skl-team .rm{color:#9B1C12}#skl-team .rm:hover{border-color:#B42318}'
    + '#skl-team table{width:100%;border-collapse:collapse;font-size:14px}'
    + '#skl-team th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#747D9A;font-weight:600;padding:6px 8px;border-bottom:1px solid #E3ECFB}'
    + '#skl-team td{padding:10px 8px;border-bottom:1px solid #E3ECFB;vertical-align:middle}'
    + '#skl-team td .s{font-size:12px;color:#747D9A}'
    + '#skl-team .linkbox{background:#F7F8FB;border:1px solid #E3ECFB;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px}'
    + '#skl-team .linkbox code{font-family:"IBM Plex Mono",monospace;font-size:12px;word-break:break-all;color:#222C4E}'
    + '#skl-team .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}'
    + '.skl-access{display:flex;flex-direction:column;gap:20px}'
    + '.skl-access .card{background:#fff;border:1px solid #E3ECFB;border-radius:14px;padding:24px 28px;display:flex;flex-direction:column;gap:18px}'
    + '.skl-access h2{margin:0;font-family:Poppins,Arial,sans-serif;font-weight:500;font-size:22px}'
    + '.skl-access .q{font-size:13px;color:#5A6478;line-height:1.5;margin:0}'
    + '.skl-access .mh{display:flex;align-items:center;gap:14px}'
    + '.skl-access .em{font-family:Poppins,Arial,sans-serif;font-size:19px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.skl-access .st{font-size:13px;color:#5A6478}'
    + '.skl-access .btnl{border:1px solid #AECBF2;background:#fff;color:#1E2A5E;font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:7px 12px;cursor:pointer;white-space:nowrap}.skl-access .btnl:hover{border-color:#1E2A5E}'
    + '.skl-access .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}'
    + '.skl-access .area{border:1px solid #E3ECFB;border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;background:#F4F7FE}'
    + '.skl-access .area.off{background:#fff}'
    + '.skl-access label{display:flex;align-items:center;gap:9px;font-size:14px;color:#1E2A5E;cursor:pointer}'
    + '.skl-access .an{font-weight:600;font-size:15px;padding-bottom:6px;border-bottom:1px solid #E3ECFB;margin-bottom:2px}'
    + '.skl-access .cnt{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:500;color:#5A6478}'
    + '.skl-access .gn{margin-top:6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#747D9A;font-weight:600}'
    + '.skl-access input[type=checkbox]{width:16px;height:16px;accent-color:#1E2A5E;margin:0;flex-shrink:0}'
    + '.skl-access .err{font-size:13px;color:#9B1C12;background:#FDECEA;border-radius:8px;padding:8px 10px}';

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
    if (!gate) { gate = h("div", { id: "skl-gate", role: "dialog", "aria-modal": "true", "aria-label": "Connexion à LNP" }); document.body.appendChild(gate); }
    gate.textContent = "";
    var card = h("div", { "class": "card" }, [h("div", { "class": "logo" }, ["LNP ", h("span", { text: "Ventes" })])]);
    var note = msg ? h("div", { "class": msg.ok ? "ok" : "err", text: msg.text }) : null;
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
        if (r.error) return showGate("signin", { text: /invalid/i.test(r.error.message) ? "E-mail ou mot de passe incorrect." : authFr(r.error.message) });
        enter();
      });
      card.appendChild(form);
      card.appendChild(h("p", { style: "font-size:13px", text: "Mot de passe oublié ? Demandez un lien de réinitialisation à un administrateur (Accès de l’équipe)." }));
      setTimeout(function () { em.focus(); }, 0);
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
    document.documentElement.classList.remove("skl-locked");
    settle(ctx);
    account();
  }

  // ---------------- screens each person may open (Settings › Access) ----------------
  var AREAS = [
    { key: "os", name: "Operating System", home: "cockpit", groups: [["Operating System", [["cockpit", "Cockpit"], ["build", "Build"], ["execute", "Execute"], ["decisions", "Decisions"], ["review", "Weekly Review"]]]] },
    { key: "ss", name: "Ventes", home: "salescockpit", groups: [["Sales System", [["salescockpit", "Cockpit commercial"], ["salesday", "Ma journée"], ["crm", "CRM"]], "Ventes"]] },
    { key: "ks", name: "Knowledge System", home: "bibliotheque", groups: [["Knowledge System", [["bibliotheque", "Library"]]], ["Mechanisms", [["mechanisms", "Mechanism map"], ["mechprecall", "Pre-call"], ["mechsales", "Sales"], ["mechos", "Operating System"]]], ["LNP Map", [["cartomap", "Journey"], ["cartoevents", "Events"], ["cartoworks", "Build order"], ["cartosim", "Simulator"], ["cartomodel", "Model"]]]] },
    { key: "as", name: "Agent System", home: "agentsoverview", groups: [["Pilot", [["agentsoverview", "Overview"], ["agentsdecisions", "Decisions"], ["agentsregistry", "Agents"], ["agentstriggers", "Triggers"], ["agentslog", "Log"]]]] },
    { key: "settings", name: "Paramètres", home: "settings", groups: [["Settings", [["settings", "Alertes"], ["registers", "Registres"]], "Paramètres"]] },
    // not a screen: the LNP connector in Claude (docs/crm/17-claude-connector.md); admins only by default
    { key: "claude", name: "Claude", nav: false, groups: [["Claude", [["claude", "Connecteur Claude"]]]] }
  ];
  // g[0] is the group's key (the sidebar's data-navgrp, nav.py), g[2] its French title when it differs.
  // The Access panel lists only what this edition's sidebar shows (LNP: Ventes and Paramètres) and the Claude connector.
  function inNav(id) {
    var keep = window.SKL_EDITION && window.SKL_EDITION.keep;   // the edition's screens (skl-os/build.py), null = every screen
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
    if (ctx.role === "admin") document.documentElement.classList.add("skl-admin");
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
      box.className = "skl-access";
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
        box.appendChild(h("section", { "class": "skl-acct" }, [
          h("div", { style: "flex:1;min-width:240px" }, [h("h2", { text: "Connecté" }),
            h("div", { "class": "who", text: ctx.user.email }),
            h("div", { "class": "q", text: (ROLE_TXT[ctx.role] || ctx.role) + (ctx.role === "viewer" ? " · lecture seule" : "") })]),
          h("button", { type: "button", text: "Se déconnecter", onclick: signOut })]));
        if (ctx.role === "admin") { var t = h("div", { id: "skl-team", role: "region", "aria-label": "Accès de l’équipe" }); box.appendChild(t); team(t); }
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
        h("div", { "class": "q", text: "Qui peut ouvrir LNP, et ce que chacun peut faire. Invitez quelqu’un, puis envoyez-lui son lien. Les écrans que chacun ouvre : l’onglet Accès." })]));
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
      var tbl = h("table", {}, [h("thead", {}, [h("tr", {}, [h("th", { text: "Membre" }), h("th", { text: "Rôle" }), h("th", { text: "" })])])]);
      var tb = h("tbody", {}); tbl.appendChild(tb);
      card.appendChild(tbl);
      tb.appendChild(h("tr", {}, [h("td", { colspan: "3", "class": "q", text: "Chargement…" })]));
      var data;
      try { data = await api("GET"); } catch (e) { tb.textContent = ""; tb.appendChild(h("tr", {}, [h("td", { colspan: "3" }, [h("div", { "class": "err", text: e.message })])])); return; }
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
          if (!window.sklConfirm) { if (rm.dataset.sure !== "1") { rm.dataset.sure = "1"; rm.textContent = "Confirmer le retrait"; return; } return go(); }
          window.sklConfirm({ title: "Retirer cette personne ?", body: m.email + " ne pourra plus se connecter à LNP. Son travail reste dans les données partagées.", ok: "Retirer l’accès", onOk: go });
        });
        var last = m.lastSignIn ? "Dernière connexion le " + new Date(m.lastSignIn).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "Invité · ne s’est pas encore connecté";
        tb.appendChild(h("tr", {}, [
          h("td", {}, [h("div", { text: m.email + (self ? " (vous)" : "") }), h("div", { "class": "s", text: last })]),
          h("td", {}, [sel]),
          h("td", { style: "text-align:right;white-space:nowrap" }, self ? [] : [reset, " ", rm])]));
      });
    }
    draw();
  }

  // ---------------- start ----------------
  function boot() {
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    if (!cfg.url || !cfg.anonKey || !window.supabase) return showGate("config");
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    if (linkError) { history.replaceState(null, "", location.pathname); return showGate("signin", { text: authFr(decodeURIComponent(linkError[1].replace(/\+/g, " "))) }); }
    if (pending) { history.replaceState(null, "", location.pathname); return showGate("setpw"); }
    enter();
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
