/* LNP · le socle commun des écrans (window.LNP).
   Les données du CRM passent par crm/data.js (window.LNP_CRM). Ici : la fenêtre de confirmation de toute suppression,
   et, hors édition web (fichier ouvert seul), les réglages gardés pour la session du navigateur. */
(function () {
  "use strict";
  var data = {}, listeners = [];
  function col(c) { return data[c] || (data[c] = new Map()); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function emit() { listeners.forEach(function (fn) { try { fn(false); } catch (e) { console.error(e); } }); }

  // Une seule fenêtre de confirmation pour toute suppression (écrans, modules, édition web) :
  // lnpConfirm({ title, body, ok: "Supprimer", onOk }). Échap, Annuler ou un clic à côté ne changent rien.
  function confirmBox(o) {
    var prev = document.activeElement, bg = document.createElement("div");
    bg.setAttribute("data-lnp-confirm", "");
    bg.style.cssText = "position:fixed;inset:0;z-index:90;background:rgba(27,27,24,.55);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'IBM Plex Sans',system-ui,sans-serif";
    var box = document.createElement("div");
    box.setAttribute("role", "alertdialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "lnpcfT");
    box.style.cssText = "width:min(460px,100%);background:#fff;border:1px solid #E3DFD5;border-radius:14px;padding:24px;box-shadow:0 18px 50px rgba(27,27,24,.25);display:flex;flex-direction:column;gap:14px;color:#1B1B18";
    box.innerHTML = '<h3 id="lnpcfT" style="margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:22px"></h3><p style="margin:0;font-size:14px;line-height:1.55;color:#5E5B53"></p>' +
      '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:6px"><button type="button" data-no style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;background:#fff;border:1px solid #D8D3C7;color:#1B1B18">Annuler</button>' +
      '<button type="button" data-yes style="font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;background:#B42318;border:1px solid #B42318;color:#fff"></button></div>';
    box.querySelector("h3").textContent = o.title || "Supprimer cet élément ?";
    box.querySelector("p").textContent = o.body || "Cette action est définitive.";
    // o.html : un corps plus riche, construit par l'appelant à partir de valeurs échappées
    if (o.html) { var hb = document.createElement("div"); hb.style.cssText = "display:flex;flex-direction:column;gap:10px"; hb.innerHTML = o.html; box.querySelector("p").replaceWith(hb); }
    if (o.width) box.style.width = "min(" + Number(o.width) + "px,100%)";
    box.querySelector("[data-yes]").textContent = o.ok || "Supprimer";
    // o.primary : une action qui ne détruit rien (Renommer), bouton foncé ; o.focus : le champ à remplir, Entrée confirme
    if (o.primary) box.querySelector("[data-yes]").style.cssText += ";background:#1B1B18;border-color:#1B1B18;color:#D9B46A";
    bg.appendChild(box);
    function close() { bg.remove(); document.removeEventListener("keydown", key, true); try { if (prev && prev.focus && prev.isConnected) prev.focus(); } catch (e) {} }
    function key(e) { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); close(); if (o.onCancel) o.onCancel(); } }
    bg.addEventListener("mousedown", function (e) { if (e.target === bg) { close(); if (o.onCancel) o.onCancel(); } });
    box.querySelector("[data-no]").onclick = function () { close(); if (o.onCancel) o.onCancel(); };
    box.querySelector("[data-yes]").onclick = function () { var f = o.focus ? box.querySelector(o.focus) : null, v = f ? f.value : undefined; close(); if (o.onOk) o.onOk(v); };
    document.addEventListener("keydown", key, true);
    document.body.appendChild(bg);
    var fld = o.focus ? box.querySelector(o.focus) : null;
    if (fld) { fld.focus(); try { fld.select(); } catch (e) {} fld.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); box.querySelector("[data-yes]").click(); } }); }
    else box.querySelector(o.quick ? "[data-yes]" : "[data-no]").focus();
  }
  window.lnpConfirm = confirmBox;

  window.LNP = {
    mode: "local", readOnly: false,
    list: function (c) { return Array.from(col(c).values()).map(clone); },
    get: function (c, id) { return clone(col(c).get(id)); },
    save: function (c, doc) { col(c).set(doc.id, clone(doc)); emit(); return doc; },
    remove: function (c, id) { col(c).delete(id); emit(); },
    onChange: function (fn) { listeners.push(fn); },
    confirm: confirmBox
  };
})();
