import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";

const CSS = `
.sy{
 --wine-900:#1B1B18;--wine-800:#54101F;--wine-700:#711327;--wine-600:#8E1730;
 --wine-500:#A81D3A;--wine-300:#CF5E74;
 --bone:#F5F1ED;--bone-2:#FFFFFF;--bone-3:#EBE4DF;
 --line:#E0D6D0;--line-2:#D8D3C7;
 --ink:#1B1B18;--ink-2:#5E5B53;--ink-3:#8E8A80;
 --frame:#9A6410;--matter:#0E6E7A;--machinery:#5B3A9E;--control:#14705A;--epistemic:#A81D3A;
 --stop:#C0392B;--stopbg:#FBEAE7;--wait:#9A6410;--waitbg:#F8F0DE;
 --grad:linear-gradient(135deg,var(--wine-700),var(--wine-500));
 --grad2:linear-gradient(135deg,#F6F4EF,#EFECE4);
 --dark:linear-gradient(135deg,#2E181D,#150A0D);
 --sans:"Space Grotesk",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
 --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
 font-family:var(--sans);color:var(--ink);background:var(--bone);font-size:15px;line-height:1.6;
 display:flex;height:100vh;overflow:hidden;-webkit-font-smoothing:antialiased}
.sy *{box-sizing:border-box}
.sy button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.sy :focus-visible{outline:2px solid var(--wine-500);outline-offset:2px}

.sy-nav{flex:none;width:238px;position:relative;display:flex;flex-direction:column;
 background:linear-gradient(175deg,var(--wine-900) 0%,var(--wine-700) 52%,var(--wine-500) 100%);
 color:#fff;z-index:5}
.sy-nav::after{content:"";position:absolute;inset:0;pointer-events:none;
 background:repeating-linear-gradient(180deg,rgba(255,255,255,.045) 0 1px,transparent 1px 4px);
 mix-blend-mode:overlay}
.sy-brand{padding:22px 20px 18px;border-bottom:1px solid rgba(255,255,255,.14);position:relative;z-index:1}
.sy-mark{width:32px;height:32px;border:1.5px solid rgba(255,255,255,.55);border-radius:9px;
 display:grid;place-items:center;margin-bottom:12px;position:relative}
.sy-mark::before{content:"";width:11px;height:11px;border-radius:50%;border:1.5px solid #fff}
.sy-mark::after{content:"";position:absolute;width:24px;height:1.5px;background:rgba(255,255,255,.55)}
.sy-brand h1{font-size:15.5px;font-weight:600;letter-spacing:-.01em;margin:0;line-height:1.3}
.sy-brand p{margin:4px 0 0;font-family:var(--mono);font-size:10px;letter-spacing:.06em;
 color:rgba(255,255,255,.62)}

.sy-mode{display:flex;gap:3px;margin:14px 12px 4px;padding:3px;border-radius:9px;
 background:rgba(0,0,0,.28);position:relative;z-index:1}
.sy-mode button{flex:1;padding:8px 6px;border-radius:7px;font-size:12.5px;font-weight:500;
 color:rgba(255,255,255,.68);transition:background .16s,color .16s;letter-spacing:-.005em}
.sy-mode button:hover{color:#fff}
.sy-mode button[data-on="1"]{background:rgba(255,255,255,.19);color:#fff;font-weight:600}

.sy-navls{flex:1;overflow-y:auto;padding:14px 12px 20px;position:relative;z-index:1}
.sy-navt{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.16em;
 color:#fff;padding:0 4px 8px;margin:6px 0 10px;
 border-bottom:1px solid rgba(255,255,255,.28);display:flex;align-items:baseline;gap:8px}
.sy-navt span{margin-left:auto;font-weight:400;color:rgba(255,255,255,.55);letter-spacing:.06em}
.sy-tab{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 11px;
 border-radius:9px;color:rgba(255,255,255,.74);font-size:14px;font-weight:500;
 transition:background .16s,color .16s;margin-bottom:3px}
.sy-tab .idx{font-family:var(--mono);font-size:10px;opacity:.6;width:15px;flex:none}
.sy-tab:hover{background:rgba(255,255,255,.09);color:#fff}
.sy-tab[data-on="1"]{background:rgba(255,255,255,.16);color:#fff;font-weight:600}
.sy-tab[data-on="1"] .idx{opacity:1}
.sy-chaps{margin:2px 0 8px 10px;padding-left:10px;border-left:1px solid rgba(255,255,255,.2)}
.sy-chaps button{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;
 padding:6px 9px;border-radius:7px;font-size:12px;color:rgba(255,255,255,.62);
 line-height:1.3;margin-bottom:1px;transition:background .14s,color .14s}
.sy-chaps button:hover{background:rgba(255,255,255,.08);color:#fff}
.sy-chaps button[data-on="1"]{background:rgba(255,255,255,.15);color:#fff;font-weight:600}
.sy-chaps .cn{font-family:var(--mono);font-size:9px;opacity:.6;flex:none}
.sy-manp p{margin:0 0 13px;padding:0 22px;font-size:15px;line-height:1.66;color:var(--ink-2);
 max-width:80ch}
.sy-manp p:first-child{padding-top:18px}
.sy-manp p:last-child{margin-bottom:16px}
.sy-shot{padding:0 22px 20px}
.sy-shot .ui{display:block;width:100%;height:auto;border:1px solid var(--line);
 border-radius:10px;background:var(--bone)}
.ui .uh{font-family:var(--sans);font-size:13px;font-weight:600;fill:#1B1B18}
.ui .uk{font-family:var(--mono);font-size:7.5px;letter-spacing:.09em;fill:#8E8A80}
.ui .un{font-family:var(--mono);font-size:8px;fill:#8E8A80}
.ui .ut{font-family:var(--sans);font-size:10px;fill:#1B1B18}
.ui .us{font-family:var(--mono);font-size:8.5px;fill:#5E5B53}
.ui .ub{font-family:var(--mono);font-size:7px;font-weight:600;fill:#fff;text-anchor:middle}
.ui .ux{font-family:var(--sans);font-size:11px;fill:#D8D3C7}
.sy-arret{margin:0;padding:13px 22px 18px;font-family:var(--mono);font-size:11.5px;
 color:var(--wine-600);line-height:1.5}
.sy-arret::before{content:"";display:inline-block;width:14px;height:1.5px;
 background:var(--wine-500);vertical-align:middle;margin-right:9px}
.sy-casintro{display:flex;align-items:center;gap:11px;padding:13px 22px;
 border-top:1px solid var(--line);background:var(--bone);
 font-size:13.5px;color:var(--ink-2)}
.sy-casintro .cm{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.06em;
 color:#fff;background:#0E6E7A;padding:3px 10px;border-radius:5px;flex:none}
.ph2b{font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:.12em}
.sn2{font-family:var(--mono);font-size:10px;font-weight:600;fill:#fff;text-anchor:middle}
.sy-stepg{cursor:pointer}
.sy-stepg rect:first-child{transition:stroke-width .14s,stroke-opacity .14s}
.sy-stepg:hover rect:first-child{stroke-width:2.4;stroke-opacity:1}
.sy-phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.sy-phl{background:var(--bone-2);padding:16px 18px;border-top:3px solid var(--pc)}
.sy-phl .ph3{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;
 color:var(--pc);margin-bottom:9px}
.sy-phl .ph3 em{display:block;font-style:normal;font-size:8.5px;letter-spacing:.05em;
 color:var(--ink-3);margin-top:4px;font-weight:400}
.sy-phl p{margin:0;font-size:13px;line-height:1.55;color:var(--ink-2)}
.sy-modal.lg{width:min(960px,96vw);max-height:90vh}
.mregtabs{display:flex;gap:4px;padding:11px 20px;border-bottom:1px solid var(--line);
 background:var(--bone);flex-wrap:wrap}
.mregtabs button{display:flex;align-items:center;gap:7px;font-size:12.5px;padding:6px 12px;
 border-radius:7px;border:1px solid var(--line);background:var(--bone-2);color:var(--ink-2)}
.mregtabs button:hover{border-color:var(--line-2)}
.mregtabs button[data-on="1"]{background:var(--grad);border-color:transparent;color:#fff;
 font-weight:600}
.mregtabs button i{font-style:normal;font-family:var(--mono);font-size:9px;
 background:rgba(0,0,0,.07);padding:1px 6px;border-radius:9px}
.mregtabs button[data-on="1"] i{background:rgba(255,255,255,.22)}
.mregq{padding:14px 20px 0;font-size:13.5px;line-height:1.55;color:var(--ink-2)}
.sy-modal .mb.nopad{padding:0 0 6px}
.mf .mfn{flex:1;font-size:11.5px;line-height:1.45;color:var(--ink-3);padding-right:14px}
.sy-vues button .tbn{font-style:normal;font-family:var(--mono);font-size:8.5px;
 margin-left:7px;opacity:.55;letter-spacing:.03em}
.sy-vues button .tbn[data-fait="1"]{opacity:1;color:var(--control);font-weight:600}
.sy-vues button[data-on="1"] .tbn{opacity:.8}
.sy-sys .stp{font-style:normal;font-family:var(--mono);font-size:8.5px;
 background:rgba(255,255,255,.16);color:rgba(255,255,255,.75);
 padding:1px 6px;border-radius:9px;margin-left:auto;flex:none}
.sy-delsys{display:block;width:calc(100% - 28px);margin:12px 14px 16px;padding:8px 10px;
 font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;
 color:var(--ink-3);border:1px solid var(--line);border-radius:7px;background:transparent;
 transition:all .15s}
.sy-delsys:hover{border-color:var(--stop);color:var(--stop);background:rgba(192,57,43,.05)}
.sy-pg{padding:16px 22px 18px;border-top:1px solid var(--line);background:var(--bone-2)}
.pgw{border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--bone-2)}
.pgbar{background:var(--bone);border-bottom:1px solid var(--line);padding:9px 12px 11px}
.pgbt{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--ink-3);
 margin-bottom:7px}
.pgdb{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:4px}
.pgdt{position:relative;padding:6px 8px 7px 9px;border-radius:7px;background:var(--bone-2);
 border:1px solid var(--line);opacity:.45;transition:opacity .2s}
.pgdt::before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:2px;
 border-radius:0 3px 3px 0;background:var(--fc)}
.pgdt[data-neuf="1"]{opacity:1;border-color:var(--wine-300);
 box-shadow:0 0 0 2px rgba(180,35,24,.1)}
.pgdt[data-etat="alerte"][data-neuf="1"] .dv{color:var(--wine-600)}
.pgdt .dl{font-family:var(--mono);font-size:6.5px;letter-spacing:.06em;color:var(--ink-3);
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pgdt .dv{font-family:var(--mono);font-size:13px;font-weight:600;letter-spacing:-.03em;
 margin-top:3px;line-height:1.1}
.pgdt .dv.txt{font-family:var(--sans);font-size:9.5px;line-height:1.2;
 overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.pgdt .ds{font-size:7.5px;color:var(--ink-3);margin-top:3px;line-height:1.25;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgcv{overflow:auto;max-height:340px;background:var(--bone);
 background-image:radial-gradient(circle,#E7DCD7 1px,transparent 1px);background-size:15px 15px}
.pgvide{padding:40px 22px;font-size:13px;line-height:1.6;color:var(--ink-3);max-width:60ch}
.pgsvg{position:relative;transform-origin:0 0;transform:scale(.62)}
.pgcv{contain:paint}
.pgn{position:absolute;border-radius:9px;background:#FFFFFF;border:1.4px solid var(--nc);
 padding:9px 11px;opacity:.4;transition:opacity .2s}
.pgn[data-neuf="1"]{opacity:1;box-shadow:0 2px 9px rgba(27,27,24,.1)}
.pgn::before{content:"";position:absolute;inset:0;border-radius:8px;background:var(--nc);
 opacity:.08}
.pgnl{font-size:12.5px;font-weight:600;line-height:1.25;position:relative;
 overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pgns{font-family:var(--mono);font-size:9px;color:var(--ink-2);margin-top:4px;position:relative;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sy-pg svg{display:block;width:100%;height:auto}
.sy-pg.vide{padding:26px 22px}
.sy-pg.vide p{margin:0;font-size:13.5px;line-height:1.6;color:var(--ink-3);
 border-left:2px solid var(--line-2);padding-left:14px;max-width:72ch}
.pgt{font-family:var(--sans);font-size:11.5px;font-weight:600;fill:#1B1B18}
.pgu{font-family:var(--mono);font-size:8.5px;fill:#5E5B53}
.pgz{font-family:var(--mono);font-size:9px;fill:#0E6E7A;letter-spacing:.04em}
.pgb{font-family:var(--mono);font-size:7px;font-weight:600;fill:#fff;text-anchor:middle}
.pgl{display:flex;gap:16px;flex-wrap:wrap;padding-top:12px;margin-top:10px;
 border-top:1px solid var(--line);font-family:var(--mono);font-size:9px;color:var(--ink-3)}
.pgl span{display:flex;align-items:center;gap:6px}
.pgl i{width:11px;height:8px;border-radius:2px;display:inline-block}
.sy-fixw{flex:1;display:flex;flex-direction:column;min-height:0}
.sy-fixh{flex:none;display:flex;gap:26px;align-items:flex-start;
 padding:22px 26px 16px;background:linear-gradient(135deg,#F6F4EF,#EFECE4);
 border-bottom:1px solid rgba(180,35,24,.16);box-shadow:0 2px 12px rgba(27,27,24,.06);z-index:3}
.sy-fixh .fxl{flex:1;min-width:0}
.sy-fixh .fxr{flex:none;width:clamp(330px,40%,560px)}
.sy-fixh .fxrt{font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:.11em;
 text-transform:uppercase;color:var(--wine-500);margin-bottom:7px;
 display:inline-block;padding-bottom:3px;border-bottom:1.5px solid var(--wine-300)}
@media(max-width:1150px){.sy-fixh{display:block}.sy-fixh .fxr{width:100%;margin-top:16px}}
.sy-pg.cpt{padding:0;border-top:0;background:transparent}
.sy-pg.cpt .pgw{border-color:rgba(180,35,24,.16);background:rgba(255,255,255,.5)}
.sy-pg.cpt .pgcv{background:rgba(255,255,255,.45);background-image:none}
.sy-pg.cpt .pgbar{padding:5px 6px 6px;background:rgba(255,255,255,.55);
 border-bottom-color:rgba(180,35,24,.12)}
.sy-pg.cpt .pgdb{gap:2px}
.sy-pg.cpt .pgdt{min-width:0}
.sy-pg.cpt .pgdt{padding:3px 3px 3px 5px;border-radius:4px}
.sy-pg.cpt .pgdt::before{top:3px;bottom:3px;width:1.5px}
.sy-pg.cpt .pgdt .dl{font-size:5px;letter-spacing:.02em;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sy-pg.cpt .pgdt .dv{font-size:8px;margin-top:1px;line-height:1.1;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.sy-pg.cpt .pgdt .dv.txt{font-size:5.5px;line-height:1.1;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;
 -webkit-line-clamp:none;-webkit-box-orient:horizontal}
.sy-pg.cpt .pgdt .ds{display:none}
.sy-pg.cpt .pgcv{max-height:176px}
.sy-pg.cpt .pgsvg{transform:scale(.42)}
.sy-pg.cpt .pgvide{padding:24px 14px;font-size:11px}
.sy-pg.cpt .pgl{display:none}
.sy-fixh .sy-head{margin-bottom:16px}
.sy-fixh .sy-head h2{margin-bottom:0}
.sy-fixb{flex:1;min-height:0;overflow-y:auto;padding:24px 28px 70px;
 scrollbar-width:thin;scrollbar-color:var(--line-2) transparent}
.sy-fixb::-webkit-scrollbar{width:10px}
.sy-fixb::-webkit-scrollbar-track{background:transparent}
.sy-fixb::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:10px;
 border:3px solid var(--bone)}
.sy-suite{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 18px;
 width:100%;max-width:820px;text-align:left;padding:20px 24px;margin-top:6px;
 border:1px solid var(--line);border-radius:13px;background:var(--bone-2);
 transition:border-color .16s,box-shadow .16s,transform .16s}
.sy-suite:hover{border-color:var(--wine-300);box-shadow:0 5px 18px rgba(27,27,24,.09);
 transform:translateY(-1px)}
.sy-suite .sk{grid-column:1;font-family:var(--mono);font-size:9px;letter-spacing:.11em;
 text-transform:uppercase;color:var(--wine-600);font-weight:600}
.sy-suite .st{grid-column:1;font-size:19px;font-weight:600;letter-spacing:-.02em;
 margin-top:5px;color:var(--ink)}
.sy-suite .ss{grid-column:1;font-size:13.5px;color:var(--ink-3);margin-top:4px;line-height:1.5}
.sy-suite .sa{grid-column:2;grid-row:1 / span 3;font-size:22px;color:var(--wine-500);
 width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
 background:var(--grad2);transition:background .16s,color .16s}
.sy-suite:hover .sa{background:var(--grad);color:#fff}
.sy-fil{max-width:1100px;margin:0}
.sy-fil .fph{border-left:3px solid var(--pc);padding:2px 0 2px 13px;margin-bottom:12px}
.sy-fil .fpn{display:block;font-family:var(--mono);font-size:10px;font-weight:600;
 letter-spacing:.14em;color:var(--pc)}
.sy-fil .fpd{display:block;font-size:12.5px;line-height:1.5;color:var(--ink-3);margin-top:4px;
 max-width:78ch}
.sy-fil .fbx{display:flex;gap:5px;flex-wrap:wrap;align-items:stretch}
.sy-fil .fbx button{display:flex;flex-direction:column;gap:3px;text-align:left;
 padding:7px 10px;border-radius:9px;border:1px solid rgba(180,35,24,.14);background:#FFFFFF;
 min-width:44px;transition:all .15s;position:relative}
.sy-fil .fbx button::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:2.5px;
 border-radius:0 3px 3px 0;background:var(--pc);opacity:.45}
.sy-fil .fbx button:hover{border-color:var(--pc);background:#fff}
.sy-fil .fbx button:hover::before{opacity:1}
.sy-fil .fn{font-family:var(--mono);font-size:9.5px;font-weight:600;color:var(--ink-3);
 padding-left:6px}
.sy-fil .ft{display:none}
.sy-fil .fs{display:none}
.sy-fil .fbx button[data-ok="1"]{background:#fff}
.sy-fil .fbx button[data-ok="1"] .fn::after{content:"✓";margin-left:5px;color:var(--control);
 font-size:8.5px}
.sy-fil .fbx button.fov{border-style:dashed}
.sy-fil .fbx button[data-on="1"]{border-color:transparent;background:var(--pc);
 padding:9px 14px;min-width:0}
.sy-fil .fbx button[data-on="1"]::before{display:none}
.sy-fil .fbx button[data-on="1"] .fn{color:rgba(255,255,255,.7);padding-left:0}
.sy-fil .fbx button[data-on="1"] .ft{display:block;font-size:13.5px;font-weight:600;color:#fff;
 letter-spacing:-.01em;white-space:nowrap}
.sy-fil .fbx button[data-on="1"] .fs{display:block;font-family:var(--mono);font-size:9px;
 color:rgba(255,255,255,.72);white-space:nowrap}
.sy-prog{display:flex;gap:5px;margin:0 0 20px;flex-wrap:wrap}
.sy-prog button{font-family:var(--mono);font-size:10px;font-weight:600;width:34px;height:28px;
 border-radius:7px;border:1px solid var(--line);background:var(--bone-2);color:var(--ink-3);
 transition:all .14s}
.sy-prog button[data-ok="1"]{border-color:var(--control);color:var(--control);
 background:rgba(20,112,90,.07)}
.sy-prog button[data-on="1"]{background:var(--grad);border-color:transparent;color:#fff}
.sy-typech{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);
 border-top:1px solid var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.sy-typech button{background:var(--bone-2);padding:17px 19px;text-align:left;
 transition:background .14s}
.sy-typech button:hover{background:var(--bone)}
.sy-typech button[data-on="1"]{background:var(--grad2)}
.sy-typech b{display:block;font-size:15px;font-weight:600;margin-bottom:6px}
.sy-typech button[data-on="1"] b{color:var(--wine-600)}
.sy-typech span{display:block;font-size:13px;line-height:1.55;color:var(--ink-2)}
.sy-oes{padding:4px 0}
.sy-oe{padding:18px 22px;border-top:1px solid var(--line)}
.sy-oe:first-child{border-top:0}
.sy-oe .oeh{display:flex;gap:11px;align-items:flex-start;margin-bottom:12px}
.sy-oe .on{font-family:var(--mono);font-size:10px;font-weight:600;color:#fff;
 width:26px;height:20px;border-radius:5px;display:grid;place-items:center;flex:none;
 background:var(--grad);margin-top:2px}
.sy-oe .oeh b{display:block;font-size:15px;font-weight:600;letter-spacing:-.01em}
.sy-oe .oeh span{display:block;font-size:12.5px;line-height:1.55;color:var(--ink-3);margin-top:3px;
 max-width:78ch}
.sy-arretbox{display:flex;gap:14px;align-items:flex-start;max-width:820px;margin-bottom:20px;
 padding:15px 18px;border:1px solid var(--line);border-left:3px solid var(--line-2);
 border-radius:11px;background:var(--bone-2)}
.sy-arretbox.ok{border-left-color:var(--control);
 background:linear-gradient(90deg,#F2F7F5,var(--bone-2) 55%)}
.sy-arretbox .ab{flex:none;font-family:var(--mono);font-size:9px;letter-spacing:.07em;
 text-transform:uppercase;color:var(--ink-3);padding:3px 9px;border-radius:5px;
 background:var(--bone-3);margin-top:1px}
.sy-arretbox.ok .ab{background:rgba(20,112,90,.12);color:var(--control)}
.sy-arretbox b{display:block;font-size:14px;font-weight:600;line-height:1.4}
.sy-arretbox>div>span{display:block;font-family:var(--mono);font-size:11.5px;color:var(--ink-2);
 margin-top:5px;line-height:1.5}
.sy-ctx{border-top:1px solid var(--line)}
.ctl{display:flex;gap:18px;padding:14px 22px;border-bottom:1px solid var(--line);
 align-items:flex-start}
.ctl b{flex:none;width:26%;font-size:13.5px;font-weight:600;line-height:1.4;color:var(--wine-600)}
.ctl span{flex:1;min-width:0;font-size:13.5px;line-height:1.62;color:var(--ink-2)}
.sy-ctgoal{padding:17px 22px;background:linear-gradient(90deg,#F2F7F5,transparent 70%);
 border-bottom:1px solid var(--line)}
.sy-ctgoal .cg{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.09em;
 text-transform:uppercase;color:var(--control);font-weight:600;margin-bottom:7px}
.sy-ctgoal b{display:block;font-size:16px;font-weight:600;line-height:1.5;
 letter-spacing:-.01em;max-width:78ch}
.sy-cas{border-top:1px solid var(--line)}
.sy-casl{display:flex;gap:16px;padding:14px 22px;border-bottom:1px solid var(--line);
 align-items:flex-start}
.sy-casl:last-child{border-bottom:0}
.sy-casl .cp{flex:none;width:52px;font-family:var(--mono);font-size:9px;letter-spacing:.07em;
 text-transform:uppercase;color:#fff;background:var(--grad);border-radius:5px;
 padding:3px 0;text-align:center;margin-top:2px}
.sy-casl .cc{flex:1;min-width:0}
.sy-casl .cc b{display:block;font-size:14px;font-weight:600;line-height:1.35;
 color:var(--ink);margin-bottom:4px}
.sy-casl .cc span{display:block;font-size:13.5px;line-height:1.6;color:var(--ink-2)}
.sy-casn{padding:15px 22px;border-top:1px solid var(--line);
 background:linear-gradient(90deg,#F2F7F5,transparent 65%);
 font-size:14px;line-height:1.6;color:var(--ink-2);border-radius:0 0 13px 13px}
.sy-casn::before{content:"result — ";font-family:var(--mono);font-size:9.5px;
 letter-spacing:.08em;text-transform:uppercase;color:var(--control);font-weight:600}
.sy-navchap{display:flex;gap:10px;justify-content:space-between;max-width:820px;margin-top:4px}
.sy-navchap button{max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.sy-sys{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:10px 11px;
 border-radius:9px;color:rgba(255,255,255,.76);margin-bottom:3px;transition:background .16s}
.sy-sys:hover{background:rgba(255,255,255,.09)}
.sy-sys[data-on="1"]{background:rgba(255,255,255,.17);color:#fff}
.sy-sys .sn{font-size:13.5px;font-weight:600;line-height:1.25;flex:1;min-width:0;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sy-sys .cnt{flex:none;font-family:var(--mono);font-size:10px;font-weight:600;
 min-width:20px;text-align:center;padding:2px 6px;border-radius:20px;
 background:rgba(0,0,0,.26);color:rgba(255,255,255,.7)}
.sy-sys .cnt[data-crit="1"]{background:#fff;color:var(--wine-700)}
.sy-navft{flex:none;padding:14px 16px 18px;border-top:1px solid rgba(255,255,255,.14);
 position:relative;z-index:1}
.sy-navft .fi{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;
 color:rgba(255,255,255,.5);line-height:1.9}
.sy-navft .fi b{display:block;color:rgba(255,255,255,.85);font-weight:500}
.sy-neuf{display:flex;flex-direction:column;gap:7px}
.sy-seg{display:flex;gap:3px;padding:3px;border-radius:8px;background:rgba(0,0,0,.28)}
.sy-seg button{flex:1;padding:6px 4px;border-radius:6px;font-size:11.5px;color:rgba(255,255,255,.65)}
.sy-seg button[data-on="1"]{background:rgba(255,255,255,.19);color:#fff;font-weight:600}

.sy-col{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bone)}
.sy-hud{flex:none;display:flex;align-items:center;gap:24px;flex-wrap:wrap;padding:13px 26px;
 border-bottom:1px solid var(--line);background:linear-gradient(90deg,var(--bone-2),var(--bone))}
.sy-rd{font-family:var(--mono);font-size:10.5px;letter-spacing:.05em;color:var(--ink-3)}
.sy-rd b{color:var(--wine-600);font-weight:600}
.sy-live{display:flex;align-items:center;gap:7px;margin-left:auto}
.sy-dot{width:7px;height:7px;border-radius:50%;background:var(--wine-500);
 box-shadow:0 0 0 3px rgba(180,35,24,.16)}
.sy-tabs{display:flex;gap:2px}
.sy-tabs button{font-size:13px;padding:6px 14px;border-radius:7px;color:var(--ink-2);font-weight:500}
.sy-tabs button:hover{background:var(--bone-3)}
.sy-tabs button[data-on="1"]{background:var(--grad2);color:var(--wine-600);font-weight:600}
.sy-sp{flex:1}
.sy-view{flex:1;display:flex;min-height:0}
.sy-scroll{flex:1;overflow-y:auto;padding:26px 28px 70px}
.sy-head{max-width:74ch;margin-bottom:20px}
.sy-head h2{font-size:26px;font-weight:600;letter-spacing:-.02em;margin:0 0 7px}
.sy-head p{margin:0;color:var(--ink-2);font-size:15px}

.sy-panel{background:var(--bone-2);border:1px solid var(--line);border-radius:14px;
 position:relative;margin-bottom:22px}
.sy-panel::before,.sy-panel::after{content:"";position:absolute;width:13px;height:13px;
 border:1.5px solid var(--wine-500);opacity:.5}
.sy-panel::before{top:-1px;left:-1px;border-right:0;border-bottom:0;border-radius:14px 0 0 0}
.sy-panel::after{bottom:-1px;right:-1px;border-left:0;border-top:0;border-radius:0 0 14px 0}
.sy-ph{display:flex;align-items:center;gap:14px;padding:15px 18px 13px;
 border-bottom:1px solid var(--line);font-family:var(--mono);color:var(--ink-3)}
.sy-ph>span:first-child{font-size:13px;font-weight:600;letter-spacing:.07em;
 text-transform:uppercase;color:var(--ink);
 border-bottom:2px solid var(--wine-500);padding-bottom:5px;line-height:1.2}
.sy-ph>span:last-child{font-size:10px;letter-spacing:.05em;color:var(--ink-3);text-align:right}
.sy-ph .bar{flex:1;height:1px;
 background:repeating-linear-gradient(90deg,var(--line) 0 4px,transparent 4px 8px)}
.sy-modal .mk{font-size:10.5px;letter-spacing:.12em}
.sy-modal .mt{font-size:22px}
.mblk .rl{font-size:10px;letter-spacing:.1em;padding-bottom:4px;
 border-bottom:1.5px solid var(--wine-300);display:inline-block;margin-bottom:9px}
.sy-hint{padding:10px 18px;border-top:1px solid var(--line);font-family:var(--mono);
 font-size:10.5px;color:var(--ink-3);letter-spacing:.04em}

.sy-stage{position:relative}
.sy-scroller{overflow-x:auto;padding:10px;border-radius:0 0 13px 13px}
.sy-scroller svg{display:block;width:100%;min-width:1180px;height:auto}
.organ{cursor:pointer}
.organ .base{fill:#FFFFFF;stroke:none;filter:drop-shadow(0 1px 2px rgba(27,27,24,.12))}
.organ .card{fill:var(--c);fill-opacity:.30;stroke:var(--c);stroke-opacity:.45;stroke-width:1.2;
 transition:fill-opacity .15s,stroke-opacity .15s}
.organ .chip{fill:var(--c)}
.organ:hover .card{fill-opacity:.44;stroke-opacity:1}
.organ.on .card{fill-opacity:.5;stroke:#1B1B18;stroke-opacity:1;stroke-width:2.4}
.pv2{font-family:var(--mono);font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:5px;
 white-space:nowrap;letter-spacing:.04em}
.pv-abs{background:var(--bone-3);color:var(--ink-3)}
.pv-open{background:var(--grad2);color:var(--wine-600)}
.sy-fails{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line)}
.sy-fail{background:var(--bone-2);padding:17px 19px;cursor:pointer;transition:background .16s}
.sy-fail:hover{background:var(--bone)}
.sy-fail .fh{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.sy-fail .fn{font-family:var(--mono);font-size:10px;font-weight:600;color:#fff;
 width:23px;height:23px;border-radius:7px;display:grid;place-items:center;flex:none;
 background:var(--grad)}
.sy-fail .ft{font-size:15px;font-weight:600;letter-spacing:-.015em;flex:1;line-height:1.25}
.sy-fail .fq2{width:19px;height:19px;border-radius:50%;border:1px solid var(--line-2);
 display:grid;place-items:center;font-family:var(--mono);font-size:10px;font-weight:600;
 color:var(--ink-3);flex:none;transition:all .16s}
.sy-fail:hover .fq2{background:var(--grad);border-color:transparent;color:#fff}
.sy-fail p{margin:0 0 10px;font-size:13.5px;line-height:1.55;color:var(--ink-2)}
.sy-fail .fo{font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--wine-600)}
.nt{font-family:var(--sans);font-size:14px;font-weight:600;fill:#1B1B18}
.ns{font-family:var(--mono);font-size:10.5px;fill:#5E5B53;fill-opacity:.85}
.numg{font-family:var(--mono);font-size:13px;font-weight:600;text-anchor:middle;fill:#fff;
 letter-spacing:-.02em}
.zone{font-family:var(--mono);font-size:11px;letter-spacing:.05em;fill:#8E8A80}
.edge-l{font-family:var(--mono);font-size:10px;fill:#8E8A80}
.loop-b{font-family:var(--mono);font-size:11px;font-weight:600;text-anchor:middle}
.sy-fiche{position:absolute;top:12px;right:12px;bottom:12px;width:342px;z-index:12;
 background:rgba(253,251,249,.97);backdrop-filter:blur(8px);
 border:1px solid var(--line-2);border-radius:12px;box-shadow:-14px 0 40px rgba(27,27,24,.13);
 display:flex;flex-direction:column;overflow:hidden}
.sy-ft{padding:16px 18px 14px;color:#fff;position:relative}
.sy-ft .fam{font-family:var(--mono);font-size:10px;letter-spacing:.1em;opacity:.78}
.sy-ft h3{margin:6px 0 0;font-size:20px;font-weight:600;letter-spacing:-.015em;line-height:1.2;
 padding-right:34px}
.sy-ft .no{position:absolute;top:14px;right:46px;font-family:var(--mono);font-size:26px;
 font-weight:600;opacity:.32;line-height:1}
.sy-fx{position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:7px;color:#fff;
 display:grid;place-items:center;font-size:17px;line-height:1;opacity:.8}
.sy-fx:hover{background:rgba(255,255,255,.18);opacity:1}
.sy-fb{padding:18px;overflow-y:auto}
.blk{margin-bottom:18px}
.blk:last-child{margin-bottom:0}
.blk .lbl{font-family:var(--mono);font-size:10px;letter-spacing:.09em;color:var(--ink-3);
 display:block;margin-bottom:6px}
.blk p{margin:0;font-size:14.5px;color:var(--ink-2);line-height:1.62}
.blk.q{background:#FBF1F2;border-left:2px solid var(--wine-500);border-radius:0 8px 8px 0;padding:12px 14px}
.blk.q p{color:var(--ink);font-weight:500}
.blk.f .lbl{color:var(--wine-600)}
.sy-legend{display:flex;flex-wrap:wrap;gap:11px 24px;padding:15px 18px;border-top:1px solid var(--line);
 font-family:var(--mono);font-size:11.5px;color:var(--ink-2)}
.sy-legend span{display:flex;align-items:center;gap:9px}
.sw{width:17px;height:17px;border-radius:4px;flex:none}
.sy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.prop{background:var(--bone-2);padding:15px 17px}
.prop b{display:block;font-size:14.5px;font-weight:600;margin-bottom:4px}
.prop p{margin:0 0 8px;font-size:13.5px;color:var(--ink-2);line-height:1.55}
.prop .plug{font-family:var(--mono);font-size:10px;color:var(--wine-600);letter-spacing:.03em}

.flow{display:flex;flex-wrap:wrap;gap:6px;padding:16px 18px}
.flow i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--ink-2);
 background:var(--bone);border:1px solid var(--line);border-radius:999px;padding:5px 12px}
.flow i.k{background:var(--grad);color:#fff;border-color:transparent}
.steps{counter-reset:s}
.step{display:grid;grid-template-columns:52px 1fr;gap:16px;padding:18px;border-bottom:1px solid var(--line)}
.step:last-child{border-bottom:0}
.step::before{counter-increment:s;content:counter(s,decimal-leading-zero);font-family:var(--mono);
 font-size:12px;color:#fff;font-weight:600;width:34px;height:34px;border-radius:9px;
 display:grid;place-items:center;background:var(--grad)}
.step b{display:block;font-size:16.5px;font-weight:600;margin-bottom:5px;letter-spacing:-.01em}
.step p{margin:0;color:var(--ink-2);font-size:14.5px;max-width:74ch}
.step .stop{display:inline-block;margin-top:9px;font-family:var(--mono);font-size:11px;
 color:var(--wine-600);border-left:2px solid var(--wine-300);padding-left:10px;line-height:1.5}
.step .prod{display:block;margin-top:10px;font-family:var(--mono);font-size:11px;
 color:var(--ink-2);background:var(--bone);border:1px solid var(--line);
 border-radius:7px;padding:7px 11px;line-height:1.5}
.step .prod i{font-style:normal;color:var(--wine-600);letter-spacing:.06em;
 font-size:9.5px;margin-right:9px;text-transform:uppercase}
.tw{overflow-x:auto;border-radius:0 0 13px 13px}
.tw table{border-collapse:collapse;width:100%;min-width:820px;font-size:14px}
.tw th,.tw td{text-align:left;padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top}
.tw th{font-family:var(--mono);font-size:10.5px;font-weight:500;letter-spacing:.06em;
 color:var(--ink-3);background:var(--bone);border-bottom:1px solid var(--line-2)}
.tw tbody tr:last-child td{border-bottom:0}
.tw tbody tr:hover{background:#FCF6F6}
.tw td:first-child{font-weight:600;white-space:nowrap}
.tw td.m{font-family:var(--mono);font-size:12px;color:var(--ink-2)}
.fm{font-family:var(--mono);font-size:9.5px;font-weight:600;letter-spacing:.04em;
 padding:3px 8px;border-radius:5px;white-space:nowrap;display:inline-block}
.fm-y{background:var(--grad2);color:var(--wine-600)}
.fm-n{background:var(--bone-3);color:var(--ink-3)}
.rules{margin:0;padding:0;list-style:none}
.rules li{padding:15px 18px 15px 46px;border-bottom:1px solid var(--line);position:relative;
 font-size:15px;max-width:88ch}
.rules li:last-child{border-bottom:0}
.rules li::before{content:"";position:absolute;left:18px;top:23px;width:16px;height:1.5px;
 background:var(--wine-500)}
.sy-terms{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line)}
.sy-trm{background:var(--bone-2);padding:16px 18px}
.sy-trm b{display:block;font-size:14.5px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em;
 color:var(--wine-600)}
.sy-trm p{margin:0 0 10px;font-size:13.5px;color:var(--ink-2);line-height:1.55}
.sy-trm .tc{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);line-height:1.5;
 display:block;border-left:2px solid var(--wine-300);padding-left:9px}
.sy-chaine{padding:12px 16px 6px}
.sy-shape{border-bottom:1px solid var(--line)}
.sy-shape:last-of-type{border-bottom:0}
.sy-shape .shl{padding:14px 18px 0;font-size:14px;color:var(--ink-2);line-height:1.5}
.sy-shape .shl b{font-size:15.5px;color:var(--ink);font-weight:600;letter-spacing:-.01em}
.sy-chaine svg{display:block;width:100%;height:auto}
.sy-pilo{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.sy-plt{background:var(--bone-2);padding:16px 18px}
.sy-plt .pr{font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--wine-600);
 margin-bottom:7px;text-transform:uppercase}
.sy-plt b{display:block;font-size:15px;font-weight:600;margin-bottom:5px;letter-spacing:-.01em}
.sy-plt p{margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.55}
.sy-def{padding:26px 28px;font-size:21px;font-weight:500;line-height:1.5;letter-spacing:-.015em;
 max-width:64ch;color:var(--ink)}
.sy-def em{font-style:normal;color:var(--wine-600)}
.sy-warn2{margin:0;padding:18px 22px;border-top:1px solid var(--line);
 background:linear-gradient(90deg,#F4F1EA 0%,transparent 60%);font-size:14.5px;line-height:1.65;
 color:var(--ink-2);border-radius:0 0 13px 13px}
.sy-warn2 b{color:var(--wine-600)}

.sy-rail{flex:none;width:214px;background:var(--bone-2);border-right:1px solid var(--line);
 overflow-y:auto;padding:14px 0 30px}
.sy-fam{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--ink-3);
 padding:0 16px;margin:16px 0 6px}
.sy-fam:first-child{margin-top:0}
.sy-o{display:flex;align-items:center;gap:9px;width:100%;text-align:left;
 border-left:2px solid transparent;padding:6px 14px;font-size:12.5px;color:var(--ink-2)}
.sy-o:hover{background:var(--bone-3)}
.sy-o[data-on="1"]{background:var(--grad2);border-left-color:var(--wine-500);color:var(--ink);font-weight:600}
.sy-o .n{font-family:var(--mono);font-size:10px;color:var(--ink-3);width:15px;flex:none}
.sy-o .d{width:6px;height:6px;border-radius:50%;flex:none;margin-left:auto}
.sy-orow{display:flex;align-items:stretch}
.sy-orow .sy-o{flex:1}
.sy-o.soc{font-size:13px;font-weight:600;color:var(--ink);padding-top:8px;padding-bottom:8px}
.sy-o.att{padding-left:30px;font-size:11.5px;color:var(--ink-3);position:relative}
.sy-o.att::before{content:"";position:absolute;left:19px;top:0;bottom:0;width:1px;background:var(--line)}
.sy-o.att[data-on="1"]{color:var(--ink)}
.sy-chev{flex:none;width:26px;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);
 border-radius:6px;margin-right:8px}
.sy-chev:hover{background:var(--bone-3);color:var(--ink)}
.sy-chev[data-on="1"]{color:var(--wine-600);font-weight:600}
.sy-railft{margin:18px 14px 0;padding-top:14px;border-top:1px solid var(--line);
 font-size:10.5px;line-height:1.55;color:var(--ink-3)}
.sy-fnb{margin-bottom:14px}
.sy-fnb .fnh{display:flex;align-items:baseline;gap:8px;width:100%;text-align:left;
 padding:7px 11px;border-radius:7px;transition:background .14s}
.sy-fnb .fnh:hover{background:var(--bone-3)}
.sy-fnb[data-ouv="1"] .fnh{border-bottom:1px solid var(--line);border-radius:7px 7px 0 0;
 margin-bottom:4px}
.sy-fnb .fnh em{font-style:normal;font-family:var(--mono);font-size:11px;color:var(--ink-3);
 width:9px;text-align:center;flex:none}
.sy-fnb .fnh b{font-size:12.5px;font-weight:600;color:var(--fc)}
.sy-fnb .fnh span{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;
 text-transform:uppercase;color:var(--ink-3)}
.sy-fnb .fnh i{margin-left:auto;font-style:normal;font-family:var(--mono);font-size:9px;
 color:var(--ink-3)}
.sy-fnb .fnh i[data-ok="1"]{color:var(--fc);font-weight:600}
.sy-o.fnx{display:flex;align-items:center;gap:9px;width:100%;padding:6px 11px;text-align:left;
 border-radius:7px;font-size:12.5px;color:var(--ink-2)}
.sy-o.fnx:hover{background:var(--bone-3)}
.sy-o.fnx[data-on="1"]{background:var(--grad2);color:var(--wine-600);font-weight:600}
.sy-o.fnx .no{font-family:var(--mono);font-size:9px;color:var(--ink-3);flex:none}
.sy-o.fnx .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sy-o.fnx .dot{width:5px;height:5px;border-radius:50%;background:var(--line-2);flex:none}
.sy-o.fnx .dot[data-on="1"]{background:var(--fc)}
.sy-socle{border-left:3px solid var(--fc,var(--wine-500));background:linear-gradient(90deg,#F4F1EA,transparent);
 padding:11px 15px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.55;
 color:var(--ink-2);margin-bottom:16px;max-width:70ch}
.sy-socle b{color:var(--wine-600)}
.sy-att{border-left:3px solid var(--line-2);padding:11px 15px;border-radius:0 8px 8px 0;
 font-size:13px;line-height:1.55;color:var(--ink-3);margin-bottom:16px;max-width:70ch;
 background:var(--bone-2)}
.sy-att b{color:var(--ink-2)}
.sy-main{flex:1;overflow-y:auto;padding:24px 28px 70px}
.sy-h{font-size:21px;font-weight:600;margin:0 0 3px;letter-spacing:-.015em}
.sy-meta{font-family:var(--mono);font-size:10.5px;color:var(--ink-3);margin-bottom:15px;letter-spacing:.03em}
.sy-lbl{font-family:var(--mono);font-size:10px;letter-spacing:.05em;color:var(--ink-3);margin-bottom:5px}
.sy-in{font:inherit;font-family:var(--sans);font-size:13.5px;width:100%;padding:8px 11px;
 border:1px solid var(--line);border-radius:8px;background:var(--bone-2);color:var(--ink)}
.sy-in:focus{outline:2px solid rgba(180,35,24,.16);border-color:var(--wine-500)}
.sy-in[type=number]{font-family:var(--mono);text-align:right}
.sy-f{margin-bottom:14px;max-width:520px}
.sy-tb{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:11px}
.sy-tb th{text-align:left;font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;
 color:var(--ink-3);font-weight:500;padding:0 7px 7px 0;border-bottom:1px solid var(--line-2)}
.sy-tb td{padding:4px 7px 4px 0;border-bottom:1px solid var(--line);vertical-align:middle}
.sy-tb input,.sy-tb select{font:inherit;font-family:var(--sans);font-size:13px;width:100%;
 padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bone-2);color:var(--ink)}
.sy-tb input[type=number]{font-family:var(--mono);text-align:right}
.sy-x{color:var(--ink-3);padding:2px 6px;font-size:15px;line-height:1}
.sy-x:hover{color:var(--stop)}
.sy-b{font-size:12.5px;padding:7px 13px;border-radius:8px;border:1px solid var(--line);
 background:var(--bone-2);color:var(--ink)}
.sy-b:hover{border-color:var(--line-2)}
.sy-b.p{background:var(--dark);border-color:transparent;color:#fff;font-weight:600;
 box-shadow:0 1px 3px rgba(21,10,13,.3)}
.sy-b.p:hover{background:linear-gradient(135deg,#3E2229,#1B1B18)}
.sy-b.w{width:100%;text-align:center}
.sy-b.sm{font-size:11.5px;padding:6px 11px}
.sy-b:disabled{opacity:.42;cursor:not-allowed}
.sy-tg{display:flex;gap:8px;margin:0 0 18px}
.sy-tg button{font-size:12.5px;padding:7px 13px;border-radius:8px;border:1px solid var(--line);
 background:var(--bone-2);color:var(--ink-2);display:flex;align-items:center;gap:7px}
.sy-tg button:hover{border-color:var(--line-2);color:var(--ink)}
.sy-tg button[data-on="1"]{background:var(--grad2);border-color:var(--wine-500);
 color:var(--wine-600);font-weight:600}
.sy-tg .cx{font-family:var(--mono);font-size:11px;opacity:.65}
.sy-pan{background:var(--bone-2);border:1px solid var(--line);border-radius:11px;padding:17px 19px;
 margin-bottom:20px;max-width:70ch}
.sy-pan .pt{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--ink-3);margin-bottom:6px}
.sy-pan p{margin:0 0 14px;font-size:14px;line-height:1.62;color:var(--ink-2)}
.sy-pan p:last-child{margin:0}
.sy-r{display:flex;gap:11px;font-size:14px;line-height:1.6;color:var(--ink-2);margin-bottom:11px}
.sy-r:last-child{margin-bottom:0}
.sy-r .i{font-family:var(--mono);font-size:11px;color:var(--wine-500);flex:none;margin-top:3px;font-weight:600}

.sy-bar{flex:none;background:var(--bone);border-bottom:1px solid var(--line);padding:9px 20px 10px}
.sy-bart{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--ink-3);
 margin-bottom:7px;display:flex;align-items:center;gap:10px}
.sy-bart::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.sy-db{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:5px}
.sy-dbt{position:relative;padding:6px 9px 7px 10px;border-radius:8px;cursor:pointer;
 background:var(--bone-2);border:1px solid var(--line);
 transition:border-color .16s,box-shadow .16s}
.sy-dbt::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:2.5px;
 border-radius:0 3px 3px 0;background:var(--fc,var(--line-2))}
.sy-dbt:hover{border-color:var(--line-2);box-shadow:0 2px 7px rgba(27,27,24,.08)}
.sy-dbt .dl{font-family:var(--mono);font-size:7.5px;color:var(--ink-3);letter-spacing:.07em;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:11px}
.sy-dbt .dv{font-family:var(--mono);font-size:15px;font-weight:600;letter-spacing:-.03em;
 line-height:1.1;margin-top:3px;font-variant-numeric:tabular-nums}
.sy-dbt .dv.txt{font-family:var(--sans);font-size:11px;font-weight:600;line-height:1.2;
 letter-spacing:-.01em;margin-top:4px;
 overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.sy-dbt .ds{font-size:8.5px;color:var(--ink-3);line-height:1.3;margin-top:3px;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sy-dbt .dp{position:absolute;top:7px;right:7px;width:4px;height:4px;border-radius:50%}
.sy-bar[data-plie="1"] .sy-db,.sy-bar[data-plie="1"] .sy-leg{display:none}
.sy-bar[data-plie="1"] .sy-bart{margin-bottom:0}
.sy-plier{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;
 color:var(--wine-600);border:1px solid var(--line);border-radius:5px;padding:2px 8px;
 background:var(--bone-2);margin-left:6px}
.sy-plier:hover{border-color:var(--wine-300);background:var(--grad2)}
.sy-dbt[data-etat="alerte"]{border-color:rgba(180,35,24,.3)}
.sy-dbt[data-etat="alerte"] .dp{background:var(--wine-500);box-shadow:0 0 0 3px rgba(180,35,24,.13)}
.sy-dbt[data-etat="vide"]{background:transparent;border-style:dashed}
.sy-dbt[data-etat="vide"] .dp{background:var(--line-2)}
.sy-leg{display:flex;gap:13px;flex-wrap:wrap;font-family:var(--mono);font-size:8.5px;
 letter-spacing:.03em;color:var(--ink-3);padding:8px 2px 0;margin-top:8px;
 border-top:1px solid var(--line)}
.sy-leg i{display:inline-block;width:12px;height:2px;margin-right:5px;vertical-align:middle}

.sy-schema{position:relative;flex:1;display:flex;flex-direction:column;min-height:0}
.sy-cv{flex:1;overflow:auto;
 background-image:radial-gradient(circle,#DCCFCA 1.2px,transparent 1.2px);background-size:20px 20px}
.sy-canvas{position:relative;margin:18px}
.sy-gn{position:absolute;border:1.3px solid;border-radius:10px;cursor:pointer;overflow:hidden;
 display:flex;align-items:center;gap:10px;padding:0 11px;
 filter:drop-shadow(0 1px 2px rgba(27,27,24,.13));transition:filter .14s,box-shadow .14s}
.sy-gn:hover{filter:drop-shadow(0 3px 7px rgba(27,27,24,.18))}
.sy-gn.act{box-shadow:0 0 0 2.4px #1B1B18}
.sy-gn .gchip{flex:none;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;
 font-family:var(--mono);font-size:12px;font-weight:600;color:#fff;letter-spacing:-.02em}
.sy-gn .gtxt{min-width:0;flex:1}
.sy-gn .gk{font-family:var(--mono);font-size:8.5px;letter-spacing:.07em;line-height:1;opacity:.9}
.sy-gn .gt{font-family:var(--sans);font-size:12.5px;font-weight:600;line-height:1.2;
 color:#1B1B18;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;
 -webkit-box-orient:vertical}
.sy-gn .gs{font-family:var(--mono);font-size:9.5px;color:#5E5B53;opacity:.88;margin-top:3px;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.sy-pop{position:absolute;width:322px;background:var(--bone-2);border:1px solid var(--line-2);
 border-radius:12px;box-shadow:0 10px 34px rgba(27,27,24,.17);z-index:60;overflow:hidden;
 display:flex;flex-direction:column;max-height:min(76vh,560px)}
.sy-pop .ph2{flex:none;padding:12px 14px 11px;background:var(--grad);color:#fff;display:flex;
 align-items:flex-start;gap:8px}
.sy-pop .pn{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;opacity:.72}
.sy-pop .pt2{font-size:14px;font-weight:600;line-height:1.22;margin-top:3px}
.sy-pop .pty{font-family:var(--mono);font-size:9.5px;margin-top:3px;opacity:.8;letter-spacing:.04em}
.sy-pop .pcl{margin-left:auto;color:#fff;font-size:17px;line-height:1;padding:0 3px;opacity:.8}
.sy-pop .pcl:hover{opacity:1}
.sy-pop .pb{padding:13px 14px;flex:1;min-height:0;overflow-y:auto;background:var(--bone-2);
 scrollbar-width:thin;scrollbar-color:var(--line-2) transparent;overscroll-behavior:contain}
.sy-pop .pb::-webkit-scrollbar{width:9px}
.sy-pop .pb::-webkit-scrollbar-track{background:transparent}
.sy-pop .pb::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:9px;
 border:2.5px solid var(--bone-2)}
.sy-pop .pb::-webkit-scrollbar-thumb:hover{background:var(--ink-3)}
.sy-pop[data-defile="1"] .ph2::after{content:"";position:absolute;left:0;right:0;bottom:-1px;
 height:1px;background:rgba(255,255,255,.35)}
.sy-pe{margin-bottom:11px}
.sy-pe:last-child{margin-bottom:0}
.sy-pe .pk{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:var(--ink-3);
 margin-bottom:4px;line-height:1.3}
.sy-pe .sy-in{font-size:12.5px;padding:6px 9px}
.sy-pr{border:1px solid var(--line);border-radius:9px;padding:11px 12px;margin-bottom:9px;position:relative}
.sy-pr .prn{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-bottom:8px;letter-spacing:.05em}
.sy-pr .prx{position:absolute;top:7px;right:8px;color:var(--ink-3);font-size:15px;line-height:1;padding:0 3px}
.sy-pr .prx:hover{color:var(--stop)}
.sy-pvide{font-size:12.5px;color:var(--ink-3);line-height:1.55;margin-bottom:10px}
.sy-rlink{margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}
.sy-rlink .rlh{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
 color:var(--wine-600);font-weight:600;border-bottom:1.5px solid var(--wine-300);
 display:inline-block;padding-bottom:3px;margin-bottom:10px}
.sy-rlink .rle{margin:0;font-size:11.5px;line-height:1.55;color:var(--ink-3)}
.sy-rlink .rli{display:flex;gap:9px;align-items:flex-start;padding:8px 0;
 border-bottom:1px solid var(--line)}
.sy-rlink .rli:last-child{border-bottom:0;padding-bottom:0}
.sy-rlink .rk{flex:none;font-family:var(--mono);font-size:8px;font-weight:600;letter-spacing:.05em;
 color:#fff;padding:2px 6px;border-radius:4px;margin-top:1px;text-transform:uppercase}
.sy-rlink .rlt{min-width:0;flex:1}
.sy-rlink .rlt b{display:block;font-size:12.5px;font-weight:600;line-height:1.3}
.sy-rlink .rlt span{display:block;font-family:var(--mono);font-size:10px;color:var(--ink-2);
 margin-top:3px;line-height:1.4}
.sy-rlink .rlt em{display:block;font-style:normal;font-size:10.5px;color:var(--ink-3);
 margin-top:3px;line-height:1.4}
.sy-pf{flex:none;padding:10px 14px;border-top:1px solid var(--line);display:flex;gap:7px;background:var(--bone-2)}

.sy-pil{flex:1;overflow-y:auto;padding:24px 28px 70px}
.sy-lois{margin-bottom:28px;max-width:780px}
.sy-loit{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--ink-3);
 margin-bottom:11px;display:flex;align-items:center;gap:12px}
.sy-loit::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.sy-loiok{border:1px solid var(--line);border-left:3px solid var(--control);border-radius:11px;
 padding:15px 18px;background:var(--bone-2);font-size:14px;line-height:1.6;color:var(--ink-2)}
.sy-loiok b{color:var(--ink)}
.sy-loiko{border:1px solid rgba(180,35,24,.3);border-left:3px solid var(--wine-500);
 border-radius:11px;padding:15px 18px;margin-bottom:10px;
 background:linear-gradient(90deg,#F4F1EA 0%,var(--bone-2) 52%)}
.sy-loiko .lt{font-size:15px;font-weight:600;margin-bottom:6px}
.sy-loiko p{margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--ink-2)}
.sy-loiko .lc{font-family:var(--mono);font-size:11.5px;color:var(--wine-600);
 background:rgba(180,35,24,.07);padding:6px 11px;border-radius:6px;display:inline-block;margin-bottom:11px}
.sy-ign{max-width:780px;border:1px solid var(--line);border-radius:12px;overflow:hidden;
 background:var(--bone-2)}
.sy-igr{display:flex;align-items:flex-start;gap:14px;padding:12px 16px;cursor:pointer;
 border-bottom:1px solid var(--line);transition:background .14s}
.sy-igr:last-child{border-bottom:0}
.sy-igr:hover{background:var(--bone)}
.sy-igr .ir{flex:none;width:64px;font-family:var(--mono);font-size:9px;letter-spacing:.06em;
 padding:3px 0;text-align:center;border-radius:4px;margin-top:2px;color:#fff}
.sy-igr[data-rang="0"] .ir{background:var(--wine-600)}
.sy-igr[data-rang="1"] .ir{background:var(--machinery)}
.sy-igr[data-rang="2"] .ir{background:var(--frame)}
.sy-igr[data-rang="3"] .ir{background:var(--ink-3)}
.sy-igr .iq{flex:1;min-width:0}
.sy-igr .iq b{display:block;font-size:14px;font-weight:600;line-height:1.3;margin-bottom:3px}
.sy-igr .iq span{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.sy-igr .io{flex:none;font-family:var(--mono);font-size:9.5px;color:var(--ink-3);
 letter-spacing:.03em;margin-top:3px;text-align:right;width:150px}
.sy-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);
 border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:22px;max-width:780px}
.sy-su{background:var(--bone-2);padding:14px 16px;cursor:pointer}
.sy-su:hover{background:var(--bone)}
.sy-su[data-on="0"]{opacity:.4}
.sy-su .sv{font-family:var(--mono);font-size:23px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.sy-su .sl{font-size:11.5px;color:var(--ink-3);margin-top:5px;line-height:1.35}
.sy-nt2{background:var(--bone-2);border:1px solid var(--line);border-radius:11px;padding:15px 18px;
 margin-bottom:10px;max-width:780px;border-left:3px solid var(--line)}
.sy-nt2[data-sev="critique"]{border-left-color:var(--stop);
 background:linear-gradient(90deg,#FDF5F3 0%,var(--bone-2) 46%)}
.sy-nt2[data-sev="attention"]{border-left-color:var(--wait)}
.sy-nt2[data-sev="veille"]{border-left-color:var(--ink-3)}
.sy-nth{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:7px}
.sy-nth .nn2{font-size:14.5px;font-weight:600}
.sy-nth .nb{font-family:var(--mono);font-size:9.5px;font-weight:600;padding:2px 8px;
 border-radius:4px;letter-spacing:.04em}
.sy-nt2 p{margin:0 0 9px;font-size:14px;line-height:1.6;color:var(--ink-2)}
.sy-nt2 .nc{font-family:var(--mono);font-size:11px;color:var(--ink-3);background:var(--bone);
 padding:6px 10px;border-radius:6px;display:inline-block;margin-bottom:10px}
.sy-nt2 .na{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.sy-nt2 .no2{font-family:var(--mono);font-size:10px;color:var(--ink-3);letter-spacing:.04em}
.sy-sec{font-family:var(--mono);font-size:10px;letter-spacing:.07em;color:var(--ink-3);
 margin:28px 0 11px;padding-bottom:8px;border-bottom:1px solid var(--line);max-width:780px}
.sy-sec:first-child{margin-top:0}
.sy-none{font-size:14px;color:var(--ink-3);line-height:1.6;padding:18px 0;max-width:64ch}
.sy-empty{padding:56px 36px;color:var(--ink-3);font-size:14.5px;line-height:1.65;max-width:54ch}
.sy-head.hd{display:flex;align-items:flex-start;gap:18px;max-width:none}
.sy-head.hd>div{flex:1;max-width:74ch}
.sy-qm{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--line-2);
 background:var(--bone-2);color:var(--ink-3);font-size:16px;font-weight:600;line-height:1;
 display:grid;place-items:center;transition:all .16s;margin-top:4px}
.sy-qm:hover{background:var(--grad);border-color:transparent;color:#fff;
 box-shadow:0 3px 10px rgba(27,27,24,.18)}
.sy-back{position:fixed;inset:0;background:rgba(27,27,24,.42);backdrop-filter:blur(3px);
 z-index:60;display:grid;place-items:center;padding:28px}
.sy-modal{width:min(560px,100%);max-height:82vh;display:flex;flex-direction:column;
 background:var(--bone-2);border:1px solid var(--line-2);border-radius:14px;overflow:hidden;
 box-shadow:0 20px 60px rgba(27,27,24,.3)}
.sy-modal .mh{padding:16px 20px 14px;background:var(--grad);color:#fff;display:flex;
 align-items:flex-start;gap:10px}
.sy-modal .mk{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;opacity:.72;
 text-transform:uppercase}
.sy-modal .mt{font-size:20px;font-weight:600;letter-spacing:-.015em;margin-top:4px}
.sy-modal .mb{padding:20px;overflow-y:auto}
.sy-modal .mf{padding:12px 20px;border-top:1px solid var(--line);display:flex;justify-content:flex-end}
.mblk{margin-bottom:18px}
.mblk:last-child{margin-bottom:0}
.mblk .rl{font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--wine-600);
 display:block;margin-bottom:7px;text-transform:uppercase}
.mblk p{margin:0;font-size:14px;color:var(--ink-2);line-height:1.62}
.mblk p.fq{color:var(--ink);font-weight:500;border-left:2px solid var(--wine-300);padding-left:12px}
.sy-regi{display:grid;grid-template-columns:repeat(auto-fit,minmax(258px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line)}
.sy-panel>.sy-regi:last-child{border-radius:0 0 13px 13px;overflow:hidden}
.sy-regb{background:var(--bone-2);padding:17px 19px;min-width:0}
.sy-regb .rl{font-family:var(--mono);font-size:9.5px;letter-spacing:.09em;color:var(--wine-600);
 display:inline-block;margin-bottom:9px;text-transform:uppercase;font-weight:600;
 border-bottom:1.5px solid var(--wine-300);padding-bottom:4px}
.sy-regb p{margin:0;font-size:13.5px;color:var(--ink-2);line-height:1.6;overflow-wrap:break-word}
.sy-regb p.fq{color:var(--ink);font-weight:500;border-left:2px solid var(--wine-300);
 padding-left:12px;font-style:normal}
.sy-fmec{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:13px 18px;
 border-top:1px solid var(--line);background:var(--bone)}
.sy-fmec .fl2{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
 color:var(--ink-3);margin-right:4px}
.sy-fmec button{font-size:12px;padding:5px 11px;border-radius:20px;border:1px solid var(--line);
 background:var(--bone-2);color:var(--ink-2);display:flex;align-items:center;gap:7px;
 transition:all .15s}
.sy-fmec button:hover:not(:disabled){border-color:var(--line-2);color:var(--ink)}
.sy-fmec button[data-on="1"]{background:var(--grad);border-color:transparent;color:#fff;
 font-weight:600}
.sy-fmec button:disabled{opacity:.35;cursor:not-allowed}
.sy-fmec button i{font-style:normal;font-family:var(--mono);font-size:9.5px;
 background:rgba(0,0,0,.06);padding:1px 6px;border-radius:10px}
.sy-fmec button[data-on="1"] i{background:rgba(255,255,255,.22)}
.mecpick{display:flex;flex-direction:column;gap:5px}
.mdd{position:relative}
.mdt{display:flex;align-items:center;gap:6px;width:100%;text-align:left;
 font:inherit;font-family:var(--sans);font-size:12.5px;padding:6px 9px;
 border:1px solid var(--line);border-radius:6px;background:var(--bone-2);color:var(--ink)}
.mdt:hover{border-color:var(--line-2)}
.mdt[data-on="1"]{border-color:var(--wine-500);box-shadow:0 0 0 2px rgba(180,35,24,.13)}
.mdt[data-vide="1"] span{color:var(--ink-3)}
.mdt span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mdt i{font-style:normal;font-size:9px;color:var(--ink-3);flex:none}
.mdt .mdn{font-family:var(--mono);font-size:9px;font-weight:600;background:var(--grad);
 color:#fff;padding:1px 6px;border-radius:10px;flex:none}
.mdbk{position:fixed;inset:0;z-index:40}
.mdp{position:absolute;top:calc(100% + 4px);left:0;min-width:100%;width:max-content;
 max-width:290px;z-index:41;background:var(--bone-2);border:1px solid var(--line-2);
 border-radius:9px;box-shadow:0 8px 26px rgba(27,27,24,.18);padding:5px;
 max-height:240px;overflow-y:auto}
.mdo{display:flex;align-items:center;gap:8px;width:100%;text-align:left;
 font:inherit;font-family:var(--sans);font-size:12.5px;padding:6px 8px;border-radius:6px;
 color:var(--ink-2);white-space:nowrap}
.mdo:hover{background:var(--bone-3)}
.mdo[data-on="1"]{background:var(--grad2);color:var(--wine-600);font-weight:600}
.mdo .ck{flex:none;width:13px;font-family:var(--mono);font-size:11px;color:var(--wine-600)}
.mdo.ext{color:var(--ink-3);font-style:italic}
.mdo.none{color:var(--ink-3)}
.mdo.none[data-on="1"]{background:var(--bone-3);color:var(--ink-2);font-weight:600}
.mdt[data-none="1"] span{color:var(--ink-3);font-style:italic}
.mdsep{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;
 color:var(--ink-3);padding:7px 8px 4px;margin-top:3px;border-top:1px solid var(--line)}
.mdv{font-size:11.5px;color:var(--ink-3);padding:7px 8px}
.mdi{font:inherit;font-family:var(--sans);font-size:12px;width:100%;padding:5px 8px;
 border:1px solid var(--line);border-radius:6px;background:var(--bone);color:var(--ink);
 margin-top:3px}
.sy-modal.sm2{width:min(460px,100%)}
.sy-delrows{border:1px solid var(--line);border-radius:9px;overflow:hidden}
.sy-delrows>div{display:flex;gap:12px;padding:8px 12px;border-bottom:1px solid var(--line);
 font-size:13px;line-height:1.45}
.sy-delrows>div:last-child{border-bottom:0}
.sy-delrows span{flex:none;width:38%;font-family:var(--mono);font-size:9.5px;
 letter-spacing:.04em;color:var(--ink-3);text-transform:uppercase;padding-top:2px}
.sy-delrows b{flex:1;min-width:0;font-weight:600;color:var(--ink);word-break:break-word}
.sy-b.danger{background:var(--stop);border-color:transparent;color:#fff;font-weight:600}
.sy-b.danger:hover{background:#A32E1F}
.sy-regt{padding:16px 18px 18px}
.sy-regv{border:1px dashed var(--line-2);border-radius:10px;padding:22px 24px;margin-bottom:14px;
 font-size:14px;line-height:1.6;color:var(--ink-3);max-width:70ch}
.sy-regv b{color:var(--ink-2)}

/* ---- detailed step cards ---- */
.sy-stp{padding:20px 22px;border-bottom:1px solid var(--line)}
.sy-stp:last-of-type{border-bottom:0}
.sy-stph{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.sy-stph .n{font-family:var(--mono);font-size:11px;color:#fff;font-weight:600;
 width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:none;
 background:var(--grad)}
.sy-stph h3{margin:0;font-size:18px;font-weight:600;letter-spacing:-.015em}
.sy-stph .kd{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;padding:3px 9px;
 border-radius:5px;background:var(--grad2);color:var(--wine-600)}
.sy-stph .kd.ly{background:var(--bone-3);color:var(--ink-3)}
.sy-stph .kd.rg{background:none;color:var(--ink-3);padding:0;font-size:11px;letter-spacing:0;
 font-family:var(--sans)}
.sy-stpg{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);
 border:1px solid var(--line);border-radius:10px;overflow:hidden}
.sy-stpb{background:var(--bone-2);padding:15px 17px}
.sy-stpb .k{font-family:var(--mono);font-size:9px;letter-spacing:.09em;text-transform:uppercase;
 color:var(--wine-600);display:block;margin-bottom:7px}
.sy-stpb p{margin:0;font-size:13.5px;line-height:1.58;color:var(--ink-2)}
.sy-stpb p.fq{color:var(--ink);font-weight:500;border-left:2px solid var(--wine-300);padding-left:11px}
.sy-stpr{margin:0;padding-left:17px;font-size:13px;line-height:1.55;color:var(--ink-2)}
.sy-stpr li{margin-bottom:7px}
.sy-stpr li:last-child{margin-bottom:0}
.sy-stpr li::marker{color:var(--wine-500);font-family:var(--mono);font-size:11px}
.sy-blk{cursor:pointer}
.sy-blk .qm circle{transition:stroke-opacity .15s,fill .15s}
.sy-blk .hl{transition:stroke-width .15s,stroke-opacity .15s}
.sy-blk:hover .hl{stroke-width:2.2;stroke-opacity:.95}
.sy-blk:hover .qm circle{stroke-opacity:1;fill:#EFECE4}
.sy-regcards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1px;
 background:var(--line);border-top:1px solid var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.sy-regc{background:var(--bone-2);padding:18px 20px;cursor:pointer;transition:background .16s}
.sy-regc:hover{background:var(--bone)}
.sy-regc .rn{font-size:16px;font-weight:600;letter-spacing:-.015em;display:flex;
 align-items:center;gap:9px}
.sy-regc .qmk{width:19px;height:19px;border-radius:50%;border:1px solid var(--line-2);
 display:grid;place-items:center;font-family:var(--mono);font-size:10px;font-weight:600;
 color:var(--ink-3);margin-left:auto;transition:all .16s}
.sy-regc:hover .qmk{background:var(--grad);border-color:transparent;color:#fff}
.sy-regc .rs{font-size:13px;color:var(--ink-2);line-height:1.5;margin-top:7px}

/* ---- map of mechanisms ---- */
.sy-mapbtn{display:flex;align-items:center;gap:11px;width:100%;text-align:left;
 padding:12px 13px;border-radius:11px;margin:2px 0 4px;color:#fff;
 background:rgba(0,0,0,.26);border:1px solid rgba(255,255,255,.16);
 transition:background .16s,border-color .16s,transform .12s}
.sy-mapbtn:hover{background:rgba(0,0,0,.34);border-color:rgba(255,255,255,.3)}
.sy-mapbtn[data-on="1"]{background:#FFFFFF;border-color:transparent;color:var(--wine-800);
 box-shadow:0 3px 12px rgba(20,4,10,.3)}
.sy-mapbtn .mi{flex:none;width:26px;height:26px;border-radius:8px;position:relative;
 border:1.5px solid rgba(255,255,255,.55)}
.sy-mapbtn .mi::before{content:"";position:absolute;left:4px;top:4px;width:6px;height:6px;
 border-radius:2px;background:rgba(255,255,255,.9);
 box-shadow:9px 0 0 rgba(255,255,255,.55), 0 9px 0 rgba(255,255,255,.55),
            9px 9px 0 rgba(255,255,255,.9)}
.sy-mapbtn[data-on="1"] .mi{border-color:rgba(113,19,39,.45)}
.sy-mapbtn[data-on="1"] .mi::before{background:var(--wine-600);
 box-shadow:9px 0 0 rgba(180,35,24,.55), 0 9px 0 rgba(180,35,24,.55), 9px 9px 0 var(--wine-600)}
.sy-mapbtn .mtx{display:flex;flex-direction:column;min-width:0}
.sy-mapbtn .mt3{font-size:13.5px;font-weight:600;letter-spacing:-.01em;line-height:1.25}
.sy-mapbtn .ms3{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;
 color:rgba(255,255,255,.6);margin-top:3px}
.sy-mapbtn[data-on="1"] .ms3{color:var(--wine-600)}
.sy-mapstat{display:flex;align-items:flex-start;gap:26px;flex-wrap:wrap}
.ms2{min-width:78px}
.ms2 .v{font-family:var(--mono);font-size:20px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
.ms2[data-on="1"] .v{color:var(--wine-600)}
.ms2 .l{font-size:10.5px;color:var(--ink-3);margin-top:5px;line-height:1.3}
.mleg{display:flex;flex-wrap:wrap;gap:8px 15px;font-family:var(--mono);font-size:9.5px;
 color:var(--ink-3);margin-left:auto;max-width:470px;align-items:center}
.mleg span{display:flex;align-items:center;gap:6px}
.mleg span.sep{color:var(--line-2)}
.mleg i{width:9px;height:9px;border-radius:3px;display:inline-block}
.mleg i.st-unbuilt{border:1px dashed var(--line-2);background:none}
.mleg i.st-building{border:1.5px solid #0E6E7A;background:none}
.mleg i.st-ready{background:#0E6E7A}
.mleg i.st-active{background:var(--wine-500)}
.mleg i.ln-seq{width:16px;height:2px;border-radius:0;background:#8E8A80}
.mleg i.ln-cross{width:16px;height:0;border-radius:0;border-top:2px dashed #9A6410}
.mleg i.ln-loop{width:16px;height:0;border-radius:0;border-top:2px dashed #0E6E7A}
.sy-lane{position:absolute;left:10px;border-radius:12px;
 background:color-mix(in srgb,var(--lc) 4%,transparent);
 border:1px solid color-mix(in srgb,var(--lc) 16%,transparent)}
.sy-lane .ln2{position:absolute;left:14px;top:50%;transform:translateY(-50%);
 font-family:var(--mono);font-size:10px;letter-spacing:.09em;text-transform:uppercase;
 color:var(--lc);opacity:.85;font-weight:600;width:96px;line-height:1.3}
.sy-map{position:relative;margin:20px}
.sy-mn{position:absolute;border-radius:11px;padding:11px 13px;cursor:pointer;
 background:var(--bone-2);border:1.4px solid var(--line);
 display:flex;flex-direction:column;justify-content:center;
 transition:transform .14s,box-shadow .14s,border-color .14s}
.sy-mn:hover{transform:translateY(-2px);box-shadow:0 5px 16px rgba(27,27,24,.13)}
.sy-mn[data-sel="1"]{box-shadow:0 0 0 2.4px var(--wine-500)}
.sy-mn[data-st="unbuilt"]{border-style:dashed;border-color:var(--line-2);background:transparent}
.sy-mn[data-st="unbuilt"] .mt2{color:var(--ink-3);font-weight:500}
.sy-mn[data-st="building"]{border-color:var(--dc);background:var(--bone-2)}
.sy-mn[data-st="ready"]{border-color:var(--dc);background:color-mix(in srgb,var(--dc) 10%,var(--bone-2))}
.sy-mn[data-st="active"]{border-color:var(--wine-500);border-width:2px;
 background:color-mix(in srgb,var(--wine-500) 8%,var(--bone-2))}
.sy-mn .mt2{font-size:13.5px;font-weight:600;line-height:1.25;letter-spacing:-.01em}
.sy-mn .mbar{height:4px;border-radius:2px;background:var(--bone-3);margin-top:9px;overflow:hidden}
.sy-mn .mbar i{display:block;height:4px;border-radius:2px;background:var(--dc)}
.sy-mn[data-st="active"] .mbar i{background:var(--wine-500)}
.sy-mn .mst{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);margin-top:6px;
 letter-spacing:.04em}
.sy-mn[data-st="active"] .mst{color:var(--wine-600);font-weight:600}
.sy-mn.stand{position:static;width:190px;height:auto;text-align:left}
.sy-hors{padding:0 20px 26px}
.sy-hors .hl2{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--ink-3);
 text-transform:uppercase;margin-bottom:11px}
.sy-hors .hlist{display:flex;gap:10px;flex-wrap:wrap}

/* ---- flow layer ---- */
.sy-flux{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:1px;
 background:var(--line);border-radius:0 0 13px 13px;overflow:hidden}
.sy-fx2{background:var(--bone-2);padding:14px 16px 15px}
.sy-fx2[data-alert="1"]{background:linear-gradient(180deg,#F4F1EA,var(--bone-2))}
.sy-fx2 .fv{font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.03em;
 line-height:1.1;font-variant-numeric:tabular-nums}
.sy-fx2[data-alert="1"] .fv{color:var(--wine-600)}
.sy-fx2 .fl{font-size:10.5px;color:var(--ink-3);margin-top:6px;line-height:1.35;
 display:flex;align-items:center;gap:7px}
.sy-fx2 .fl input{width:46px;font:inherit;font-family:var(--mono);font-size:11px;
 padding:2px 5px;border:1px solid var(--line);border-radius:5px;background:var(--bone);
 text-align:right;color:var(--ink)}
.sy-warn3{padding:14px 18px;border-top:1px solid var(--line);font-size:13.5px;line-height:1.6;
 color:var(--ink-2);background:linear-gradient(90deg,#F4F1EA 0%,transparent 62%)}
.sy-warn3 b{color:var(--wine-600)}

/* ---- import from frictions ---- */
.sy-imp{padding:16px 18px 18px}
.sy-implist{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:14px}
.sy-impr{display:flex;align-items:center;gap:11px;padding:9px 14px;font-size:13px;
 border-bottom:1px solid var(--line)}
.sy-impr:last-child{border-bottom:0}
.sy-impr.more{color:var(--ink-3);font-family:var(--mono);font-size:11px}
.ms{font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;color:var(--matter);
 background:rgba(14,110,122,.09);padding:2px 8px;border-radius:5px;flex:none}
.fr{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lw{font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:.06em;color:#fff;
 background:var(--wine-500);padding:2px 7px;border-radius:5px;flex:none}
.og{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);flex:none}

/* ---- decision card ---- */
.sy-dec{background:var(--bone-2);border:1px solid var(--line);border-left:3px solid var(--line-2);
 border-radius:11px;padding:15px 18px;margin-bottom:10px;max-width:860px}
.sy-dec[data-rev="light"]{border-left-color:var(--control)}
.sy-dec[data-rev="full"]{border-left-color:var(--wine-500)}
.sy-dec .dh{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.sy-dec .dsrc{display:flex;align-items:center;gap:9px;flex:1;min-width:0;flex-wrap:wrap}
.sy-dec .dq{font:inherit;font-family:var(--sans);font-size:15.5px;font-weight:600;width:100%;
 border:0;border-bottom:1px solid var(--line);background:none;padding:4px 0 7px;color:var(--ink);
 letter-spacing:-.01em}
.sy-dec .dq:focus{outline:none;border-bottom-color:var(--wine-500)}
.sy-dec .dcalc{font-family:var(--mono);font-size:11px;color:var(--ink-3);background:var(--bone);
 padding:5px 10px;border-radius:6px;display:inline-block;margin-top:9px}
.dopts{margin:12px 0 4px}
.dopt{display:flex;align-items:center;gap:7px;margin-bottom:6px}
.dopt .ol{font-family:var(--mono);font-size:10px;font-weight:600;color:#fff;flex:none;
 width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:var(--ink-3)}
.dopt input{font:inherit;font-family:var(--sans);font-size:12.5px;flex:1;min-width:0;
 padding:5px 9px;border:1px solid var(--line);border-radius:6px;background:var(--bone-2);color:var(--ink)}
.dopt input.oc{flex:none;width:104px;font-family:var(--mono);font-size:11.5px}
.dfoot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:13px;
 padding-top:12px;border-top:1px solid var(--line)}
.dfoot label{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9.5px;
 letter-spacing:.05em;color:var(--ink-3)}
.dfoot input,.dfoot select{font:inherit;font-family:var(--sans);font-size:12px;padding:4px 8px;
 border:1px solid var(--line);border-radius:6px;background:var(--bone-2);color:var(--ink)}
.dfoot input[type=number]{width:62px;font-family:var(--mono);text-align:right}
.ddelta{font-family:var(--mono);font-size:11px;font-weight:600;padding:3px 9px;border-radius:6px;
 background:var(--stopbg);color:var(--stop)}
.ddelta[data-up="1"]{background:rgba(20,112,90,.1);color:var(--control)}
.dcyc{font-family:var(--mono);font-size:10.5px;color:var(--ink-3)}
.dlane{margin-top:11px;font-size:12.5px;line-height:1.55;color:var(--control);
 background:rgba(20,112,90,.07);border-radius:8px;padding:9px 12px}
.dlane.full{color:var(--wine-600);background:rgba(180,35,24,.07)}
`;

/* ================== THE 21 ORGANS ================== */
const T = { c:"choice", f:"fact", k:"construct", a:"annotation" };
const ORGANES = [
{id:"01",nom:"Boundary",ty:T.c,fam:"Frame",zone:"barre",liste:true,
 cols:[{k:"type",l:"Type",t:"sel",o:["start","end"],w:"18%"},
       {k:"nom",l:"Event",t:"txt",w:"82%"}],
 rg:["Draw the boundary around a complete loop, never around a team.",
     "If the slowest stock's turnover exceeds the fastest by more than five times, split into two mechanisms.",
     "A valid boundary is crossed by a finite number of named flows.",
     "Write events, not objects. « The call is booked », not « sales ».",
     "Several starts or several ends are normal. Every end event must map to an output in organ 10."],
 res:l=>{const d=l.filter(x=>x.type==="start").map(x=>x.nom).filter(Boolean);
   const f=l.filter(x=>x.type==="end").map(x=>x.nom).filter(Boolean);
   return (d.length||f.length)?`${d.join(" · ")||"?"} → ${f.join(" · ")||"?"}`:"";}},

{id:"02",nom:"Declared objective",ty:T.c,fam:"Frame",zone:"barre",
 ch:[{k:"metrique",l:"Metric",t:"txt",ph:"Direct closes"},
     {k:"cible",l:"Target value",t:"num"},{k:"unite",l:"Unit",t:"txt",ph:"per week"},
     {k:"plancher",l:"Acceptable minimum",t:"num"},{k:"horizon",l:"Horizon",t:"txt",ph:"one quarter"}],
 rg:["A value, a unit, a horizon. None of the three is optional.",
     "The unit must read directly off organ 10. A target on a middle step means you pilot a proxy.",
     "Set the acceptable minimum at the same time as the target. Without a written floor, any gap becomes negotiable after the fact.",
     "One target per mechanism. Two competing targets mean either two mechanisms or an unmade trade-off."],
 res:m=>m.cible?`${m.metrique||""} ${m.cible} ${m.unite||""}`.trim():""},

{id:"03",nom:"Revealed objective",ty:T.f,fam:"Frame",zone:"barre",
 ch:[{k:"sacrifie",l:"What was dropped first under pressure",t:"txt"},
     {k:"revele",l:"So what it actually optimises",t:"txt"}],
 rg:["Filled by retrospective observation only, never by declaration.",
     "Look at the incentives, not the speeches: what is measured, what is paid, what is publicly celebrated.",
     "One observation per constraint squeeze. Three pressure spikes in six months give three independent readings.",
     "If it matches the declared one, write it anyway. Alignment is information, not its absence."],
 res:m=>m.revele||""},

{id:"04",nom:"Constraints",ty:T.f,fam:"Frame",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Constraint",t:"txt",w:"21%"},
       {k:"nature",l:"Nature",t:"sel",o:["throughput","threshold","depleting stock","stock threshold","presence"],w:"18%"},
       {k:"unite",l:"Unit",t:"txt",w:"11%"},
       {k:"borne",l:"Limit",t:"num",w:"9%"},
       {k:"charge",l:"Load",t:"num",w:"9%"},
       {k:"seuil",l:"Alert threshold",t:"num",w:"18%",
        ph:r=>({"throughput":"degrades from…","threshold":"alert margin",
          "depleting stock":"min runway (periods)","stock threshold":"alert margin",
          "presence":"replacement (days)"})[r.nature]||"pick a nature first"},
       {k:"preuve",l:"Evidence",t:"sel",o:["measured","benchmark","hunch"],w:"14%"}],
 rg:["Pick the nature first: it decides how the next four fields read and which alert applies.",
     "A throughput recharges and degrades gradually. A threshold recharges and blocks flat. A depleting stock never refills. A presence is there or it is not.",
     "Express it in the unit of the flow it limits, not in a management unit. « 60 calls a week », not « 2 full-time equivalents ».",
     "For a depleting stock, the limit is an absolute volume and the load a per-period draw: runway is the ratio of the two.",
     "If a limit lifts through an internal decision, it is not a constraint but a frozen parameter. It belongs to organ 12."],
 res:l=>l.map(c=>{const n=c.nature;
   if(n==="depleting stock"&&+c.charge) return `${c.nom} ${(+c.borne/+c.charge).toFixed(1)} periods`;
   if(n==="presence") return `${c.nom} single point`;
   return `${c.nom} ${c.charge??"?"}/${c.borne??"?"}`;}).join(" · ")},

{id:"05",nom:"Owner",ty:T.k,fam:"Frame",zone:"barre",
 ch:[{k:"nom",l:"Person",t:"txt",ph:"Head of sales"},
     {k:"autorite",l:"May change, without asking anyone",t:"txt"},
     {k:"refus",l:"Can hold a refusal against the founder?",t:"sel",o:["yes","no"]}],
 rg:["One physical person per lever. A role, a function or a team does not satisfy the rule.",
     "Write the authority, not the accountability, always in the same form: « X may change Y without asking anyone. »",
     "A lever with no named owner is not a lever. It drops back into constraints until someone picks it up.",
     "Validate with the refusal test. If the answer is no, the authority is fictional."],
 res:m=>m.nom||""},

{id:"06",nom:"Inputs",ty:T.f,fam:"Matter",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Input",t:"txt",w:"32%"},{k:"volume",l:"Volume",t:"num",w:"14%"},
       {k:"unite",l:"Per",t:"txt",w:"20%"},{k:"varia",l:"Variability",t:"txt",w:"16%"},
       {k:"source",l:"Source",t:"txt",w:"18%"}],
 rg:["Three values per input: volume, variability, source. Volume alone allows no attribution.",
     "If the input comes from another mechanism, write its name. The link becomes an interface to watch.",
     "An input is transformed and comes back out; a resource is consumed without coming out. Resources go to the register.",
     "Every input must be received by a named flow."],
 res:l=>l.map(e=>`${e.volume||"?"} ${e.nom}`).join(" · ")},

{id:"07",nom:"Disturbances",ty:T.f,fam:"Matter",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Source of variation",t:"txt",w:"50%"},
       {k:"gravite",l:"Severity",t:"sel",o:["high","medium","low"],w:"25%"},
       {k:"obs",l:"Observable",t:"sel",o:["yes","no"],w:"25%"}],
 rg:["List the known sources before trying to measure anything. The list alone is usable.",
     "A disturbance that is both severe and observable must become a modelled input.",
     "A recurring, predictable disturbance is not one: it is an unmodelled input. Move it up to organ 06.",
     "Above thirty per cent unexplained variance, stop iterating and fix the model."],
 res:l=>l.map(p=>p.nom).join(" · ")},

{id:"08",nom:"Stocks",ty:T.f,fam:"Matter",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Stock",t:"txt",w:"44%"},{k:"niveau",l:"Level",t:"num",w:"18%"},
       {k:"rotation",l:"Turnover (days)",t:"num",w:"20%"},{k:"unite",l:"Unit",t:"txt",w:"18%"}],
 rg:["Two mandatory values: level and turnover time.",
     "Measure turnover with the freeze test: if you cut all inflow now, how long until it empties?",
     "One stock per kind of content, not per process step. Two steps accumulating the same thing are one stock.",
     "Actively hunt the invisible stocks: queues, pending decisions, unwritten knowledge."],
 res:l=>l.map(s=>`${s.nom} ${s.niveau||"?"} · ${s.rotation||"?"} d`).join(" · ")},

{id:"09",nom:"Flows",ty:T.f,fam:"Matter",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Flow",t:"txt",w:"32%"},{k:"de",l:"From",t:"txt",w:"22%"},
       {k:"vers",l:"To",t:"txt",w:"22%"},{k:"debit",l:"Rate",t:"num",w:"12%"},
       {k:"unite",l:"Per",t:"txt",w:"12%"}],
 rg:["Every flow names its source stock and its destination stock. One of the two may be the outside, never both.",
     "Always express units per unit of time, never as a percentage. A percentage has no time dimension.",
     "Check as you write, not afterwards: inflows minus outflows equals the change in stock.",
     "A flow touching no stock is a step. Rename it or delete it."],
 res:l=>l.map(f=>f.nom).join(" · ")},

{id:"10",nom:"Outputs",ty:T.f,fam:"Matter",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Output",t:"txt",w:"32%"},{k:"valeur",l:"Value",t:"num",w:"14%"},
       {k:"dest",l:"Destination",t:"txt",w:"30%"},
       {k:"induite",l:"Induced",t:"sel",o:["no","yes"],w:"24%"}],
 rg:["Write the outputs before the inputs. Always. Starting with inputs models what is available rather than what matters.",
     "Every unit that enters must show up in an output or in a stock. Do the arithmetic before moving on.",
     "For each output, name its destination. An output with no destination signals a badly drawn boundary.",
     "Find the induced outputs with one question: what does this mechanism impose on whoever comes next?"],
 res:l=>l.map(s=>`${s.nom} ${s.valeur??""}`.trim()).join(" · ")},

{id:"11",nom:"Levers",ty:T.c,fam:"Machinery",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Lever (a setting, not an improvement)",t:"txt",w:"46%"},
       {k:"agit",l:"Acts on which rule",t:"txt",w:"32%"},{k:"acteur",l:"Owner",t:"txt",w:"22%"}],
 rg:["Three cumulative conditions: adjustable now, by a named person, without outside approval.",
     "Write a setting, never an improvement. « Length of the confirmation sequence », not « better confirmation ».",
     "Each lever points at a precise relation in organ 13. A lever with no point of action is a wish.",
     "Cap yourself at five levers. Beyond that you describe the space of possibilities, not of decisions."],
 res:l=>l.map(x=>x.nom).join(" · ")},

{id:"12",nom:"Frozen parameters",ty:T.c,fam:"Machinery",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Parameter",t:"txt",w:"28%"},{k:"raison",l:"Reason for freezing",t:"txt",w:"36%"},
       {k:"degel",l:"Unfreezing condition (observable)",t:"txt",w:"36%"}],
 rg:["Two mandatory fields: reason for freezing, unfreezing condition. Without the second it is a constraint in disguise.",
     "The condition must be observable by an existing sensor. « If it becomes a problem » is not a condition.",
     "Set a review date on every freeze. A freeze with no review date turns into a belief.",
     "Anything that is neither lever nor constraint is a frozen parameter. There is no fourth bucket."],
 res:l=>l.map(x=>x.nom).join(" · ")},

{id:"13",nom:"Transformation rules",ty:T.f,fam:"Machinery",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Relation (write the relation, not the result)",t:"txt",w:"42%"},
       {k:"porte",l:"Governs which flow",t:"txt",w:"22%"},
       {k:"nonlin",l:"Non-linear",t:"sel",o:["no","yes"],w:"16%"},
       {k:"usage",l:"Used to",t:"sel",o:["predict","intervene"],w:"20%"}],
 rg:["Write the relation, never the result. « Close rate drops beyond 48 calls », not « close rate is 24 % ».",
     "Look for at least one non-linearity per mechanism. If you find none, you have not looked at the extremes of the range.",
     "For each relation, note whether it serves to predict or to intervene. Only the latter justifies an iteration.",
     "A rule linking more than three variables is almost always several badly separated rules."],
 res:l=>l.map(x=>x.nom).join(" · ")},

{id:"14",nom:"Delays",ty:T.f,fam:"Machinery",zone:"barre",
 ch:[{k:"processus",l:"Process delay (days)",t:"num"},
     {k:"capteur",l:"Sensor latency (days)",t:"num"}],
 rg:["Add the three terms: process delay, turnover of the stocks crossed, sensor latency. Forgetting the third is the most common mistake.",
     "Measure end to end, from setting the lever to reading the result — not to the real effect, which you cannot see.",
     "Express the delay in the same unit as the cadence, otherwise the comparison that protects from over-steering is impossible.",
     "If several paths exist between action and effect, keep the longest. That one bounds the cadence."],
 res:(m,M)=>{const t=totalDelai(M);return t?`${t} days total`:""}},

{id:"15",nom:"Sensors",ty:T.k,fam:"Control",zone:"schema",liste:true,
 cols:[{k:"nom",l:"Sensor",t:"txt",w:"20%"},{k:"mesure",l:"Measures what",t:"txt",w:"20%"},
       {k:"latence",l:"Latency (d)",t:"num",w:"12%"},
       {k:"bruit",l:"Noise ±",t:"num",w:"11%"},{k:"unite",l:"Noise unit",t:"txt",w:"15%"},
       {k:"saisie",l:"Who enters the data",t:"txt",w:"22%"}],
 rg:["Three mandatory attributes: latency, noise amplitude, incentive created. Two out of three is not enough.",
     "Measure the noise over a period without intervention, otherwise you measure your own corrections.",
     "Name who produces the data. If it is the person being evaluated on it, write that down: the incentive is part of the sensor.",
     "One sensor per measured output. A sensor measuring three things measures none of them properly."],
 res:l=>l.map(c=>`${c.nom} · ±${c.bruit??"?"} · ${c.latence??"?"} d`).join(" · ")},

{id:"16",nom:"Gap",ty:T.k,fam:"Control",zone:"schema",
 ch:[{k:"mesure",l:"Current measurement",t:"num"},{k:"fenetre",l:"Aggregation window (periods)",t:"num"}],
 rg:["Same unit, same window, same scope as the target. All three conditions.",
     "A gap is always written with the sensor noise. « +4, noise ±9 » reads correctly; « +4 » reads false.",
     "One aggregation window per mechanism, fixed in advance. Changing it based on the result is the first step into self-deception.",
     "Write the signed gap, never the absolute value. The direction carries most of the information."],
 res:(m,M)=>{const e=ecart(M);return e===null?"":`${e>0?"+":""}${e} vs target`}},

{id:"17",nom:"Policy",ty:T.k,fam:"Control",zone:"schema",
 ch:[{k:"cadence",l:"Decision cadence (days)",t:"num"},
     {k:"bande",l:"Dead band ±",t:"num"},
     {k:"gain",l:"Levers moved per cycle",t:"num"},
     {k:"inaction",l:"What happens inside the dead band",t:"txt",ph:"Nothing. No lever is touched."}],
 rg:["Cadence greater than or equal to total delay. Non-negotiable: the only rule here that admits no exception.",
     "Dead band strictly greater than sensor noise over the chosen window. Below that, you react to your own noise.",
     "One lever per cycle. Two simultaneous levers make attribution impossible.",
     "Write the inaction explicitly. Otherwise someone will act."],
 res:m=>m.cadence?`every ${m.cadence} d · ±${m.bande??"?"}`:""},

{id:"18",nom:"Loops",ty:T.f,fam:"Control",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Loop (3 to 5 links)",t:"txt",w:"48%"},
       {k:"type",l:"Type",t:"sel",o:["balancing","reinforcing"],w:"26%"},
       {k:"delai",l:"Delay (days)",t:"num",w:"26%"}],
 rg:["Write each loop as a closed cycle of three to five links. Beyond that it is probably wrong or badly cut.",
     "Qualify every loop: balancing or reinforcing. An unqualified loop is drawn, not modelled.",
     "Note each loop's delay. Two loops at different speeds produce a two-stage behaviour nobody understands without this.",
     "Note which one dominates in the current regime, and under what condition dominance flips."],
 res:l=>l.map(b=>`${b.nom} (${b.type||"?"})`).join(" · ")},

{id:"19",nom:"Evidence level",ty:T.a,fam:"Epistemic",zone:"barre",liste:true,
 cols:[{k:"valeur",l:"Value concerned",t:"txt",w:"46%"},
       {k:"niveau",l:"Level",t:"sel",o:["measured","benchmark","hunch"],w:"28%"},
       {k:"date",l:"Date",t:"txt",w:"26%"}],
 rg:["Three levels only. No middle ground — nuance is always used to dodge.",
     "Every value carries its date. A measurement has a shelf life, past which it changes level.",
     "Set the shelf life per type of value, once, before filling anything in.",
     "A value tagged « hunch » that carries a structural conclusion is a friction, not an imprecision."],
 res:l=>{const i=l.filter(x=>x.niveau==="hunch").length;
   return l.length?`${l.length} values · ${i} hunches`:""}},

{id:"20",nom:"Structural assumptions",ty:T.a,fam:"Epistemic",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Falsifiable claim (« X does not depend on Y »)",t:"txt",w:"58%"},
       {k:"test",l:"Test that would break it",t:"txt",w:"42%"}],
 rg:["Write each assumption as a falsifiable claim. One you cannot contradict is not an assumption.",
     "Look in the four usual places: independence, linearity, sequentiality, stationarity.",
     "For each assumption, note the test that would invalidate it. Without it, it stays an assumption forever.",
     "A structural assumption untested after six months becomes a priority iteration, whatever its score."],
 res:l=>l.length?`${l.length} assumptions`:""},

{id:"21",nom:"Excluded scope",ty:T.c,fam:"Epistemic",zone:"barre",liste:true,
 cols:[{k:"nom",l:"Excluded element",t:"txt",w:"30%"},{k:"raison",l:"Reason",t:"txt",w:"30%"},
       {k:"signal",l:"Re-entry signal",t:"txt",w:"40%"}],
 rg:["Every exclusion carries two fields: the reason, and an observable re-entry signal.",
     "The signal must be measurable by a sensor that already exists. One requiring new instrumentation will never fire.",
     "Separate excluded by choice from excluded by ignorance. The second is a debt to settle.",
     "Re-read the excluded scope at every boundary revision. The two organs move together or not at all."],
 res:l=>l.map(x=>x.nom).join(" · ")}
];
const OM = Object.fromEntries(ORGANES.map(o=>[o.id,o]));
const TYCOL = {choice:"var(--wait)",fact:"var(--control)",construct:"var(--machinery)",annotation:"var(--ink-2)"};

/* ============ ORGAN NESTING — which organ details which ============ */
/* ---- the five functions. Every organ serves exactly one, and a mechanism that
   leaves one unserved cannot be steered. ---- */
const FONCTIONS = [
 ["frame","Frame","bound",
  "Cuts what belongs to the mechanism from what does not. Without it no quantity has a frame of reference, and nothing else is definable."],
 ["matter","Matter","carry",
  "What enters, accumulates and leaves. This is where delay lives — a mechanism with nothing accumulating answers instantly and needs no steering."],
 ["machinery","Machinery","transform",
  "The rules that set rates, and the settings you can move. Without it the mechanism has no behaviour to explain and no handle to act on."],
 ["control","Control","regulate",
  "Reading the result, comparing it to the target, and deciding when to act. This is the function a chain lacks, and the only one bound by two physical laws."],
 ["epistemic","Epistemic","know",
  "Which values are measured, borrowed or guessed. Without it the model cannot tell a fact from a hunch, and defends both with the same confidence."]
];
const FN_KEY = Object.fromEntries(FONCTIONS.map(f=>[f[1],f[0]]));
const fonctionRemplie = (cle,M) =>
  ORGANES.some(o=>FN_KEY[o.fam]===cle && estRempli(o,M));
const fonctionsCouvertes = M => FONCTIONS.filter(f=>fonctionRemplie(f[0],M)).length;

const PARENT = {"06":"01","10":"01","18":"01","21":"01","02":"16","03":"16",
 "09":"08","14":"08","07":"15","04":"17","05":"17","11":"17","12":"17","13":"17","20":"19"};
const RATTACH = {
 "06":"boundary condition on the way in","10":"boundary condition on the way out",
 "18":"topological property of the boundary","21":"boundary of assumed ignorance",
 "02":"the target term of the gap","03":"the term actually optimised",
 "09":"the stock's derivative over time","14":"the stock's turnover time",
 "07":"the part of the signal the sensor does not separate",
 "04":"bound on the levers' domain","05":"who is allowed to move them",
 "11":"arguments of the policy","12":"arguments withdrawn from the domain",
 "13":"the function the policy acts on",
 "20":"ignorance about the form rather than the value"
};
const enfants = id => Object.keys(PARENT).filter(k=>PARENT[k]===id);

/* ================== ORGAN EXPLANATIONS ================== */
const EXPL = {
"01":["It decides what you model and what you treat as outside. The most structural choice there is: a badly drawn boundary cuts a loop in half, and you then observe a cause without its feedback.",
"List the events that bring something into the mechanism and those that take it out. There can be several on each side — a lead can leave because it closed or because it died, and those are two distinct ends. Then check that the main loop closes inside."],
"02":["It provides the term of comparison without which no gap exists — and without a gap, nothing in the whole mechanism triggers a decision.",
"A metric, a target value, a unit, a horizon, and a floor. The metric must read directly off the outputs, not off an intermediate step."],
"03":["It names what the mechanism optimises in practice, which is not always what it announces. The distance between the two shows up in no variable: only in behaviour under pressure.",
"Recall the last time pressure rose. Note what was dropped first. That is the real objective function."],
"04":["They bound what is reachable, hence which iterations are worth attempting. But they do not all behave the same way as you approach them, and that behaviour decides how to watch them.",
"Pick the nature first, it changes the meaning of the following fields. A throughput recharges and degrades gradually: the alert is utilisation. A threshold blocks flat without warning: the alert is remaining margin. A depleting stock never refills: the alert is runway, the limit divided by the per-period draw. A presence is indivisible: the alert is replacement time.",
  "The line with organ 12 is the one worth policing. A constraint is imposed on you — the only way past it is to change the world: hire, buy, negotiate. If paying money, hiring someone or making a phone call would lift it, it is not a constraint but a frozen parameter you have stopped seeing as a decision. A real constraint is a wall you plan around; a frozen parameter treated as a wall is a lever you have lost.",
  "And a constraint touched by more than one mechanism leaves the sheet for the resources register. A frozen parameter never does — it is your decision about your mechanism, not a shared object."],
"05":["It names who can move the levers and refuse a passage. Without it, rules become recommendations that get bypassed the moment someone is in a hurry.",
"A physical person, never a role. Write what they may change without asking anyone, then answer the refusal test."],
"06":["They describe what arrives from outside without you steering it. Without them, a variation coming from upstream looks exactly like a drop in internal performance.",
"Three values per input: volume, variability, source. If the input comes from another mechanism, write its name."],
"07":["They capture the share of variation your model does not explain. Their size measures the quality of your model, not the chaos of the world.",
"List the known sources, then note their severity and whether they are observable. One that is both severe and observable should become an input."],
"08":["They are the mechanism's memory and the reason it does not react instantly. The most systematically forgotten organ, and the one whose absence costs the most.",
"Two values: level and turnover. For turnover, ask how long the stock would take to empty if you cut all inflow right now."],
"09":["They give the mechanism its dynamics. Without them you know where it stands, not where it is going — and a swelling stock goes unnoticed until it overflows.",
"Each flow names its origin and destination; one of the two may be the outside. Express in units per unit of time, never as a percentage."],
"10":["They count everything that leaves, including what nobody wanted. Uncounted outputs are exactly the costs the mechanism dumps on its neighbours.",
"The wanted outputs first, with their destination. Then hunt the induced ones by asking what this mechanism imposes on whoever comes next."],
"11":["They make the model actionable rather than descriptive. Without levers you can understand a mechanism perfectly and never be able to move it.",
"Write a setting, never an improvement. Each lever points at a precise rule and carries its owner's name. Five at most."],
"12":["They make explicit what you chose not to touch. Without that, the question reopens at every difficult discussion and the argument has to be rebuilt from scratch.",
"For each one: the reason for the freeze, and the unfreezing condition. The condition must be observable by a sensor that already exists.",
  "This is what separates a frozen parameter from a constraint (organ 04). A constraint is imposed on you and has no condition under which it lifts by itself — sixty sales rep-hours never becomes eighty on its own. A frozen parameter is a decision with an expiry trigger: « slots on a ten-day rolling window, unless median latency exceeds five days ».",
  "Frozen parameters fire no friction. They sit quiet until their condition is met — which is exactly why they are the first place to look once the levers have run out. Each one is a lever you switched off deliberately, and the reason may no longer hold."],
"13":["They link inputs and levers to outputs. This is what makes prediction possible, hence choosing between several iterations before launching them.",
"Write the relation, not the result. Flag the non-linear ones: a model with no threshold never surprises you, it only returns what you put in."],
"14":["They measure the time between an action and its readable effect. This is what sets how fast you are allowed to steer without making the mechanism oscillate.",
"Add the process delay and the sensor latency. That sum bounds the decision cadence, and the second term is the one always forgotten."],
"15":["They produce the picture of reality you decide on. You never decide on reality, always on its measurement — which has its own latency and its own noise.",
"Three mandatory attributes: latency, noise, and who enters the data. Measure the noise over a period without intervention, otherwise you measure your own corrections."],
"16":["It is the only place in the mechanism that triggers a decision. Every other organ describes or transforms; this one fires.",
"Enter the current measurement and the aggregation window. The target comes from organ 02 and the gap computes itself. Always compare it to the sensor noise."],
"17":["It turns a gap into action, with three settings: cadence, dead band, gain. Without it, the intensity of the reaction depends on who is looking that day.",
"Cadence must be greater than or equal to the total delay. The dead band must exceed sensor noise. One lever adjusted per cycle."],
"18":["They describe the paths by which an effect comes back onto its own cause. Without a reinforcing loop nothing grows; without a balancing one everything explodes.",
"Three to five links per loop, its type, and its delay. If no loop closes inside, it is the boundary that is badly drawn."],
"19":["It tags where every value comes from. This is what stops a number being relitigated forever: a value marked « hunch » is discussed once, then becomes an iteration.",
"Three levels only — measured, benchmark, hunch — with the date. A six-month-old measurement is no longer a measurement, it has become a historical benchmark."],
"20":["They record what you assumed about the shape of the relations, not about their values. A value error corrects itself through iteration; a shape error never does.",
"Write each assumption as a falsifiable claim, of the form « X does not depend on Y », with the test that would invalidate it."],
"21":["It separates what was ruled out from what was forgotten. Without it, nobody can tell whether a missing element was examined or never considered.",
"For each exclusion: the reason, and the signal that would force it back in. The signal must be measurable with the sensors you already have."]
};

/* ================== EXAMPLE — SALES MECHANISM ================== */
const DEFAUT = {
 "01":[{type:"start",nom:"The call is booked after the VSL"},
       {type:"end",nom:"The lead is closed"},
       {type:"end",nom:"The lead is marked definitively dead"}],
 "02":{metrique:"Direct closes",cible:12,unite:"per week",plancher:9,horizon:"one quarter"},
 "03":{sacrifie:"",revele:""},
 "04":[{nom:"Sales rep capacity",nature:"throughput",unite:"calls/week",borne:60,charge:58,seuil:48,preuve:"hunch"},
       {nom:"Cash",nature:"depleting stock",unite:"€",borne:120000,charge:38000,seuil:4,preuve:"measured"},
       {nom:"Senior sales rep",nature:"presence",unite:"person",borne:1,charge:1,seuil:90,preuve:"measured"}],
 "05":{nom:"Head of sales",autorite:"Script, qualification grid, confirmation sequence",refus:"yes"},
 "06":[{nom:"Booked calls",volume:90,unite:"per week",varia:"depends on the live creative",source:"VSL mechanism"}],
 "07":[{nom:"Change of ad creative",gravite:"high",obs:"yes"},
       {nom:"Sales rep absence",gravite:"medium",obs:"yes"}],
 "08":[{nom:"Pending appointments",niveau:90,rotation:4,unite:"leads"},
       {nom:"Leads in follow-up",niveau:180,rotation:40,unite:"leads"}],
 "09":[{nom:"Incoming bookings",de:"Booked calls",vers:"Pending appointments",debit:90,unite:"/wk"},
       {nom:"Closed on call",de:"Pending appointments",vers:"Closed",debit:9,unite:"/wk"},
       {nom:"No-show and unconfirmed",de:"Pending appointments",vers:"Never showed",debit:38,unite:"/wk"},
       {nom:"Disqualification",de:"Pending appointments",vers:"Disqualified",debit:15,unite:"/wk"},
       {nom:"Moved to follow-up",de:"Pending appointments",vers:"Leads in follow-up",debit:25,unite:"/wk"},
       {nom:"Deferred closes",de:"Leads in follow-up",vers:"Closed",debit:5,unite:"/wk"},
       {nom:"Lead mortality",de:"Leads in follow-up",vers:"Marked dead",debit:20,unite:"/wk"}],
 "10":[{nom:"Closed",valeur:14,dest:"Onboarding",induite:"no"},
       {nom:"Never showed",valeur:42,dest:"Outside",induite:"no"},
       {nom:"Disqualified",valeur:17,dest:"Outside",induite:"no"},
       {nom:"No offer made",valeur:4,dest:"Outside",induite:"no"},
       {nom:"Marked dead",valeur:23,dest:"Outside",induite:"no"},
       {nom:"Onboarding load",valeur:14,dest:"Delivery mechanism",induite:"yes"}],
 "11":[{nom:"Length of the confirmation sequence",agit:"Show rate depends on the confirmation sequence",acteur:"Head of sales"},
       {nom:"Calls per sales rep per week",agit:"Close rate drops beyond 48 calls/week/sales rep",acteur:"Head of sales"}],
 "12":[{nom:"Price",raison:"Consistency with positioning",degel:"If deferred closes exceed direct closes for two quarters"}],
 "13":[{nom:"Close rate drops beyond 48 calls/week/sales rep",porte:"Closed on call",nonlin:"yes",usage:"intervene"},
       {nom:"Show rate depends on the confirmation sequence",porte:"No-show and unconfirmed",nonlin:"no",usage:"intervene"}],
 "14":{processus:4,capteur:3},
 "15":[{nom:"CRM",mesure:"Closed",latence:3,bruit:9,unite:"show pts",saisie:"The sales rep themselves"}],
 "16":{mesure:8,fenetre:1},
 "17":{cadence:1,bande:3,gain:1,inaction:""},
 "18":[{nom:"Sales rep saturation",type:"balancing",delai:7},
       {nom:"Close ↑ → acceptable CAC ↑ → ad budget ↑ → volume ↑",type:"reinforcing",delai:60}],
 "19":[{valeur:"Show rate",niveau:"measured",date:"12 weeks"},
       {valeur:"48-call threshold",niveau:"hunch",date:"—"}],
 "20":[{nom:"The steps are independent of one another",test:"Correlate qualification and close rate per sales rep"}],
 "21":[{nom:"VSL and acquisition",raison:"Different owner, different clock",
        signal:"If show variance explained by creative exceeds that of internal levers"}]
};

/* ================== EXAMPLE — PRE-CALL MECHANISM ================== */
const PREAPPEL = {
 "01":[{type:"start",nom:"The lead books a slot in the calendar"},
       {type:"end",nom:"The lead shows up to the call"},
       {type:"end",nom:"The lead is lost without ever showing"}],
 "02":{metrique:"Show rate",cible:75,unite:"% of booked appointments",plancher:65,horizon:"60 days"},
 "03":{sacrifie:"When booking volume drops, qualification friction at booking is loosened before the reminders are touched",
       revele:"Maximise appointments booked, not leads actually present"},
 "04":[{nom:"Calendar slots open",nature:"throughput",unite:"slots/week",borne:100,charge:90,seuil:80,preuve:"measured"},
       {nom:"Setting time for personal videos",nature:"throughput",unite:"min/week",borne:300,charge:255,seuil:240,preuve:"measured"},
       {nom:"Carrier SMS sending quota",nature:"threshold",unite:"messages/day",borne:500,charge:320,seuil:100,preuve:"measured"},
       {nom:"Prepaid SMS credit",nature:"depleting stock",unite:"€",borne:900,charge:260,seuil:3,preuve:"measured"},
       {nom:"Verified sending number",nature:"presence",unite:"number",borne:1,charge:1,seuil:21,preuve:"measured"}],
 "05":{nom:"Pre-call lead",
       autorite:"The reminder sequence, the message content, the maximum booking window, the confirmation script",
       refus:"yes"},
 "06":[{nom:"Appointments booked",volume:90,unite:"per week",
        varia:"±22 depending on the live creative · 88 % valid numbers",source:"VSL & booking mechanism"}],
 "07":[{nom:"Public holidays and school breaks",gravite:"high",obs:"yes"},
       {nom:"Upstream creative change: lead intent shifts while nothing moves here",gravite:"high",obs:"yes"},
       {nom:"Time zone mis-detected at booking",gravite:"medium",obs:"yes"},
       {nom:"Variable carrier spam filtering",gravite:"medium",obs:"no"},
       {nom:"Major news event capturing attention",gravite:"low",obs:"no"}],
 "08":[{nom:"Unconfirmed leads",niveau:11,rotation:2,unite:"leads"},
       {nom:"Pending appointments",niveau:52,rotation:4,unite:"appointments"},
       {nom:"Rescheduled appointments",niveau:14,rotation:9,unite:"appointments"}],
 "09":[{nom:"Confirmation request",de:"Appointments booked",vers:"Unconfirmed leads",debit:90,unite:"/wk"},
       {nom:"Active confirmation",de:"Unconfirmed leads",vers:"Pending appointments",debit:76,unite:"/wk"},
       {nom:"Drop-off before confirming",de:"Unconfirmed leads",vers:"Cancelled before confirming",debit:14,unite:"/wk"},
       {nom:"Shows up to the call",de:"Pending appointments",vers:"Showed up",debit:61,unite:"/wk"},
       {nom:"Plain no-show",de:"Pending appointments",vers:"No-show not recovered",debit:12,unite:"/wk"},
       {nom:"Reschedule request",de:"Pending appointments",vers:"Rescheduled appointments",debit:10,unite:"/wk"},
       {nom:"Return after reschedule",de:"Rescheduled appointments",vers:"Pending appointments",debit:7,unite:"/wk"},
       {nom:"Lost while rescheduled",de:"Rescheduled appointments",vers:"Lost after rescheduling",debit:3,unite:"/wk"}],
 "10":[{nom:"Showed up",valeur:61,dest:"Sales mechanism",induite:"no"},
       {nom:"Cancelled before confirming",valeur:14,dest:"Outside",induite:"no"},
       {nom:"No-show not recovered",valeur:12,dest:"Outside",induite:"no"},
       {nom:"Lost after rescheduling",valeur:3,dest:"Outside",induite:"no"},
       {nom:"Manual follow-up workload",valeur:255,dest:"Setting team",induite:"yes"},
       {nom:"Leads irritated by over-contact",valeur:4,dest:"Brand reputation",induite:"yes"}],
 "11":[{nom:"Maximum delay between booking and slot",
        agit:"Show rate loses about 4 points per extra day of latency, with a sharp drop beyond 5 days",
        acteur:"Pre-call lead"},
       {nom:"Number and channel of reminders in the window",
        agit:"Beyond 5 messages, unsubscribes and spam reports cancel the gain",
        acteur:"Pre-call lead"},
       {nom:"Requiring an active confirmation from the lead",
        agit:"An explicit active confirmation adds 10 to 15 points, plateauing after two prompts",
        acteur:"Pre-call lead"},
       {nom:"Personal video message from the sales rep",
        agit:"A personal video message adds 6 to 9 points, no effect beyond 48 h from the slot",
        acteur:"Pre-call lead"},
       {nom:"One-click rescheduling offered",
        agit:"Actively offering a reschedule recovers about 70 % of declared cancellations",
        acteur:"Pre-call lead"}],
 "12":[{nom:"No deposit at booking",raison:"Protect booked appointment volume",
        degel:"If show rate stays below 60 % for 6 consecutive weeks"},
       {nom:"Slots open on a 10-day rolling window",raison:"Consistency with downstream sales rep load",
        degel:"If median latency exceeds 5 days"},
       {nom:"A single SMS sending number",raison:"Cost and verification lead time",
        degel:"If deliverability drops below 92 %"},
       {nom:"No human confirmation call",raison:"Setting time cost",
        degel:"If setting time freed exceeds 60 min per week"}],
 "13":[{nom:"Show rate loses about 4 points per extra day of latency, with a sharp drop beyond 5 days",
        porte:"Shows up to the call",nonlin:"yes",usage:"intervene"},
       {nom:"An explicit active confirmation adds 10 to 15 points, plateauing after two prompts",
        porte:"Active confirmation",nonlin:"yes",usage:"intervene"},
       {nom:"SMS converts 3 to 4 times better than email on reminders under 24 h",
        porte:"Shows up to the call",nonlin:"no",usage:"intervene"},
       {nom:"A personal video message adds 6 to 9 points, no effect beyond 48 h from the slot",
        porte:"Shows up to the call",nonlin:"yes",usage:"intervene"},
       {nom:"Beyond 5 messages, unsubscribes and spam reports cancel the gain",
        porte:"Shows up to the call",nonlin:"yes",usage:"intervene"},
       {nom:"Actively offering a reschedule recovers about 70 % of declared cancellations",
        porte:"Reschedule request",nonlin:"no",usage:"intervene"}],
 "14":{processus:4,capteur:2},
 "15":[{nom:"Calendar and CRM",mesure:"Showed up",latence:2,bruit:5,unite:"weekly show pts",
        saisie:"Automatic at booking, attendance confirmed by the sales rep"},
       {nom:"SMS platform",mesure:"Unconfirmed leads",latence:0,bruit:3,unite:"reply pts",
        saisie:"Automatic, no human entry"}],
 "16":{mesure:68,fenetre:3},
 "17":{cadence:7,bande:6,gain:1,
       inaction:"Nothing. No lever is touched while the gap stays inside the band."},
 "18":[{nom:"Reschedule → queue → new slot → show",type:"balancing",delai:9},
       {nom:"Show ↑ → slots taken ↑ → booking latency ↑ → show ↓",type:"balancing",delai:14},
       {nom:"Show ↑ → revenue per lead ↑ → ad budget ↑ → bookings ↑",type:"reinforcing",delai:45}],
 "19":[{valeur:"Weekly show rate",niveau:"measured",date:"12 weeks"},
       {valeur:"Median latency of 4 days",niveau:"measured",date:"12 weeks"},
       {valeur:"SMS beats email under 24 h",niveau:"benchmark",date:"industry"},
       {valeur:"Personal video worth 6 to 9 points",niveau:"benchmark",date:"industry, unverified here"},
       {valeur:"Sharp drop beyond 5 days of latency",niveau:"hunch",date:"—"},
       {valeur:"70 % recovery through rescheduling",niveau:"hunch",date:"—"}],
 "20":[{nom:"Show rate does not depend on the time slot chosen",
        test:"Cross show rate with appointment hour over 12 weeks"},
       {nom:"Reminder effects add up rather than substitute for one another",
        test:"Factorial design: SMS × video × active confirmation"},
       {nom:"Latency acts the same way whatever the traffic source",
        test:"Segment the latency-show curve by ad creative"},
       {nom:"A rescheduled lead behaves like a fresh one",
        test:"Compare show rate of rescheduled leads against first appointments"}],
 "21":[{nom:"The VSL and upstream intent quality",raison:"Different owner, different clock",
        signal:"If show variance explained by creative exceeds that of internal levers"},
       {nom:"The sales call itself",raison:"Separate downstream mechanism",
        signal:"If close rate falls while show rate rises"},
       {nom:"A deposit at booking",raison:"Handled as a frozen parameter",
        signal:"If show rate stays below 60 % for six consecutive weeks"}]
};

/* ================== COMPUTATIONS ================== */
const rotMax = M => { const s=lst(M,"08"); const r=s.map(x=>+x.rotation||0).filter(Boolean);
  return r.length?Math.max(...r):0; };
const rotMin = M => { const s=lst(M,"08"); const r=s.map(x=>+x.rotation||0).filter(Boolean);
  return r.length?Math.min(...r):0; };
const totalDelai = M => (+(obj(M,"14").processus)||0)+(+(obj(M,"14").capteur)||0);
const ecart = M => { const c=+(obj(M,"02").cible), m=+(obj(M,"16").mesure);
  return (isNaN(c)||isNaN(m))?null:+(m-c).toFixed(1); };
const bruitMax = M => { const c=lst(M,"15"); const b=c.map(x=>+x.bruit||0);
  return b.length?Math.max(...b):0; };

/* ================== FRICTION RULES ================== */
const REGLES = [
 {id:"conserv",nom:"Conservation broken",cases:"06 · 08 · 10",nd:["10","08"],
  f:M=>{const e=lst(M,"06").reduce((a,b)=>a+(+b.volume||0),0);
    const s=lst(M,"10").filter(x=>x.induite!=="yes").reduce((a,b)=>a+(+b.valeur||0),0);
    if(!e||!s)return null;
    const base=Math.abs(e-100)<1?100:e; const d=base-s;
    return Math.abs(d)>0.5?{c:`in ${base} · out ${s} · missing ${d}`,
      t:`${Math.abs(d)} units ${d>0?"vanish with no destination":"appear with no origin"}. A stock or an output is missing from the model. Go back to the boundary before hunting in the stocks.`}:null;}},

 {id:"surpilot",nom:"Cadence law broken",cases:"14 · 17",nd:["17"],loi:1,
  f:M=>{const d=totalDelai(M), c=+(obj(M,"17").cadence);
    if(!d||!c)return null;
    return c<d?{c:`cadence ${c} d < total delay ${d} d`,
      t:`You correct every ${c} day${c>1?"s":""} a mechanism that takes ${d} days to answer. Every correction leaves before the previous one has produced its effect: oscillation is guaranteed.`}:null;}},

 {id:"bandemorte",nom:"Dead band law broken",cases:"15 · 17",nd:["17","15"],loi:1,
  f:M=>{const br=bruitMax(M), bm=+obj(M,"17").bande;
    if(!br||!bm) return null;
    return bm<=br?{c:`dead band ±${bm} ≤ sensor noise ±${br}`,
      t:`Your decision rule fires on gaps smaller than the noise of your own measurement. You are reacting to your instrument, not to your mechanism. The dead band must exceed the noise — that is an inequality, not a comfort setting.`}:null;}},

 {id:"aveugle",nom:"Blind gap",cases:"15 · 16",nd:["16","15"],
  f:M=>{const b=bruitMax(M), fen=+(obj(M,"16").fenetre)||1, e=ecart(M);
    if(!b||e===null)return null;
    const seuil=b/Math.sqrt(fen);
    return Math.abs(e)<seuil?{c:`|gap| ${Math.abs(e)} < residual noise ${seuil.toFixed(1)} over ${fen} period${fen>1?"s":""}`,
      t:`The observed gap is smaller than the sensor noise. It means nothing. Widen the aggregation window or reduce the noise before interpreting anything.`}:null;}},

 {id:"horloge",nom:"Clock mismatch",cases:"01 · 08",nd:["08"],
  f:M=>{const mx=rotMax(M),mn=rotMin(M); if(!mx||!mn)return null;
    const k=mx/mn;
    return k>5?{c:`turnover ${mx} d / ${mn} d = factor ${k.toFixed(1)} (limit 5)`,
      t:`The fast stock sees the slow one as a constant, the slow one sees the fast one as noise. A single cadence over-steers one and under-reacts to the other. Split into two mechanisms.`}:null;}},

 {id:"satur",nom:"Throughput saturated",cases:"04",nd:["13"],
  f:M=>{const l=lst(M,"04").filter(c=>(c.nature||"throughput")==="throughput"&&+c.borne&&+c.charge)
      .map(c=>{const u=+c.charge/+c.borne, lim=+c.seuil?+c.seuil/+c.borne:0.8;
        return u>lim?{...c,u}:null;}).filter(Boolean);
    if(!l.length) return null; const c=l[0];
    return {c:l.map(x=>`${x.nom} ${x.charge}/${x.borne} = ${(x.u*100).toFixed(0)} % · degrades from ${x.seuil||Math.round(x.borne*0.8)}`).join(" · "),
      t:`${c.nom} runs at ${(c.u*100).toFixed(0)} % of its limit, past the point where degradation starts. Waiting time grows non-linearly: any upstream volume gain is absorbed by the queue before it reaches the result.`};}},

 {id:"marge",nom:"Threshold margin spent",cases:"04",nd:[],
  f:M=>{const l=lst(M,"04").filter(c=>["threshold","stock threshold"].includes(c.nature)&&+c.borne&&+c.charge)
      .map(c=>{const m=+c.borne-+c.charge; return m<=(+c.seuil||0)?{...c,m}:null;}).filter(Boolean);
    if(!l.length) return null; const c=l[0];
    return {c:l.map(x=>`${x.nom} · margin ${x.m} ${x.unite||""} ≤ alert ${x.seuil||0}`).join(" · "),
      t:`${c.nom} is a threshold: nothing degrades before the limit, then everything blocks flat. ${c.m} ${c.unite||"units"} of margin remain, and no slowdown zone will warn you.`};}},

 {id:"autonomie",nom:"Runway too short",cases:"04",nd:[],
  f:M=>{const l=lst(M,"04").filter(c=>c.nature==="depleting stock"&&+c.borne&&+c.charge)
      .map(c=>{const a=+c.borne/+c.charge; return a<=(+c.seuil||3)?{...c,a}:null;}).filter(Boolean);
    if(!l.length) return null; const c=l[0];
    return {c:l.map(x=>`${x.nom} · ${x.a.toFixed(1)} periods left ≤ minimum ${x.seuil||3}`).join(" · "),
      t:`${c.nom} does not refill. At the current draw of ${c.charge} ${c.unite||""} per period, ${c.a.toFixed(1)} periods remain. Utilisation means nothing here: what counts is the depletion rate.`};}},

 {id:"presence",nom:"Single point of failure",cases:"04 · 05",nd:[],
  f:M=>{const l=lst(M,"04").filter(c=>c.nature==="presence"&&(!+c.seuil||+c.seuil>30));
    if(!l.length) return null; const c=l[0];
    return {c:l.map(x=>`${x.nom} · replacement ${x.seuil?x.seuil+" days":"not estimated"}`).join(" · "),
      t:`${c.nom} is an indivisible resource: it does not degrade gradually, it disappears at once. ${c.seuil?`Replacing it takes ${c.seuil} days`:"Its replacement time is not estimated"}, and the mechanism must run without it for that long.`};}},

 {id:"nonlin",nom:"No non-linearity",cases:"13",nd:["13"],
  f:M=>{const r=lst(M,"13"); if(!r.length)return null;
    return r.every(x=>x.nonlin!=="yes")?{c:"no relation flagged non-linear",
      t:"A model with no threshold never surprises you: it only returns what you put in. Look at the extremes of the range."}:null;}},

 {id:"preuve",nom:"Structural hunch",cases:"04 · 19",nd:[],
  f:M=>{const c=lst(M,"04").filter(x=>x.preuve==="hunch");
    if(!c.length) return null;
    return {c:`${c.map(x=>x.nom).join(", ")} · evidence level: hunch`,
      t:"A constraint bounds the space of viable iterations. If it rests on an untested hunch, you may be ruling out iterations because of an imaginary limit. Verify before iterating."};}},

 {id:"revele",nom:"Revealed objective unknown",cases:"02 · 03",nd:[],
  f:M=>{const r=obj(M,"03").revele;
    return !r?{c:"organ 03 not filled in",
      t:"Until the sacrifice test is done, you steer towards a target without knowing whether the mechanism pursues another one. This is where the most expensive pathologies live."}:null;}},

 {id:"acteur",nom:"Fictional authority",cases:"05 · 11",nd:["11"],
  f:M=>{const a=obj(M,"05");
    return a.refus==="no"?{c:"the owner cannot hold a refusal",
      t:"Without real authority the levers are not levers and the rules become recommendations. They will be bypassed the moment someone is in a hurry."}:null;}}
];

/* ================== HELPERS ================== */
const estRempli = (o,M) => {
  const v=M[o.id];
  if(o.liste) return Array.isArray(v)&&v.length>0;
  if(!v||Array.isArray(v)) return false;
  return o.ch.some(c=>v[c.k]!==undefined&&v[c.k]!=="");
};
const lst = (M,id) => Array.isArray(M[id])?M[id]:[];
const obj = (M,id) => (M[id]&&!Array.isArray(M[id]))?M[id]:{};
function normModele(m){
  const o={...(m||{})};
  if(o["01"] && !Array.isArray(o["01"])){
    const a=o["01"], r=[];
    if(a.debut) r.push({type:"start",nom:a.debut});
    if(a.fin)   r.push({type:"end",nom:a.fin});
    o["01"]=r;
  }
  ORGANES.forEach(x=>{
    if(x.liste){ if(!Array.isArray(o[x.id])) o[x.id]= o[x.id]?[]:undefined; }
    else if(Array.isArray(o[x.id])) o[x.id]=undefined;
    if(o[x.id]===undefined) delete o[x.id];
  });
  return o;
}
const normSys = l => (Array.isArray(l)?l:[]).map(s=>({...s,modele:normModele(s.modele)}));

/* Stored models predate the English rewrite: the seeded pair is replaced wholesale,
   any mechanism the user created themselves is left untouched. */
const SEED_EN = {
  "s-preappel":{nom:"Pre-call",type:"mechanism",src:()=>PREAPPEL},
  "s-vente":   {nom:"Sales",   type:"mechanism",src:()=>DEFAUT}
};
const ACCENTS = new RegExp(
  "[\u00e0\u00e2\u00e4\u00e7\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u00f6\u00f9\u00fb\u00fc\u0153]","i");
const NOMS_FR = /^(?:pr[e\u00e9]-?appel|vente|ventes)$/i;
const estFR = (modele,nom) =>
  ACCENTS.test(JSON.stringify(modele||{})) || ACCENTS.test(nom||"") || NOMS_FR.test((nom||"").trim());
function migrerFR(l){
  return (Array.isArray(l)?l:[]).map(s=>{
    const seed=SEED_EN[s.id];
    if(!seed) return s;
    if(estFR(s.modele, s.nom))
      return {id:s.id,nom:seed.nom,type:seed.type,modele:normModele(seed.src())};
    return {...s,nom:s.nom||seed.nom,type:s.type||seed.type};
  });
}
const resume = (o,M) => {
  const v = o.liste ? lst(M,o.id) : obj(M,o.id);
  if(o.liste ? !v.length : !Object.keys(v).length) return "";
  try{ return o.res(v,M)||""; }catch(e){ return ""; } };
const calcFrictions = M => REGLES.map(r=>{
  let res=null; try{res=r.f(M);}catch(e){}
  return res?{...r,...res}:null; }).filter(Boolean);

/* ---- the five gates ---- */
const PORTES = [
{id:"closure",nom:"Closure",org:["01","18"],
 f:M=>{const b=lst(M,"18").filter(x=>x.nom);
   if(!b.length) return {ko:"No loop is declared. If no effect comes back onto its own cause inside the boundary, the boundary is badly drawn.",c:"0 loops declared"};
   const nq=b.filter(x=>!x.type);
   if(nq.length) return {ko:`${nq.length} loop${nq.length>1?"s":""} left unqualified. An unqualified loop is drawn, not modelled.`,c:`${b.length} loops · ${nq.length} unqualified`};
   return {ok:1,c:`${b.length} loop${b.length>1?"s":""} qualified`};}},
{id:"conservation",nom:"Conservation",org:["06","08","10"],
 f:M=>{const e=lst(M,"06").reduce((a,b)=>a+(+b.volume||0),0);
   const s=lst(M,"10").filter(x=>x.induite!=="yes").reduce((a,b)=>a+(+b.valeur||0),0);
   if(!e||!s) return {ind:"Inputs or outputs not filled in: this gate cannot be evaluated.",c:"—"};
   const base=Math.abs(e-100)<1?100:e, d=base-s;
   if(Math.abs(d)>0.5) return {ko:`${Math.abs(d)} units ${d>0?"vanish with no destination":"appear with no origin"}. A stock or an output is missing. This sends you back to the boundary, not to the stocks: the usual cause is an output living outside the scope and never counted.`,c:`in ${base} · out ${s} · gap ${d}`};
   return {ok:1,c:`in ${base} = out ${s}`};}},
{id:"nonlin",nom:"Non-linearity",org:["13"],
 f:M=>{const r=lst(M,"13");
   if(!r.length) return {ind:"No transformation rule filled in.",c:"—"};
   const n=r.filter(x=>x.nonlin==="yes").length;
   if(!n) return {ko:"No threshold identified. A purely linear model never surprises you: it returns what you put in. Look at the extremes of the range.",c:`${r.length} rules · 0 non-linear`};
   return {ok:1,c:`${n} non-linearit${n>1?"ies":"y"} out of ${r.length} rules`};}},
{id:"stability",nom:"Stability",org:["14","17","15"],
 f:M=>{const d=totalDelai(M), c=+(obj(M,"17").cadence);
   if(!d||!c) return {ind:"Delays or cadence not filled in.",c:"—"};
   if(c<d) return {ko:`Cadence of ${c} day${c>1?"s":""} against a total delay of ${d} days. Each correction leaves before the previous one has landed: oscillation guaranteed.`,c:`cadence ${c} d < delay ${d} d`};
   return {ok:1,c:`cadence ${c} d ≥ delay ${d} d`};}},
{id:"honesty",nom:"Honesty",org:["04","19"],
 f:M=>{const ci=lst(M,"04").filter(x=>x.preuve==="hunch").map(x=>x.nom||"constraint");
   const vi=lst(M,"19").filter(x=>x.niveau==="hunch").map(x=>x.valeur||"value");
   const tout=[...ci,...vi];
   if(!lst(M,"19").length&&!lst(M,"04").length) return {ind:"No evidence level filled in.",c:"—"};
   if(tout.length) return {ko:`${tout.join(", ")} rest${tout.length>1?"":"s"} on an untested hunch. Verify before spending an iteration on a possibly imaginary limit.`,c:`${tout.length} value${tout.length>1?"s":""} on a hunch`};
   return {ok:1,c:"every value carries a source"};}}
];

/* ---- notifications ---- */
function calcNotifs(M){
  const N=[];
  calcFrictions(M).forEach(f=>N.push({id:"f-"+f.id,cat:"friction",sev:"critique",loi:!!f.loi,
    titre:f.nom,txt:f.t,calc:f.c,org:f.cases.split(" · ")}));
  PORTES.forEach(p=>{ let r=null; try{r=p.f(M);}catch(e){}
    if(!r) return;
    if(r.ko) N.push({id:"p-"+p.id,cat:"porte",sev:"attention",titre:"Gate · "+p.nom,
      txt:r.ko,calc:r.c,org:p.org});
    else if(r.ind) N.push({id:"p-"+p.id,cat:"porte",sev:"veille",titre:"Gate · "+p.nom,
      txt:r.ind,calc:r.c,org:p.org});});
  ORGANES.filter(o=>!estRempli(o,M)).forEach(o=>N.push({id:"m-"+o.id,cat:"manque",
    sev:o.zone==="schema"?"attention":"veille",titre:o.nom+" not filled in",
    txt:EXPL[o.id][0],calc:o.zone==="schema"?"organ inside the model":"organ outside the model",org:[o.id]}));
  lst(M,"12").forEach((p,i)=>{ if(p.degel) N.push({id:"v-degel"+i,cat:"veille",sev:"veille",
    titre:"Unfreeze watch — "+(p.nom||"parameter"),
    txt:`Frozen for the following reason: ${p.raison||"not stated"}. It will have to be reopened if the condition below is met.`,
    calc:p.degel,org:["12"]});});
  lst(M,"21").forEach((e,i)=>{ if(e.signal) N.push({id:"v-reint"+i,cat:"veille",sev:"veille",
    titre:"Re-entry watch — "+(e.nom||"excluded element"),
    txt:`Excluded from scope for the following reason: ${e.raison||"not stated"}. To be brought back in if the signal below fires.`,
    calc:e.signal,org:["21"]});});
  lst(M,"20").forEach((h,i)=>N.push({id:"v-hyp"+i,cat:"veille",sev:"veille",
    titre:"Untested structural assumption",
    txt:`${h.nom||"Assumption with no statement"} — a shape error never corrects itself through iteration: it is confirmed at every cycle with growing confidence.`,
    calc:h.test?"Test: "+h.test:"no test defined",org:["20"]}));
  lst(M,"07").filter(p=>p.gravite==="high"&&p.obs==="yes").forEach((p,i)=>
    N.push({id:"v-pert"+i,cat:"veille",sev:"attention",
      titre:"Disturbance to model — "+(p.nom||"unknown source"),
      txt:"This disturbance is both severe and observable. While it stays in disturbances, its variation is attributed to your levers. It should move up into inputs.",
      calc:"high severity · observable",org:["07","06"]}));
  const ordre={critique:0,attention:1,veille:2};
  return N.sort((a,b)=>ordre[a.sev]-ordre[b.sev]);
}

/* ---- ignorance map ---- */
function carteIgnorance(M){
  const it=[];
  ORGANES.filter(o=>["01","16","08","15","17"].includes(o.id)).map(o=>o.id).forEach(id=>{ if(!estRempli(OM[id],M))
    it.push({rang:0,quoi:OM[id].nom,ou:"organ "+id+"",
      pq:"A function left unserved: everything that depends on it is undetermined.",org:id});});
  lst(M,"20").forEach(h=>it.push({rang:1,quoi:h.nom||"assumption with no statement",
    ou:"organ 20 · structural assumption",
    pq:h.test?"Possible shape error. Planned test: "+h.test
      :"Possible shape error, and no test is defined to invalidate it.",org:"20"}));
  lst(M,"04").filter(c=>c.preuve==="hunch").forEach(c=>it.push({rang:2,
    quoi:c.nom||"constraint",ou:"organ 04 · constraint",
    pq:"A constraint bounds the levers' domain. If it is assumed, you may be ruling out viable iterations.",org:"04"}));
  lst(M,"19").filter(v=>v.niveau==="hunch").forEach(v=>it.push({rang:3,
    quoi:v.valeur||"value",ou:"organ 19 · evidence level",
    pq:"Unmeasured value. Worth testing if it drives an output, worth ignoring otherwise.",org:"19"}));
  return it.sort((a,b)=>a.rang-b.rang);
}

/* ---- dashboard indicators ---- */
function kpi(id,M){
  const A=(v,sub,etat,txt)=>({v,sub,etat:etat||"ok",txt:!!txt});
  const V=(sub)=>({v:"—",sub,etat:"vide"});
  switch(id){
    case "01":{const l=lst(M,"01"),d=l.filter(x=>x.type==="start").length,f=l.filter(x=>x.type==="end").length;
      return l.length?A(`${d} → ${f}`,"entry and exit events"):V("boundary not drawn");}
    case "02":{const o=obj(M,"02"); if(!o.cible) return V("no target set");
      return A(String(o.cible),`${o.metrique||"target"} · floor ${o.plancher??"?"}`);}
    case "03":{const o=obj(M,"03");
      return o.revele?A("divergent","optimises something else","alerte",true)
                     :V("sacrifice test not done");}
    case "04":{const l=lst(M,"04"); if(!l.length) return V("no constraint");
      let pire=null,val=0,txt="";
      l.forEach(c=>{const b=+c.borne,ch=+c.charge; if(!b||!ch) return;
        if((c.nature||"throughput")==="throughput"){const u=ch/b*100; if(u>val){val=u;pire=c;txt=`${u.toFixed(0)} %`;}}
        else if(c.nature==="depleting stock"){const a=b/ch; const u=100-Math.min(100,a*12);
          if(u>val){val=u;pire=c;txt=`${a.toFixed(1)} p.`;}}});
      if(!pire) return A(String(l.length),"constraints, none quantified","alerte");
      return A(txt,pire.nom,val>80?"alerte":"ok");}
    case "05":{const o=obj(M,"05"); return o.nom?A(o.nom,`can refuse: ${o.refus||"?"}`,
      o.refus==="no"?"alerte":"ok",true):V("no owner named");}
    case "07":{const l=lst(M,"07"); if(!l.length) return V("no disturbance listed");
      const g=l.filter(x=>x.gravite==="high"&&x.obs==="yes").length;
      return A(String(g),`severe and observable · ${l.length} total`,g?"alerte":"ok");}
    case "12":{const l=lst(M,"12"); if(!l.length) return V("no frozen parameter");
      const sd=l.filter(x=>!x.degel).length;
      return A(String(l.length),sd?`${sd} with no unfreeze condition`:"all with an unfreeze condition",
        sd?"alerte":"ok");}
    case "14":{const t=totalDelai(M); const o=obj(M,"14");
      if(!t) return V("delays not filled in");
      const c=+obj(M,"17").cadence;
      return A(`${t} d`,`process ${o.processus||0} + sensor ${o.capteur||0}`,
        c&&c<t?"alerte":"ok");}
    case "18":{const l=lst(M,"18"); if(!l.length) return V("no loop identified");
      const e=l.filter(x=>x.type==="balancing").length, a=l.filter(x=>x.type==="reinforcing").length;
      return A(`${e} / ${a}`,"balancing / reinforcing",(e&&a)?"ok":"alerte");}
    case "19":{const l=lst(M,"19"); if(!l.length) return V("no evidence level");
      const m=l.filter(x=>x.niveau==="measured").length, i=l.filter(x=>x.niveau==="hunch").length;
      return A(`${Math.round(m/l.length*100)} %`,`measured · ${i} on a hunch`,i?"alerte":"ok");}
    case "20":{const l=lst(M,"20"); if(!l.length) return V("no assumption recorded");
      const st=l.filter(x=>!x.test).length;
      return A(String(l.length),st?`${st} with no test`:"all with a test",st?"alerte":"ok");}
    case "21":{const l=lst(M,"21"); if(!l.length) return V("excluded scope not recorded");
      const ss=l.filter(x=>!x.signal).length;
      return A(String(l.length),ss?`${ss} with no re-entry signal`:"all with a re-entry signal",
        ss?"alerte":"ok");}
    default: return V("");
  }
}
const estOrganeId = id => /^\d\d$/.test(id||"");
const uid = () => "s"+Math.random().toString(36).slice(2,9);

/* ================== REGISTER SEED — DERIVED FROM PRE-CALL ================== */
/* Every line below is read off the Pre-call sheet. Nothing is invented.
   What one mechanism cannot settle is written as an open question rather than a value. */
const REG_SEED = {
 interfaces:[
  {point:"Appointments booked",de:"VSL & booking",part:"100 %",vers:"Pre-call",
   mode:"duplication",debit:90,unite:"week",
   def:"TO ARBITRATE — slot reserved, or reserved with a valid number? 88 % valid on arrival"},
  {point:"Showed up",de:"Pre-call",part:"100 %",vers:"Sales",
   mode:"duplication",debit:61,unite:"week",
   def:"TO ARBITRATE — connected, or stayed 5 minutes? Sales must read 61 here, not 90 from the VSL"},
  {point:"Manual follow-up workload",de:"Pre-call",part:"100 %",vers:"Setting team",
   mode:"duplication",debit:255,unite:"week (minutes)",
   def:"Induced output — nobody counts it today"},
  {point:"Leads irritated by over-contact",de:"Pre-call",part:"100 %",vers:"Brand reputation",
   mode:"duplication",debit:4,unite:"week",
   def:"Induced output — the cost Pre-call imposes on whoever comes next"}],

 ressources:[
  {nom:"Calendar slots open",nature:"throughput",unite:"slots/week",borne:100,charge:90,seuil:80,
   puisent:"Pre-call",note:"CONFIRM — does Sales book into the same calendar?"},
  {nom:"Setting time for personal videos",nature:"throughput",unite:"min/week",borne:300,charge:255,seuil:240,
   puisent:"Pre-call",note:"Pre-call sends it 255 min/wk — the interface carries the load, this line the capacity. CONFIRM: does the setting team do anything else?"},
  {nom:"Carrier SMS sending quota",nature:"threshold",unite:"messages/day",borne:500,charge:320,seuil:100,
   puisent:"Pre-call",note:"CONFIRM — any other sequence sending from the same number?"},
  {nom:"Prepaid SMS credit",nature:"depleting stock",unite:"€",borne:900,charge:260,seuil:3,
   puisent:"Pre-call",note:"CONFIRM — if shared, the runway is shorter than it looks"},
  {nom:"Founder's attention",nature:"presence",unite:"person",borne:1,charge:1,seuil:"",
   puisent:"No mechanism",note:"Appears in no sheet — which is exactly why it belongs here"}],

 evenements:[
  {date:"",nom:"Upstream creative change",
   rompt:"Intent quality of incoming leads — any before/after show comparison is void. Listed as a high-severity observable disturbance in Pre-call",
   rouages:"Pre-call"},
  {date:"",nom:"SMS provider or sending number changed",
   rompt:"Deliverability, therefore the reminder effect",rouages:"Pre-call"},
  {date:"",nom:"Calendar or booking tool changed",
   rompt:"Continuity AND definition of the latency measurement",rouages:"Pre-call"},
  {date:"",nom:"Setting team changed size",
   rompt:"Video setting capacity, already near its limit",rouages:"Pre-call"}],

 acteurs:[
  {nom:"Pre-call lead",role:"Owns the mechanism",
   leviers:"Maximum delay between booking and slot · Number and channel of reminders in the window · Requiring an active confirmation from the lead · Personal video message from the sales rep · One-click rescheduling offered",
   rouages:"Pre-call",note:"",refus:"yes"},
  {nom:"FILL IN — who owns CRM entry?",role:"",
   leviers:"CRM entry latency · data quality",
   rouages:"Pre-call",note:"and every other mechanism",refus:""},
  {nom:"The sales rep",role:"Confirms attendance in the CRM",
   leviers:"Calendar and CRM · the sensor behind the show rate — no lever, but the data",
   rouages:"Pre-call",note:"CHECK — is the sales rep evaluated on the number they enter?",refus:"no"},
  {nom:"FILL IN — who opens the calendar slots?",role:"",
   leviers:"How many slots are opened, and when",rouages:"Pre-call",note:"at least — confirm who else",refus:""},
  {nom:"FILL IN — you",role:"Founder",
   leviers:"Price · offer · ad budget · hiring · priorities",
   rouages:"No mechanism",note:"Appears in no sheet — count how many in total",refus:""}]
};
const REG_CLES = ["interfaces","ressources","evenements","acteurs"];
/* Seeding is per register, not all-or-nothing: one populated register used to leave
   the other three empty for good. */
const regSemer = r => {
  const o={};
  REG_CLES.forEach(k=>{
    const l = r && Array.isArray(r[k]) ? r[k] : [];
    o[k] = l.length ? l : (REG_SEED[k]||[]).map(x=>({...x}));
  });
  return o;
};

/* ================== REGISTERS ================== */
const REGISTRES = [
{id:"interfaces",nom:"Interfaces",sous:"what links two mechanisms through a flow",
 quoi:"An interface point is where what leaves one mechanism enters another. It belongs to neither: described inside each of them, it gets entered twice, and the two copies eventually diverge.",
 detecte:"Orphan leaks — the ones no team feels responsible for. If one mechanism reports 90 leaving and the next reports 61 arriving, twenty-nine units vanish between them and nobody does the subtraction.",
 filtre:"This iteration changes what the neighbour receives: warn them, and measure on the slower of the two clocks.",
 quand:"From the third mechanism onward, once you have two contact points to compare.",
 mec:["de","vers"],
 cols:[{k:"point",l:"Interface point",t:"txt",w:"19%"},
       {k:"de",l:"Sender",t:"mec1",w:"14%"},
       {k:"part",l:"Share",t:"txt",w:"8%",ph:"100 %"},
       {k:"vers",l:"Receiver",t:"mec1",w:"14%"},
       {k:"mode",l:"Mode",t:"sel",o:["duplication","split"],w:"13%"},
       {k:"debit",l:"Volume",t:"num",w:"8%"},
       {k:"unite",l:"Per",t:"txt",w:"10%",ph:"week"},
       {k:"def",l:"Agreed definition",t:"txt",w:"14%"}]},

{id:"ressources",nom:"Resources",sous:"what several mechanisms compete for",
 quoi:"A resource does not circulate: it is consumed without coming back out, and it bounds what the others can do. Cross-cutting stocks belong here too — cash, context base, audience — because position decides, not dynamics.",
 detecte:"Contention. Two mechanisms with no flow between them slow down at the same time, and nobody makes the connection since there is no arrow to follow.",
 filtre:"Do not iterate to raise volume here: the resource is saturated and the gain will be absorbed by the queue.",
 quand:"From the second mechanism onward. The most useful register, and the most invisible otherwise.",
 mec:["puisent"],
 cols:[{k:"nom",l:"Resource",t:"txt",w:"20%"},
       {k:"nature",l:"Nature",t:"sel",o:["throughput","threshold","depleting stock","stock threshold","presence"],w:"15%"},
       {k:"unite",l:"Unit",t:"txt",w:"11%"},
       {k:"borne",l:"Capacity",t:"num",w:"9%"},
       {k:"charge",l:"Load",t:"num",w:"9%"},
       {k:"seuil",l:"Alert threshold",t:"num",w:"11%"},
       {k:"puisent",l:"Mechanisms involved",t:"mecs",w:"18%"},
       {k:"note",l:"Note",t:"txt",w:"22%"}]},

{id:"evenements",nom:"Events",sous:"what breaks comparability",
 quoi:"An event does not repeat, so it cannot be steered. It is not modelled: it is logged. Anything that returns every year — seasonality, holidays — is not one: it is an unmodelled input.",
 detecte:"Nothing, and that is deliberate. It produces no friction, it produces an invalidation: measurements taken before are no longer comparable to those taken after.",
 filtre:"Do not compare across this date.",
 quand:"As you go, starting now. A line takes thirty seconds and saves a conclusion.",
 mec:["rouages"],
 cols:[{k:"date",l:"Date",t:"txt",w:"12%",ph:"2026-09-05"},
       {k:"nom",l:"Event",t:"txt",w:"28%"},
       {k:"rompt",l:"What it breaks",t:"txt",w:"34%"},
       {k:"rouages",l:"Mechanisms involved",t:"mecs",w:"26%"}]},

{id:"acteurs",nom:"Owners",sous:"who holds authority over which lever",
 quoi:"Authority cuts across mechanisms: one person often holds levers in three of them. Duplicated inside each sheet, that concentration stays invisible.",
 detecte:"The real human constraint. It is usually the attention of two or three people, rather than budget or time, that bounds the whole.",
 filtre:"This iteration has no available owner, whatever its priority.",
 quand:"As you go. The « can hold a refusal » column is the most discriminating one.",
 mec:["rouages"],
 cols:[{k:"nom",l:"Person",t:"txt",w:"18%"},
       {k:"role",l:"Role",t:"txt",w:"16%"},
       {k:"leviers",l:"Levers under their authority",t:"txt",w:"32%"},
       {k:"rouages",l:"Mechanisms involved",t:"mecs",w:"16%"},
       {k:"note",l:"Note",t:"txt",w:"18%"},
       {k:"refus",l:"Can hold a refusal",t:"sel",o:["yes","no"],w:"10%"}]}
];
const RM = Object.fromEntries(REGISTRES.map(r=>[r.id,r]));

/* ---- mechanism picker: dropdown. Multi stores names comma separated, or "No mechanism".
   Single stores a plain name. ---- */
function MecPick({value,systemes,onCh,mono}){
  const [ouv,setOuv]=useState(false);
  const noms=(systemes||[]).map(x=>x.nom);
  const v=String(value||"").replace(/\s*·\s*/g,", ");

  if(mono){
    const connu=noms.some(n=>n.toLowerCase()===v.trim().toLowerCase());
    return (
      <div className="mdd">
        <button type="button" className="mdt" data-on={ouv?"1":"0"} data-vide={v?"0":"1"}
          onClick={()=>setOuv(o=>!o)}>
          <span>{v||"select"}</span><i>{ouv?"▴":"▾"}</i></button>
        {ouv && (<>
          <div className="mdbk" onClick={()=>setOuv(false)}/>
          <div className="mdp">
            {noms.map(n=>(
              <button key={n} type="button" className="mdo" data-on={n===v?"1":"0"}
                onClick={()=>{onCh(n);setOuv(false);}}>{n}</button>))}
            {noms.length===0 && <div className="mdv">No mechanism modelled yet</div>}
            <div className="mdsep">not a modelled mechanism</div>
            <input className="mdi" autoFocus={!connu} placeholder="type a counterparty"
              value={connu?"":v} onChange={e=>onCh(e.target.value)}/>
          </div></>)}
      </div>);
  }

  const AUCUN="No mechanism";
  const parts=v.split(",").map(x=>x.trim()).filter(Boolean);
  const aucun=parts.some(p=>p.toLowerCase()===AUCUN.toLowerCase());
  const actifs=aucun?[]:noms.filter(n=>parts.some(p=>p.toLowerCase()===n.toLowerCase()));
  const hors=aucun?[]:parts.filter(p=>!noms.some(n=>n.toLowerCase()===p.toLowerCase()));
  const ecrire=l=>onCh(l.join(", "));
  const basculer=n=>ecrire([...(actifs.includes(n)?actifs.filter(x=>x!==n):[...actifs,n]),...hors]);
  const retirer=h=>ecrire([...actifs,...hors.filter(x=>x!==h)]);
  const etiquette=aucun?AUCUN:[...actifs,...hors].join(", ");

  return (
    <div className="mdd">
      <button type="button" className="mdt" data-on={ouv?"1":"0"}
        data-vide={etiquette?"0":"1"} data-none={aucun?"1":"0"}
        onClick={()=>setOuv(o=>!o)}>
        <span>{etiquette||"select mechanisms"}</span>
        {actifs.length>1 && <b className="mdn">{actifs.length}</b>}
        <i>{ouv?"▴":"▾"}</i></button>
      {ouv && (<>
        <div className="mdbk" onClick={()=>setOuv(false)}/>
        <div className="mdp">
          {noms.map(n=>(
            <button key={n} type="button" className="mdo" data-on={actifs.includes(n)?"1":"0"}
              onClick={()=>basculer(n)}>
              <span className="ck">{actifs.includes(n)?"✓":""}</span>{n}</button>))}
          {noms.length===0 && <div className="mdv">No mechanism modelled yet</div>}
          {hors.length>0 && <div className="mdsep">not modelled</div>}
          {hors.map(h=>(
            <button key={h} type="button" className="mdo ext" onClick={()=>retirer(h)}>
              <span className="ck">✓</span>{h}</button>))}
          <div className="mdsep">or</div>
          <button type="button" className="mdo none" data-on={aucun?"1":"0"}
            onClick={()=>{ecrire(aucun?[]:[AUCUN]);setOuv(false);}}>
            <span className="ck">{aucun?"✓":""}</span>No mechanism</button>
        </div></>)}
    </div>);
}

function TableRegistre({reg,lignes,maj,systemes}){
  const [fm,setFm]=useState(null);
  const [aSupprimer,setASupprimer]=useState(null);
  const cles=reg.mec||[];
  const touche=(row,nom)=>cles.some(k=>relie(row[k],nom));
  const rattache=row=>(systemes||[]).some(s=>touche(row,s.nom));
  const visibles=(lignes||[]).map((row,i)=>({row,i})).filter(({row})=>
    fm===null ? true : fm==="__none" ? !rattache(row) : touche(row,fm));
  const nMec=nom=>(lignes||[]).filter(r=>touche(r,nom)).length;
  const nNone=(lignes||[]).filter(r=>!rattache(r)).length;
  useEffect(()=>{
    if((lignes||[]).length===0 && (REG_SEED[reg.id]||[]).length>0) maj.seed(reg.id);
  },[reg.id]);
  return (<>
    {aSupprimer!==null && (()=>{
      const row=lignes[aSupprimer]||{};
      const rempli=reg.cols.filter(c=>String(row[c.k]??"").trim()!=="");
      return (
        <div className="sy-back" onClick={()=>setASupprimer(null)}>
          <div className="sy-modal sm2" onClick={e=>e.stopPropagation()}>
            <div className="mh" style={{background:"linear-gradient(135deg,var(--wine-800),var(--stop))"}}>
              <div><div className="mk">delete from {reg.nom}</div>
                <div className="mt">{rempli.length?String(row[rempli[0].k]):"empty row"}</div></div>
              <button className="pcl" onClick={()=>setASupprimer(null)}>×</button></div>
            <div className="mb">
              <div className="mblk"><span className="rl">what you are removing</span>
                {rempli.length===0 ? <p>An empty row. Nothing is lost.</p>
                  : <div className="sy-delrows">{rempli.map(c=>(
                      <div key={c.k}><span>{c.l}</span><b>{String(row[c.k])}</b></div>))}</div>}</div>
              <div className="mblk"><span className="rl">before you do</span>
                <p>A register entry is the only place a shared object exists once. Deleting it does
                not remove the thing — it removes the only record that two mechanisms touch it.</p></div>
            </div>
            <div className="mf">
              <button className="sy-b sm" onClick={()=>setASupprimer(null)}>Keep it</button>
              <button className="sy-b sm danger"
                onClick={()=>{maj.del(reg.id,aSupprimer);setASupprimer(null);}}>Delete</button></div>
          </div>
        </div>);})()}
      {lignes.length>0 && (systemes||[]).length>0 && (
        <div className="sy-fmec">
          <span className="fl2">show</span>
          <button data-on={fm===null?"1":"0"} onClick={()=>setFm(null)}>
            all <i>{lignes.length}</i></button>
          {(systemes||[]).map(x=>(
            <button key={x.id} data-on={fm===x.nom?"1":"0"} onClick={()=>setFm(x.nom)}
              disabled={nMec(x.nom)===0}>
              {x.nom} <i>{nMec(x.nom)}</i></button>))}
          {nNone>0 && (
            <button data-on={fm==="__none"?"1":"0"} onClick={()=>setFm("__none")}>
              outside your mechanisms <i>{nNone}</i></button>)}
        </div>)}

      <div className="sy-regt">
        {lignes.length===0 ? (
          <div className="sy-regv">
            <b>Empty register.</b> It fills up from your mechanisms, not before:
            {" "}{reg.quand.charAt(0).toLowerCase()+reg.quand.slice(1)}
            {(REG_SEED[reg.id]||[]).length>0 && (
              <div style={{marginTop:12}}>
                <button className="sy-b p" onClick={()=>maj.seed(reg.id)}>
                  Load the {REG_SEED[reg.id].length} entries derived from Pre-call</button>
              </div>)}
            <div style={{marginTop:10,fontFamily:"var(--mono)",fontSize:10.5,opacity:.8}}>
              Each register is seeded on its own — one filled register no longer leaves the others empty.
            </div>
          </div>
        ) : (
          <table className="sy-tb">
            <thead><tr>{reg.cols.map(c=><th key={c.k} style={{width:c.w}}>{c.l}</th>)}
              <th style={{width:30}}/></tr></thead>
            <tbody>
              {visibles.map(({row,i})=>(
                <tr key={i}>
                  {reg.cols.map(c=>(
                    <td key={c.k}>
                      {c.t==="sel"
                        ? <select value={row[c.k]??""} onChange={e=>maj.set(reg.id,i,c.k,e.target.value)}>
                            <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>
                        : c.t==="mecs"
                        ? <MecPick value={row[c.k]} systemes={systemes}
                            onCh={v=>maj.set(reg.id,i,c.k,v)}/>
                        : c.t==="mec1"
                        ? <MecPick mono value={row[c.k]} systemes={systemes}
                            onCh={v=>maj.set(reg.id,i,c.k,v)}/>
                        : <input type={c.t==="num"?"number":"text"} value={row[c.k]??""}
                            placeholder={c.ph||""}
                            onChange={e=>maj.set(reg.id,i,c.k,e.target.value)}/>}
                    </td>))}
                  <td><button className="sy-x" title="Delete this entry"
                    onClick={()=>setASupprimer(i)}>×</button></td>
                </tr>))}
            </tbody>
          </table>)}
        {lignes.length>0 && visibles.length===0 && (
          <p className="sy-none" style={{padding:"0 0 12px"}}>
            No entry in this register mentions that mechanism. Either it does not touch it, or the
            mechanism column is worded differently from the mechanism's name.</p>)}
        <button className="sy-b p" onClick={()=>maj.add(reg.id)}>Add a row</button>
      </div>
  </>);
}

function VueRegistre({reg,lignes,maj,systemes}){
  const [aide,setAide]=useState(false);
  return (
  <div className="sy-scroll">
    <div className="sy-head hd">
      <div>
        <h2>{reg.nom}</h2>
        <p>{reg.sous.charAt(0).toUpperCase()+reg.sous.slice(1)}.</p>
      </div>
      <button className="sy-qm" onClick={()=>setAide(true)} aria-label="What is this register">?</button>
    </div>


    {aide && (
      <div className="sy-back" onClick={()=>setAide(false)}>
        <div className="sy-modal" onClick={e=>e.stopPropagation()}>
          <div className="mh">
            <div>
              <div className="mk">register</div>
              <div className="mt">{reg.nom}</div>
            </div>
            <button className="pcl" onClick={()=>setAide(false)}>×</button>
          </div>
          <div className="mb">
            <div className="mblk"><span className="rl">definition</span><p>{reg.quoi}</p></div>
            <div className="mblk"><span className="rl">what it detects</span><p>{reg.detecte}</p></div>
            <div className="mblk"><span className="rl">filter it hands to iterations</span>
              <p className="fq">« {reg.filtre} »</p></div>
            <div className="mblk"><span className="rl">when to fill it in</span><p>{reg.quand}</p></div>
          </div>
          <div className="mf"><button className="sy-b p sm" onClick={()=>setAide(false)}>Got it</button></div>
        </div>
      </div>)}

    <div className="sy-panel">
      <div className="sy-ph"><span>register entries</span><span className="bar"/>
        <span>{lignes.length} row{lignes.length>1?"s":""}{" "}
          {lignes.length>0 && (REG_SEED[reg.id]||[]).length>0 &&
            <button className="sy-b sm" style={{marginLeft:10}}
              onClick={()=>maj.seed(reg.id)}>reload from Pre-call</button>}</span></div>
    <TableRegistre reg={reg} lignes={lignes} maj={maj} systemes={systemes}/>
    </div>
  </div>);
}

/* ================== THEORY DATA ================== */
const FAMT = {
  frame:{n:"Frame",c:"#9A6410"}, matter:{n:"Matter",c:"#0E6E7A"},
  machinery:{n:"Machinery",c:"#5B3A9E"}, control:{n:"Control",c:"#14705A"},
  epistemic:{n:"Epistemic",c:"#A81D3A"}
};
const FKEY={"Frame":"frame","Matter":"matter","Machinery":"machinery",
            "Control":"control","Epistemic":"epistemic"};
const couleurOrgane = id => (OM[id]&&FAMT[FKEY[OM[id].fam]]) ? FAMT[FKEY[OM[id].fam]].c : "#A08E93";

const TERMES_T = [
 ["Interact",
  "This is what separates a mechanism from a sequence. If the elements follow one another without ever influencing each other back, you have a chain of steps, and its behaviour is deducible from its parts.",
  "test — is there at least one closed loop?"],
 ["Intended result",
  "Intended, not pursued. A mechanism wants nothing: it produces a result, and that result is not always the declared one. The distance between the two is an object in its own right — organ 03.",
  "test — what does it actually produce when pressure rises?"],
 ["Regularly enough",
  "This is what makes steering possible. You only steer what repeats: on a one-off event there is nothing to tune, only a decision to make once.",
  "test — does it start again, at an identifiable cadence?"]
];

const CHVSY_T = [
 ["What defines it","Steps follow one another; no effect comes back onto its cause.",
  "At least one effect returns onto its own cause."],
 ["Its behaviour","Deducible from its parts. Three steps at 80, 70 and 60 per cent give 33.6 per cent.",
  "Not deducible. Every element behaves as predicted and the whole contradicts the prediction."],
 ["What surprises you","Nothing. Improve one step and the result moves proportionally.",
  "Gains that eat themselves, problems that return despite corrections, two-stage behaviour."],
 ["Modelling depth","The five functions are quickly served. Gains add up.",
  "The full twenty-one earn their keep. Surprises come from how the loops compose."],
 ["The test","Follow an effect. It never comes back.",
  "Follow an effect. It comes back onto its cause."]
];



const ROLES_T = [
 ["Produce its result repeatably",
  "The first term of the definition put to the test. A project ends, a mechanism starts again. Until the result has a name, a unit and a cadence, you have an activity, not a mechanism.",
  "test — can you name what it produces, in what unit, at what cadence?",
  "answered by organs 10 and 02 — outputs give the unit, the declared objective gives the cadence"],
 ["Absorb variation through its own interactions",
  "The role everyone forgets, and it follows directly from the word « interact ». A well-tuned mechanism takes small variations on its internal loops without mobilising anyone. If it demands a human call on every gap, it is not a mechanism: it is a queue of decisions dressed up as a process.",
  "test — what happens when the gap stays small? If the answer is not « nothing, it is written down », the role is not met.",
  "answered by organ 17 — the dead band, and the inaction written next to it"],
 ["Signal its own drift before the result shows it",
  "Interactions produce delayed effects: by the time output falls, the cause is often weeks old. A swelling stock precedes the effect instead of recording it, which is why a mechanism must be instrumented on its accumulations, not only on its output.",
  "test — what signal appears first when this mechanism starts to degrade?",
  "answered by organs 08 and 15 — a stock with a sensor on it, not just a sensor on the output"],
 ["Be runnable by someone other than you",
  "A mechanism only you can run is not a mechanism, it is a personal skill. This is the role that decides whether the company can grow: delegating assumes a named owner, a written cadence and a fixed dead band.",
  "test — how long before someone else takes it over, and what do they need that is not in your head?",
  "answered by organs 05 and 17 — a named owner who can hold a refusal, and a policy decided in cold blood"]
];

const PASMECA_T = [
 ["A tool","A CRM, a spreadsheet, an automation. It carries no matter of its own — it is where other mechanisms' sensors live. Operations register, or organ 15.",
  "does it produce a result, or does it hold someone else's data?"],
 ["A team","People are an owner and a capacity, not a mechanism. Modelling « the sales team » rather than « the sales call » draws a boundary around an org chart instead of around a loop.",
  "would the boundary survive a reorganisation?"],
 ["A project","It has an end. A mechanism starts again. A launch is a project; what it leaves running afterwards may be a mechanism.",
  "does it recur at an identifiable cadence?"],
 ["An event","It does not repeat, so it cannot be steered — only logged. Anything that returns every year is not an event either: it is an unmodelled input.",
  "will it happen again in the same form?"],
 ["A goal","« Growth », « quality », « being the best ». A result is not a mechanism; the thing that produces it is.",
  "can you name what enters and what leaves?"]
];

const PHASES_T = [
 ["Frame the gap","An observed value, a target, a date. Until all three are written, you do not have a problem but a concern, and nothing downstream can trigger a decision.",
  "produces","Organ 16 · Gap, and its target term, organ 02"],
 ["Draw the boundary","Draw it around a complete loop, never around a team. Then check the clock ratio: two halves running at very different speeds are two mechanisms.",
  "produces","Organ 01 · Boundary, and its complement organ 21"],
 ["Trace the matter","Outputs first, then stocks, then flows, then inputs. That order is deliberate: starting with inputs models what is available rather than what matters.",
  "produces","The model graph — organs 06, 08, 09, 10"],
 ["Open the machinery","Transformation rules, the split between levers and frozen parameters, delays. Delays come last because they depend on the stocks identified in the previous phase.",
  "produces","Organs 04, 05, 11, 12, 13, 14"],
 ["Close the loop","Sensors with their latency and noise, gap, policy. The policy is set last because its cadence is computed from the total delay established just before.",
  "produces","The control apparatus — organs 15, 16, 17, 18"],
 ["Qualify","Evidence level for every value, structural assumptions. This phase produces no new component: it annotates what exists, and it is the only one that stops a model being relitigated forever.",
  "produces","The ignorance map — organs 19 and 20"]
];

const PILOT_T = [
 ["Two laws","Cadence above total delay, dead band above sensor noise. These are inequalities, not comfort settings: breaking them guarantees oscillation.",
  "binary check"],
 ["Ignorance map","What you do not know, ranked by what it carries: unserved function, shape assumption, assumed bound, unmeasured value. A wrong shape is confirmed at every cycle, a wrong value gets caught.",
  "iteration order"],
 ["Frictions","Rules computed on the model alone: conservation broken, clock mismatch, saturation, blind gap. They need no insight, only a comparison.",
  "mechanical diagnosis"],
 ["Located decisions","The real output of the apparatus. Every friction points at an organ, hence a trade-off, hence a named owner allowed to make the call.",
  "what you consume"]
];

const BIBLIO_T = [
 "Each mechanism has one primary result. Two competing results mean either two mechanisms, or a trade-off nobody wanted to make.",
 "No two mechanisms produce the same thing. If they do, the boundary between them is badly drawn, and you will have permanent attribution fights over results.",
 "A mechanism is only worth formalising if its delay exceeds your patience. On something that answers in two hours, trial and error beats the model."
];

const ORGANS_T = [
 {id:1,f:"frame",name:"Boundary",skip:true,
  fonc:"Cuts what belongs to the mechanism from what stays outside. Everything else in the canvas depends on that cut.",
  q:"What is inside, what is outside, and exactly where does the line run?",
  abs:"Effects it does not produce get attributed to it, and the objective becomes unreachable by construction.",
  ok:"You can name a borderline element and say which side it falls on, without hesitating."},
 {id:2,f:"frame",name:"Declared objective",sub:"the announced target",x:530,y:64,w:210,h:58,
  fonc:"Sets the measurable target that serves as reference for the gap comparator.",
  q:"What value, on what metric, by what date?",
  abs:"No gap is computable, so no steering is possible. Only opinion remains.",
  ok:"A number, a unit, a deadline. Not a direction."},
 {id:3,f:"frame",name:"Revealed objective",sub:"what it truly optimises",x:760,y:64,w:240,h:58,
  fonc:"Exposes what the mechanism actually rewards, regardless of what it announces.",
  q:"Looking at last month's decisions, what do they maximise?",
  abs:"You correct levers while the structure pulls elsewhere. Gains dissolve without explanation.",
  ok:"You can quote a recent decision that contradicts the declared objective, or attest that there is none."},
 {id:4,f:"frame",name:"Constraints",sub:"non-negotiable limits",x:110,y:64,w:190,h:58,
  fonc:"Bounds the space of admissible solutions: budget, legal, capacity, ethics.",
  q:"What limits can you not cross, even by paying?",
  abs:"You simulate impossible scenarios and plan on gains that will never be executable.",
  ok:"Each constraint has a limit value and a reason."},
 {id:5,f:"frame",name:"Owner",sub:"who decides, who executes",x:320,y:64,w:190,h:58,
  fonc:"Assigns decision, execution and exposure to the result to identified people.",
  q:"Who decides, who executes, who lives with the result?",
  abs:"A policy with no owner never applies. The mechanism stays theoretical.",
  ok:"One name per role, not a team."},
 {id:6,f:"matter",name:"Inputs",sub:"rate & quality",x:125,y:250,w:180,h:76,
  fonc:"Feeds the mechanism with resources, signals or units to process.",
  q:"What, how much, at what cadence, with what variance?",
  abs:"You blame the process for a drop that comes from upstream, and tune an engine starved of fuel.",
  ok:"An average rate and a spread, not a running total."},
 {id:7,f:"matter",name:"Disturbances",sub:"exogenous shocks",x:700,y:168,w:200,h:62,
  fonc:"Represents the shocks the mechanism takes without choosing them: seasonality, platform, market.",
  q:"Which shocks, how often, of what amplitude?",
  abs:"The model looks more stable than it is. Real variance surprises you every cycle.",
  ok:"Each disturbance has an estimated frequency and a quantified effect on a flow or a stock."},
 {id:8,f:"matter",name:"Stocks",sub:"what accumulates",x:670,y:250,w:175,h:76,
  fonc:"Accumulates between two flows. The mechanism's memory, and the thing that reveals bottlenecks.",
  q:"What piles up, at what level, for how long?",
  abs:"The bottleneck goes invisible: conversion rates stay fine while the queue grows.",
  ok:"A level and an average age, recorded on a date."},
 {id:9,f:"matter",name:"Flows",sub:"rate between steps",badge:{cx:871,cy:288},
  fonc:"Carries matter from one step to the next, at a given rate and pass-through ratio.",
  q:"What rate between each step, and what pass-through ratio?",
  abs:"You reason on global volume without knowing where it jams. Corrections become random.",
  ok:"Every edge on the canvas carries a rate and a ratio."},
 {id:10,f:"matter",name:"Outputs",sub:"measured results",x:1150,y:250,w:175,h:76,
  fonc:"Produces the measurable result to be compared with the objective, and which sometimes feeds another mechanism.",
  q:"What result, measured how, going to whom?",
  abs:"The mechanism runs with no proof it serves anything. Activity gets mistaken for production.",
  ok:"A metric, a unit, a destination."},
 {id:11,f:"machinery",name:"Levers",sub:"what you can move",x:360,y:390,w:230,h:76,
  fonc:"Variables genuinely actionable over the chosen horizon, with their range and their cost.",
  q:"What can you move over this horizon, within what range, at what cost?",
  abs:"The diagnosis leads to no action. You know what is wrong and can do nothing with it.",
  ok:"Each lever has a current value, a range and a cost of movement."},
 {id:12,f:"machinery",name:"Frozen parameters",sub:"fixed for this horizon",x:360,y:168,w:230,h:62,
  fonc:"Fixes what will not move over the horizon, and therefore enters the simulation as a constant.",
  q:"What is frozen for this horizon, and for what reason?",
  abs:"You plan on imaginary levers. The plan is unworkable from day one.",
  ok:"Each frozen parameter carries a reason and a review date."},
 {id:13,f:"machinery",name:"Transformation rules",sub:"f(inputs, parameters)",x:360,y:250,w:230,h:76,
  fonc:"Links each step's input and output through an explicit function.",
  q:"What function links input and output at each step, with what coefficients?",
  abs:"The simulation has no engine. You stack ratios without knowing why they take those values.",
  ok:"You can compute a step's output from its input without looking at history."},
 {id:14,f:"machinery",name:"Delays",sub:"cause→effect latency",x:905,y:250,w:170,h:76,
  fonc:"Shifts the effect relative to the cause. This is what sets the maximum steering cadence.",
  q:"How long between the action and its visible effect on the output?",
  abs:"You judge too early, stack corrections, and the mechanism starts oscillating instead of converging.",
  ok:"One delay per step, in time units, measured rather than assumed."},
 {id:15,f:"control",name:"Sensors",sub:"what you measure",x:1150,y:560,w:175,h:76,
  fonc:"Makes a quantity observable, with an instrument, a latency and a noise level.",
  q:"What quantity, measured by what instrument, with what latency?",
  abs:"The mechanism is endured, not steered. You react to visible consequences, always late.",
  ok:"Every stock, output and leak has at least one named sensor."},
 {id:16,f:"control",name:"Gap",sub:"measured − target",x:760,y:560,w:188,h:76,
  fonc:"Compares measured against target. The only signal allowed to trigger an action.",
  q:"What value, over what window, with what trend?",
  abs:"You react to anecdote instead of signal, and every wobble becomes grounds for intervention.",
  ok:"A signed number, together with its observation window."},
 {id:17,f:"control",name:"Policy",sub:"decision rule",x:380,y:560,w:188,h:76,
  fonc:"Converts a gap into action, following a rule decided in cold blood.",
  q:"What rule triggers what action, from what threshold?",
  abs:"Every gap triggers a different improvisation. No learning is possible between cycles.",
  ok:"A default action is written for every signal on the control table."},
 {id:18,f:"control",name:"Loops",sub:"B balances, R reinforces",x:380,y:668,w:250,h:62,
  fonc:"Closed paths in the mechanism. A B loop pulls back to target, an R loop amplifies the gap.",
  q:"Which closed loops exist, and which are balancing, which reinforcing?",
  abs:"You treat as linear a mechanism that feeds itself. Compound effects arrive unanticipated.",
  ok:"Every loop is drawn on the canvas and labelled B or R."},
 {id:19,f:"epistemic",name:"Evidence level",sub:"measured / estimated / assumed",x:170,y:828,w:290,h:62,
  fonc:"Qualifies how solid each value in the model is, and flags where the risk concentrates.",
  q:"Is this value measured, estimated or assumed, and on what sample?",
  abs:"An assumption acquires the status of fact. The model looks solid while resting on hunches.",
  ok:"Every simulation variable carries an evidence tag."},
 {id:20,f:"epistemic",name:"Structural assumptions",sub:"links held to be true",x:490,y:828,w:330,h:62,
  fonc:"Lists the causal links accepted without testing, and the observation that would invalidate them.",
  q:"Which causal links do you take for granted without having tested them?",
  abs:"When the model fails, you do not know what to fix: the structure or the parameters.",
  ok:"Each assumption has a decisive test written next to it."},
 {id:21,f:"epistemic",name:"Excluded scope",sub:"what you refuse to model",x:850,y:828,w:290,h:62,
  fonc:"Explicitly records what was left out of the model, and why.",
  q:"What did you deliberately leave out, and under what condition should it come back?",
  abs:"Surprises arrive with no known origin. Every anomaly restarts an investigation from scratch.",
  ok:"The list exists and gets re-read before any counter-intuitive conclusion."}
];

const PROPS_T = [
 ["Horizon and cadence","A parameter is only « frozen » relative to a duration.","absorbed","Organ 17 — cadence is already one of the policy's three settings, and the horizon is the objective's."],
 ["Binary success criterion","The threshold that turns an objective into a test.","absorbed","Organ 02 — the acceptable minimum field does exactly this."],
 ["Resources consumed","Budget, time and attention burnt each cycle.","absorbed","The resources register — it is transverse, so it never belonged inside a mechanism."],
 ["Leaks and scrap","Drop-offs, churn, dead leads, content never shipped.","absorbed","Organ 10 — induced outputs, and the conservation gate makes them impossible to skip."],
 ["Capacity and bottleneck","The maximum rate of each step.","absorbed","Organ 04 — the throughput nature, with its degradation threshold."],
 ["Non-linearities","Thresholds, saturations, diminishing returns.","absorbed","Organ 13 — the non-linear flag, and a gate that fails when none is declared."],
 ["Actuator","What actually executes the decision, with its own reliability and delay. A policy with no actuator changes nothing.","open","Genuinely missing. The owner says who may decide; nothing says what carries it out, or how long that takes."],
 ["Measurement latency","Data age, noise, sensor bias.","absorbed","Organ 15 — all three are now mandatory fields of a sensor."],
 ["Known failure modes","The ways this mechanism breaks, with the leading signal for each.","open","Nothing holds it. It would make monitoring predictive rather than reactive."],
 ["Decisive test","What observation would invalidate a structural assumption.","absorbed","Organ 20 — the test field next to each assumption."]
];




/* ================== DECISION BACKLOG ================== */
const DEC_TPL = {
 surpilot:["At what cadence do we steer this mechanism?",
   ["Stretch the cadence to the total delay","Shorten the delay by cutting sensor latency"]],
 bandemorte:["What dead band do we accept before acting?",
   ["Widen the dead band above the sensor noise","Reduce the noise at the sensor"]],
 conserv:["Where do the missing units actually go?",
   ["Add the missing stock","Add the missing output","Redraw the boundary"]],
 horloge:["Do we split this mechanism by clock speed?",
   ["Split into two mechanisms","Keep one and accept over-steering on the fast half"]],
 satur:["How do we relieve the saturated constraint?",
   ["Cut the load upstream","Raise the limit","Accept the degradation and stop chasing volume"]],
 autonomie:["How do we extend the runway?",
   ["Cut the per-period draw","Add to the stock","Accept and set a hard stop date"]],
 marge:["What do we do before the threshold blocks flat?",
   ["Reduce the load","Raise the quota","Add a second channel"]],
 presence:["How do we cover the single point of failure?",
   ["Train a second person","Shorten the replacement time","Accept the exposure, in writing"]],
 nonlin:["Where is the threshold in this mechanism?",
   ["Look at the extremes of the range","Accept a linear model and stop simulating"]],
 preuve:["Do we measure this constraint or keep assuming it?",
   ["Measure it against history","Keep the assumption and mark it as such"]],
 aveugle:["Can we detect anything at this window and this noise?",
   ["Widen the aggregation window","Reduce the sensor noise","Stop testing effects this small"]],
 revele:["What does this mechanism really optimise?",
   ["Run the sacrifice test on the last pressure spike","Declare alignment in writing"]],
 acteur:["Who really holds this lever?",
   ["Give real authority to the named owner","Move the lever down into constraints"]]
};
const aujourdhui = () => new Date().toISOString().slice(0,10);
const jours = (a,b) => (a&&b) ? Math.round((new Date(b)-new Date(a))/86400000) : null;

const STATUTS = ["open","deciding","testing","closed"];
const VERDICTS = ["validated","invalidated","inconclusive"];

function fluxDecisions(D,limite){
  const enCours = D.filter(d=>d.statut==="testing").length;
  const ouvertes = D.filter(d=>d.statut==="open"||d.statut==="deciding").length;
  const closes = D.filter(d=>d.statut==="closed");
  const durees = closes.map(d=>jours(d.ouvert,d.ferme)).filter(x=>x!=null&&x>=0);
  const cycle = durees.length ? (durees.reduce((a,b)=>a+b,0)/durees.length) : null;
  const inc = closes.filter(d=>d.verdict==="inconclusive").length;
  const debit = (cycle&&enCours) ? (enCours/(cycle/7)) : null;
  return {enCours,ouvertes,closes:closes.length,
    cycle: cycle!=null?cycle.toFixed(1):null,
    debit: debit!=null?debit.toFixed(1):null,
    incRate: closes.length?Math.round(inc/closes.length*100):null,
    sature: enCours>limite};
}

function VueDecisions({systemes,decisions,maj,limite,setLimite,onOuvrirMec}){
  const [aide,setAide]=useState(false);
  const F=fluxDecisions(decisions,limite);
  const dispo=[];
  systemes.forEach(s=>{
    calcNotifs(s.modele).filter(n=>n.cat==="friction").forEach(n=>{
      const cle=s.id+"|"+n.id;
      if(!decisions.some(d=>d.cle===cle)) dispo.push({cle,sys:s,n});});});

  const importer=()=>{
    const neuves=dispo.map(({cle,sys,n})=>{
      const base=n.id.replace("f-","");
      const tpl=DEC_TPL[base]||[n.titre+" — what do we do?",["Act on the organ","Accept and document"]];
      return {id:uid(),cle,sysId:sys.id,sysNom:sys.nom,friction:n.titre,calc:n.calc,
        organes:n.org.join(" · "),loi:!!n.loi,
        question:tpl[0],options:tpl[1].map(o=>({label:o,cout:"",qui:""})),
        caller:obj(sys.modele,"05").nom||"",
        revers:"",statut:"open",prior:"",post:"",verdict:"",
        ouvert:aujourdhui(),ferme:""};});
    maj.addMany(neuves);
  };

  const M2=[["open",F.ouvertes],["in test",F.enCours],["closed",F.closes]];

  return (
  <div className="sy-scroll">
    <div className="sy-head hd">
      <div>
        <h2>Decision backlog</h2>
        <p>Every friction points at an organ. A decision names what is blocked, what the options cost, and who is allowed to call it. This is where diagnosis becomes action.</p>
      </div>
      <button className="sy-qm" onClick={()=>setAide(true)}>?</button>
    </div>

    {aSupprimer!==null && (()=>{
      const row=lignes[aSupprimer]||{};
      const titre=row[reg.cols[0].k]||"this entry";
      const rempli=reg.cols.filter(c=>String(row[c.k]??"").trim()!=="");
      return (
        <div className="sy-back" onClick={()=>setASupprimer(null)}>
          <div className="sy-modal sm2" onClick={e=>e.stopPropagation()}>
            <div className="mh" style={{background:"linear-gradient(135deg,var(--wine-800),var(--stop))"}}>
              <div><div className="mk">delete from {reg.nom}</div>
                <div className="mt">{titre}</div></div>
              <button className="pcl" onClick={()=>setASupprimer(null)}>×</button>
            </div>
            <div className="mb">
              <div className="mblk"><span className="rl">what you are removing</span>
                {rempli.length===0
                  ? <p>An empty row. Nothing is lost.</p>
                  : <div className="sy-delrows">
                      {rempli.map(c=>(
                        <div key={c.k}><span>{c.l}</span><b>{String(row[c.k])}</b></div>))}
                    </div>}
              </div>
              <div className="mblk"><span className="rl">before you do</span>
                <p>A register entry is the only place a shared object exists once. Deleting it does
                not remove the thing — it removes the only record that two mechanisms touch it, and
                any node pointing at it goes back to showing nothing.</p></div>
            </div>
            <div className="mf">
              <button className="sy-b sm" onClick={()=>setASupprimer(null)}>Keep it</button>
              <button className="sy-b sm danger"
                onClick={()=>{maj.del(reg.id,aSupprimer);setASupprimer(null);}}>Delete</button>
            </div>
          </div>
        </div>);})()}

    {aide && (
      <div className="sy-back" onClick={()=>setAide(false)}>
        <div className="sy-modal" onClick={e=>e.stopPropagation()}>
          <div className="mh"><div><div className="mk">tool</div>
            <div className="mt">Decision backlog</div></div>
            <button className="pcl" onClick={()=>setAide(false)}>×</button></div>
          <div className="mb">
            <div className="mblk"><span className="rl">why it exists</span>
              <p>The method's stated purpose is to clarify where the frictions are <em>in order to decide</em>. A friction alone stops one step short: it names an organ, not a call. This backlog closes that gap.</p></div>
            <div className="mblk"><span className="rl">the reversibility lane</span>
              <p>A change you can undo in a week and one that commits three months should not carry the same overhead. Reversible decisions skip the gates and ship; committing ones get the full treatment and a named caller. Without this split the method is either too heavy everywhere or too light everywhere.</p></div>
            <div className="mblk"><span className="rl">the flow layer</span>
              <p>Little's law: cycle time equals work in progress divided by throughput. Holding more decisions in test lengthens every cycle proportionally. The WIP limit is the only lever that shortens cycle time without changing anything else.</p></div>
            <div className="mblk"><span className="rl">confidence, not verdict</span>
              <p>A binary verdict throws information away. Two inconclusive tests can carry very different evidence. Recording the prior and the posterior turns a failed test into a partial answer, and lowers the confidence of every future iteration resting on the same mechanism.</p></div>
          </div>
          <div className="mf"><button className="sy-b p sm" onClick={()=>setAide(false)}>Got it</button></div>
        </div>
      </div>)}

    <div className="sy-panel">
      <div className="sy-ph"><span>flow layer</span><span className="bar"/>
        <span>the iteration system measured as a mechanism</span></div>
      <div className="sy-flux">
        {M2.map(([l,v])=>(
          <div key={l} className="sy-fx2"><div className="fv">{v}</div><div className="fl">{l}</div></div>))}
        <div className="sy-fx2" data-alert={F.sature?"1":"0"}>
          <div className="fv">{F.enCours} / {limite}</div>
          <div className="fl">work in progress
            <input type="number" value={limite} min="1" max="20"
              onChange={e=>setLimite(Math.max(1,+e.target.value||1))}/></div>
        </div>
        <div className="sy-fx2"><div className="fv">{F.cycle??"—"}</div>
          <div className="fl">avg cycle, days</div></div>
        <div className="sy-fx2"><div className="fv">{F.debit??"—"}</div>
          <div className="fl">throughput / week</div></div>
        <div className="sy-fx2" data-alert={F.incRate!=null&&F.incRate>30?"1":"0"}>
          <div className="fv">{F.incRate!=null?F.incRate+" %":"—"}</div>
          <div className="fl">inconclusive</div></div>
      </div>
      {F.sature && (
        <div className="sy-warn3"><b>Above the WIP limit.</b> By Little's law, cycle time equals
          work in progress divided by throughput: every extra decision held in test lengthens all
          the others proportionally. Close before opening.</div>)}
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>frictions not yet turned into decisions</span><span className="bar"/>
        <span>{dispo.length} available</span></div>
      <div className="sy-imp">
        {dispo.length===0
          ? <p className="sy-none" style={{padding:0}}>Every active friction across your mechanisms already has a decision. Nothing to import.</p>
          : <>
              <div className="sy-implist">
                {dispo.slice(0,6).map(({cle,sys,n})=>(
                  <div key={cle} className="sy-impr">
                    <span className="ms">{sys.nom}</span>
                    <span className="fr">{n.titre}</span>
                    {n.loi && <span className="lw">law</span>}
                  </div>))}
                {dispo.length>6 && <div className="sy-impr more">and {dispo.length-6} more</div>}
              </div>
              <button className="sy-b p" onClick={importer}>
                Create {dispo.length} decision{dispo.length>1?"s":""}</button>
            </>}
      </div>
    </div>

    {decisions.length===0 ? (
      <div className="sy-panel"><div className="sy-ph"><span>backlog</span><span className="bar"/>
        <span>empty</span></div>
        <div className="sy-regt"><div className="sy-regv">
          <b>No decisions yet.</b> Import the frictions above, or add one by hand. A decision that
          answers no detected friction is an idea, not a response to a problem.
        </div>
        <button className="sy-b" onClick={()=>maj.addMany([{id:uid(),cle:"manual-"+uid(),
          sysNom:"",friction:"",calc:"",organes:"",question:"",
          options:[{label:"",cout:"",qui:""}],caller:"",revers:"",statut:"open",
          prior:"",post:"",verdict:"",ouvert:aujourdhui(),ferme:""}])}>Add one by hand</button>
        </div>
      </div>
    ) : STATUTS.map(st=>{
      const l=decisions.filter(d=>d.statut===st);
      if(!l.length) return null;
      return (
        <div key={st}>
          <div className="sy-sec">{st} — {l.length}</div>
          {l.map(d=>(
            <div key={d.id} className="sy-dec" data-rev={d.revers}>
              <div className="dh">
                <div className="dsrc">
                  {d.sysNom && <span className="ms">{d.sysNom}</span>}
                  {d.friction && <span className="fr">{d.friction}</span>}
                  {d.loi && <span className="lw">law</span>}
                  {d.organes && <span className="og">{d.organes}</span>}
                </div>
                <button className="sy-x" aria-label="Delete this decision" onClick={()=>window.sklConfirm({title:"Delete this decision?",body:"It will be removed from the decision list. This cannot be undone.",ok:"Delete",onOk:()=>maj.del(d.id)})}>×</button>
              </div>

              <input className="dq" placeholder="What exactly is blocked?"
                value={d.question} onChange={e=>maj.set(d.id,"question",e.target.value)}/>
              {d.calc && <div className="dcalc">{d.calc}</div>}

              <div className="dopts">
                {(d.options||[]).map((o,i)=>(
                  <div key={i} className="dopt">
                    <span className="ol">{String.fromCharCode(65+i)}</span>
                    <input placeholder="option" value={o.label}
                      onChange={e=>maj.setOpt(d.id,i,"label",e.target.value)}/>
                    <input className="oc" placeholder="cost" value={o.cout}
                      onChange={e=>maj.setOpt(d.id,i,"cout",e.target.value)}/>
                    <input className="oc" placeholder="who" value={o.qui}
                      onChange={e=>maj.setOpt(d.id,i,"qui",e.target.value)}/>
                    <button className="sy-x" aria-label="Delete this option" onClick={()=>window.sklConfirm({title:"Delete this option?",body:"The option will be removed from the decision.",ok:"Delete",onOk:()=>maj.delOpt(d.id,i)})}>×</button>
                  </div>))}
                <button className="sy-b sm" onClick={()=>maj.addOpt(d.id)}>Add option</button>
              </div>

              <div className="dfoot">
                <label>caller
                  <input value={d.caller} placeholder="named person"
                    onChange={e=>maj.set(d.id,"caller",e.target.value)}/></label>
                <label>lane
                  <select value={d.revers} onChange={e=>maj.set(d.id,"revers",e.target.value)}>
                    <option value="">—</option>
                    <option value="light">reversible · light lane</option>
                    <option value="full">committing · full gates</option>
                  </select></label>
                <label>status
                  <select value={d.statut} onChange={e=>{
                    maj.set(d.id,"statut",e.target.value);
                    if(e.target.value==="closed"&&!d.ferme) maj.set(d.id,"ferme",aujourdhui());
                    if(e.target.value!=="closed") maj.set(d.id,"ferme","");}}>
                    {STATUTS.map(x=><option key={x}>{x}</option>)}</select></label>
                <label>prior
                  <input type="number" step="0.05" min="0" max="1" value={d.prior}
                    onChange={e=>maj.set(d.id,"prior",e.target.value)}/></label>
                <label>posterior
                  <input type="number" step="0.05" min="0" max="1" value={d.post}
                    onChange={e=>maj.set(d.id,"post",e.target.value)}/></label>
                <label>verdict
                  <select value={d.verdict} onChange={e=>maj.set(d.id,"verdict",e.target.value)}>
                    <option value="">—</option>
                    {VERDICTS.map(x=><option key={x}>{x}</option>)}</select></label>
                {d.prior!=="" && d.post!=="" && (
                  <span className="ddelta" data-up={+d.post>=+d.prior?"1":"0"}>
                    Δ {(+d.post-+d.prior>=0?"+":"")}{(+d.post-+d.prior).toFixed(2)}</span>)}
                {d.statut==="closed" && jours(d.ouvert,d.ferme)!=null && (
                  <span className="dcyc">{jours(d.ouvert,d.ferme)} d</span>)}
              </div>

              {d.revers==="light" && (
                <div className="dlane">Light lane — reversible under a week. Ship it, log the result,
                  skip the simulation and the full gates.</div>)}
              {d.revers==="full" && (
                <div className="dlane full">Full lane — committing. Power check, one lever, a test
                  at least as long as the turnover of the stock it crosses, named caller.</div>)}
            </div>))}
        </div>);})}
  </div>);
}

/* ================== MAP OF MECHANISMS ================== */
const LANES_T = [
 {id:"marketing", n:"Marketing",  c:"#0E6E7A", d:"Creates demand and the reason to believe."},
 {id:"sales",     n:"Sales",      c:"#5B3A9E", d:"Turns demand into a signed client, or a declared death."},
 {id:"delivery",  n:"Delivery",   c:"#14705A", d:"Keeps the promise, and produces the proof that feeds marketing."},
 {id:"product",   n:"Product",    c:"#B0572E", d:"Turns what delivery and support learn into what is sold next."},
 {id:"finance",   n:"Finance",    c:"#9A6410", d:"Collects, holds and reads the money. Mostly stocks, read in runway."},
 {id:"people",    n:"People",     c:"#6B4A7A", d:"The slowest clock in the company. Months, not weeks."},
 {id:"ops",       n:"Operations", c:"#8A7872", d:"What every other domain runs on and nobody owns."}
];
const CATALOG = [
 {id:"content", nom:"Content production", lane:0,col:0,
  quoi:"Turns ideas, customer objections and proof into published assets and ad creatives.",
  pre:[]},
 {id:"paid",    nom:"Paid acquisition",   lane:0,col:1,
  quoi:"Buys attention. Its output quality is the input variance of everything downstream.",
  pre:["content"]},
 {id:"nurture", nom:"Nurture & email",    lane:0,col:2,
  quoi:"Holds an audience between the first touch and the moment they are ready. A stock that never fully empties.",
  pre:["paid"]},
 {id:"brand",   nom:"Brand & proof",      lane:0,col:3,
  quoi:"Testimonials, cases, reputation. A slow stock: it degrades fast and rebuilds slowly.",
  pre:["nurture"]},

 {id:"capture", nom:"Lead capture",       lane:1,col:0,
  quoi:"VSL, landing page, form, booking calendar. Where intent becomes an appointment.",
  pre:["paid"]},
 {id:"precall", nom:"Pre-call",           lane:1,col:1,
  quoi:"From booking to showing up. Latency between booking and slot is the dominant lever.",
  pre:["capture"]},
 {id:"sales",   nom:"Sales call",         lane:1,col:2,
  quoi:"From the call to a close or a declared death. Bounded by sales rep capacity.",
  pre:["precall","recruit"]},
 {id:"follow",  nom:"Long follow-up",     lane:1,col:3,
  quoi:"The slow branch. A stock with a long turnover — test durations must match it or they are contaminated.",
  pre:["sales"]},

 {id:"onboard", nom:"Client onboarding",  lane:2,col:0,
  quoi:"From signature to a client actually started. Absorbs whatever sales sends it.",
  pre:["sales"]},
 {id:"deliver", nom:"Delivery",           lane:2,col:1,
  quoi:"The promise being kept. Its induced output is the load it puts on support.",
  pre:["onboard"]},
 {id:"support", nom:"Support",            lane:2,col:2,
  quoi:"Also the best source of objections for content — an interface most companies never draw.",
  pre:["deliver"]},
 {id:"retain",  nom:"Retention",          lane:2,col:3,
  quoi:"Renewal and churn. The stock here is the client base itself.",
  pre:["deliver"]},

 {id:"discover",nom:"Discovery",          lane:3,col:0,
  quoi:"Turns what support and delivery hear into a shortlist of things worth building.",
  pre:["support"]},
 {id:"build",   nom:"Build",              lane:3,col:1,
  quoi:"Where the backlog is a stock and work in progress sets the cycle time.",
  pre:["discover"]},
 {id:"release", nom:"Release",            lane:3,col:2,
  quoi:"Getting it into clients' hands. Long delay between shipping and reading the effect.",
  pre:["build"]},

 {id:"billing", nom:"Billing",            lane:4,col:0,
  quoi:"From signature to money actually collected. Failed payments are a leak nobody counts.",
  pre:["sales"]},
 {id:"cash",    nom:"Cash & runway",      lane:4,col:1,
  quoi:"A depleting stock. Read in periods of runway, never in percentage used.",
  pre:["billing"]},
 {id:"unit",    nom:"Unit economics",     lane:4,col:2,
  quoi:"Cost to acquire against value delivered. The sensor that tells acquisition when to stop.",
  pre:["cash"]},

 {id:"recruit", nom:"Recruitment",        lane:5,col:0,
  quoi:"From application to hire. Six months before you know whether it worked.",
  pre:[]},
 {id:"ramp",    nom:"Training & ramp",    lane:5,col:1,
  quoi:"From hire to autonomous. A stock of people in transit, and it bounds capacity everywhere.",
  pre:["recruit"]},
 {id:"team",    nom:"Team retention",     lane:5,col:2,
  quoi:"The slowest signal in the company, and the most expensive one to read late.",
  pre:["ramp"]},

 {id:"tools",   nom:"Tooling & data",     lane:6,col:0,
  quoi:"Where every sensor in every other mechanism actually lives. Its latency is theirs.",
  pre:[]},
 {id:"admin",   nom:"Admin & legal",      lane:6,col:1,
  quoi:"Mostly thresholds rather than throughputs: nothing degrades, then something blocks flat.",
  pre:["tools"]}
];

const LANEH=104, MNW=170, MNH=76, MAPW=970;
const MAPH=44+LANES_T.length*LANEH+30;
const laneY = r => 44+r*LANEH;
const nodeX = c => 170+c*200;
const mnode = k => CATALOG.find(x=>x.id===k);
const mpos = c => ({x:nodeX(c.col), y:laneY(c.lane)+14, cx:nodeX(c.col)+MNW/2, cy:laneY(c.lane)+52});

const EDGES_M = (()=>{ const E=[];
 CATALOG.forEach(c=>c.pre.forEach(p=>{const a=mnode(p); if(!a) return;
  const pa=mpos(a), pb=mpos(c);
  if(a.lane===c.lane) E.push({a:p,b:c.id,k:"seq",
    d:`M${pa.x+MNW} ${pa.cy} H${pb.x-4}`});
  else if(Math.abs(a.lane-c.lane)===1) E.push({a:p,b:c.id,k:"cross",
    d:`M${pa.cx} ${pa.y+MNH} V${laneY(Math.min(a.lane,c.lane))+LANEH} H${pb.cx} V${pb.y-4}`});
  else if(p==="recruit") E.push({a:p,b:c.id,k:"cross",
    d:`M${pa.x-2} ${pa.cy} H146 V140 H${pb.cx} V${pb.y-4}`});
  else E.push({a:p,b:c.id,k:"cross",
    d:`M${pa.x-2} ${pa.cy} H130 V${pb.cy} H${pb.x-4}`});
 }));
 E.push({a:"deliver",b:"brand",k:"loop",
   d:`M${mpos(mnode("deliver")).x+MNW+2} ${mpos(mnode("deliver")).cy} H952 V${mpos(mnode("brand")).cy} H${mpos(mnode("brand")).x+MNW+4}`});
 E.push({a:"support",b:"content",k:"loop",
   d:`M${mpos(mnode("support")).x-2} ${mpos(mnode("support")).cy} H110 V${mpos(mnode("content")).cy} H${mpos(mnode("content")).x-4}`});
 return E; })();

const norml = x => (x||"").trim().toLowerCase();

function CarteMecanismes({systemes,decisions,onCreer,onOuvrir,onCycle}){
  const [sel,setSel]=useState(null);
  const trouve = c => systemes.find(s=>norml(s.nom)===norml(c.nom));
  const etat = c => {
    const s=trouve(c); if(!s) return {k:"unbuilt",s:null,n:0};
    const n=fonctionsCouvertes(s.modele);
    const actif=decisions.some(d=>d.sysId===s.id&&d.statut==="testing");
    return {k:actif?"active":(n>=6?"ready":"building"),s,n};
  };
  const hors=systemes.filter(s=>!CATALOG.some(c=>norml(c.nom)===norml(s.nom)));
  const built=CATALOG.filter(c=>etat(c).k!=="unbuilt").length;
  const ready=CATALOG.filter(c=>["ready","active"].includes(etat(c).k)).length;
  const runs=CATALOG.filter(c=>etat(c).k==="active").length;
  const domaines=LANES_T.filter(l=>CATALOG.some(c=>c.lane===LANES_T.indexOf(l)&&etat(c).k!=="unbuilt")).length;
  const C=sel?mnode(sel):null, E=C?etat(C):null;

  return (
  <div className="sy-schema">
    <div className="sy-bar">
      <div className="sy-bart">MAP OF MECHANISMS — THE DOMAINS THAT KEEP A COMPANY ALIVE, AND WHAT YOU HAVE MODELLED SO FAR</div>
      <div className="sy-mapstat">
        <div className="ms2"><div className="v">{built} / {CATALOG.length}</div><div className="l">modelled</div></div>
        <div className="ms2"><div className="v">{domaines} / {LANES_T.length}</div><div className="l">domains touched</div></div>
        <div className="ms2"><div className="v">{ready}</div><div className="l">ready for a cycle</div></div>
        <div className="ms2" data-on={runs?"1":"0"}><div className="v">{runs}</div><div className="l">cycles running</div></div>
        <div className="mleg">
          <span><i className="st-unbuilt"/>not modelled</span>
          <span><i className="st-building"/>a function unserved</span>
          <span><i className="st-ready"/>ready</span>
          <span><i className="st-active"/>cycle running</span>
          <span className="sep">│</span>
          <span><i className="ln-seq"/>within a domain</span>
          <span><i className="ln-cross"/>between domains</span>
          <span><i className="ln-loop"/>reinforcing loop</span>
        </div>
      </div>
    </div>

    <div className="sy-cv">
      <div className="sy-map" style={{width:MAPW,height:MAPH}} onClick={()=>setSel(null)}>
        {LANES_T.map((l,r)=>(
          <div key={l.id} className="sy-lane" style={{top:laneY(r),height:LANEH-8,width:MAPW-20,
            "--lc":l.c}}>
            <div className="ln2">{l.n}</div>
          </div>))}

        <svg style={{position:"absolute",inset:0,width:MAPW,height:MAPH,pointerEvents:"none"}}>
          <defs><marker id="mk" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#A69196"/></marker>
            <marker id="mkl" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#0E6E7A"/></marker></defs>
          {EDGES_M.map((e,i)=>{
            const on=etat(mnode(e.a)).k!=="unbuilt"&&etat(mnode(e.b)).k!=="unbuilt";
            const col=e.k==="loop"?"#0E6E7A":(e.k==="cross"?"#9A6410":"#8E7C81");
            return <path key={i} d={e.d} fill="none" stroke={on?col:"#D8CEC9"}
              strokeWidth={on?1.5:1.1}
              strokeDasharray={e.k==="seq"?(on?"":"5 4"):(e.k==="loop"?"7 5":"5 4")}
              opacity={on?(e.k==="seq"?1:.75):.8}
              markerEnd={e.k==="loop"?"url(#mkl)":"url(#mk)"}/>;})}
          <text x="530" y={MAPH-10} fontSize="10.5" fill="#8E7C81" fontFamily="var(--mono)"
            textAnchor="middle">delivery feeds proof, support feeds content — the two loops that make a company compound</text>
        </svg>

        {CATALOG.map(c=>{const p=mpos(c), e=etat(c), col=LANES_T[c.lane].c;
          return (
            <div key={c.id} className="sy-mn" data-st={e.k} data-sel={sel===c.id?"1":"0"}
              style={{left:p.x,top:p.y,width:MNW,height:MNH,"--dc":col}}
              onClick={ev=>{ev.stopPropagation();setSel(c.id);}}>
              <div className="mt2">{c.nom}</div>
              {e.k==="unbuilt"
                ? <div className="mst">not modelled</div>
                : <>
                    <div className="mbar"><i style={{width:(e.n/6*100)+"%"}}/></div>
                    <div className="mst">{e.k==="active"?"cycle running":`${e.n}/5 functions`}</div>
                  </>}
            </div>);})}
      </div>

      {hors.length>0 && (
        <div className="sy-hors">
          <div className="hl2">Outside the catalogue — mechanisms you created yourself</div>
          <div className="hlist">
            {hors.map(s=>{const n=fonctionsCouvertes(s.modele);
              return (
                <button key={s.id} className="sy-mn stand" data-st={n>=6?"ready":"building"}
                  style={{"--dc":"#8A7872"}} onClick={()=>onOuvrir(s.id)}>
                  <div className="mt2">{s.nom}</div>
                  <div className="mbar"><i style={{width:(n/6*100)+"%"}}/></div>
                  <div className="mst">{n}/5 functions</div>
                </button>);})}
          </div>
        </div>)}
    </div>

    {C && (
      <div className="sy-back" onClick={()=>setSel(null)}>
        <div className="sy-modal" onClick={e=>e.stopPropagation()}>
          <div className="mh" style={{background:`linear-gradient(135deg,var(--wine-800),${LANES_T[C.lane].c})`}}>
            <div><div className="mk">{LANES_T[C.lane].n.toLowerCase()}</div><div className="mt">{C.nom}</div></div>
            <button className="pcl" onClick={()=>setSel(null)}>×</button>
          </div>
          <div className="mb">
            <div className="mblk"><span className="rl">what it is</span><p>{C.quoi}</p></div>
            <div className="mblk"><span className="rl">its domain</span><p>{LANES_T[C.lane].d}</p></div>
            <div className="mblk"><span className="rl">upstream</span>
              <p>{C.pre.length
                ? C.pre.map(p=>mnode(p).nom+" ("+LANES_T[mnode(p).lane].n.toLowerCase()+")").join(" · ")
                : "Nothing. No prerequisite — it can be modelled first."}</p></div>
            <div className="mblk"><span className="rl">state</span>
              <p>{E.k==="unbuilt"
                ? "Not modelled. Nothing about it is known to the tool yet."
                : E.k==="building"
                  ? `Modelled, ${E.n} of 5 functions served. Below five, diagnosing produces noise: the rules have no inputs and the frictions they raise are artefacts of what is missing.`
                  : E.k==="ready"
                    ? "All five functions served. The rules have their inputs — a diagnose cycle can start."
                    : "A cycle is running: at least one decision is in test on this mechanism."}</p></div>
          </div>
          <div className="mf">
            {E.k==="unbuilt"
              ? <button className="sy-b p sm" onClick={()=>{onCreer(C.nom);setSel(null);}}>
                  Model this mechanism</button>
              : <>
                  <button className="sy-b sm" onClick={()=>{onOuvrir(E.s.id);setSel(null);}}>
                    Open the model</button>
                  <button className="sy-b p sm" disabled={E.k==="building"}
                    onClick={()=>{onCycle(E.s.id);setSel(null);}}>
                    {E.k==="building"?"A function unserved":"Start a diagnose cycle"}</button>
                </>}
          </div>
        </div>
      </div>)}
  </div>);
}

/* ================== ROLE OF REGISTERS ================== */
const REGZONE_T = [
 ["Inside a mechanism","Stocks, flows, levers, sensors. They belong to one mechanism and live in its organs.",
  "organs 06 to 18","No register. Duplication is impossible — there is only one owner."],
 ["Between mechanisms","Interfaces, when a flow passes from one to another. Resources, when several draw on the same pool without passing anything.",
  "interfaces · resources","Belongs to neither. Written inside each, it is entered twice and the copies diverge."],
 ["Above all mechanisms","Events, which break comparability everywhere at once. Owners, whose authority cuts across sheets.",
  "events · owners","Belongs to no mechanism at all. Only a shared list can hold it."]
];

const NOTREG_T = [
 ["A stock inside one mechanism","It lives between two flows of that mechanism. Organ 08, not a register.",
  "unless it is shared — cash, context base, audience — in which case position wins over dynamics and it moves to resources"],
 ["An invalidated assumption","It concerns one mechanism's structure. Organ 20 holds it.",
  "it is the only asset a failed test produces, but it is not transverse"],
 ["A metric definition","« Lead shown » means what exactly? It belongs to the sensor that produces it, organ 15.",
  "arguably the weakest call in this classification — two teams comparing numbers on different definitions never reconcile"]
];

function RoleRegisters(){
  const [bloc,setBloc]=useState(null);
  const R=bloc!=null?REGDET_T[bloc]:null;
  return (
  <div className="sy-scroll">
    <div className="sy-head">
      <h2>Registers</h2>
      <p>A mechanism holds what is inside it. A register holds what is between mechanisms, or above all of them. Four registers, and the reason they exist is blunt.</p>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what a register is</span><span className="bar"/><span>one sentence</span></div>
      <div className="sy-def">
        A register is a <em>single shared list</em> of what belongs to no mechanism in particular —
        because <em>what belongs to nobody is watched by nobody</em>, and described inside each
        sheet a shared object is entered twice and the two copies diverge.
      </div>
      <div className="sy-warn2">
        <b>The failure this prevents, in one example.</b> Your pre-call mechanism reports 61 leads
        leaving. Your sales mechanism declares 90 arriving. Twenty-nine units vanish between them,
        and neither sheet is wrong on its own — each is impeccable inside its own boundary. Nobody
        does the subtraction because there is nowhere the two numbers meet. In an interface
        register there is one number, and the discrepancy is impossible to miss.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>where an object lives</span><span className="bar"/>
        <span>position decides, not dynamics</span></div>
      <div className="sy-chaine">
        <svg viewBox="0 0 680 360" xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label="Two mechanisms side by side, an interface between them, an events band above and a shared resources and owners band below">
          <defs><marker id="ar3" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#A69196"/></marker></defs>

          <rect x="60" y="40" width="560" height="46" rx="10" fill="#9A6410" fillOpacity=".07"
            stroke="#9A6410" strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="6 4"/>
          <text className="nt" x="80" y="62">Events</text>
          <text className="ns" x="80" y="78">a date, and what it breaks — comparisons across it are void</text>

          {[[60,"Mechanism A"],[410,"Mechanism B"]].map(([x,t])=>(
            <g key={t}>
              <rect x={x} y="124" width="210" height="84" rx="11" fill="#FFFDFC"
                stroke="#0E6E7A" strokeOpacity=".5" strokeWidth="1.4"/>
              <rect x={x} y="124" width="210" height="84" rx="11" fill="#0E6E7A" fillOpacity=".11"/>
              <text className="nt" x={x+105} y="158" textAnchor="middle">{t}</text>
              <text className="ns" x={x+105} y="178" textAnchor="middle">stocks, flows, levers</text>
              <text className="ns" x={x+105} y="194" textAnchor="middle">live inside · organs 06–18</text>
            </g>))}

          <rect x="285" y="140" width="110" height="52" rx="10" fill="#9A6410" fillOpacity=".07"
            stroke="#9A6410" strokeOpacity=".6" strokeWidth="1.3" strokeDasharray="6 4"/>
          <text className="nt" x="340" y="162" textAnchor="middle">Interface</text>
          <text className="ns" x="340" y="180" textAnchor="middle">transits</text>

          <path d="M272 166 H281" fill="none" stroke="#A69196" strokeWidth="1.6" markerEnd="url(#ar3)"/>
          <path d="M397 166 H406" fill="none" stroke="#A69196" strokeWidth="1.6" markerEnd="url(#ar3)"/>
          <path d="M150 88 V120" fill="none" stroke="#9A6410" strokeWidth="1.5" opacity=".7" markerEnd="url(#ar3)"/>
          <path d="M530 88 V120" fill="none" stroke="#9A6410" strokeWidth="1.5" opacity=".7" markerEnd="url(#ar3)"/>

          <rect x="60" y="258" width="560" height="56" rx="10" fill="#9A6410" fillOpacity=".07"
            stroke="#9A6410" strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="6 4"/>
          <text className="nt" x="80" y="282">Resources and owners</text>
          <text className="ns" x="80" y="300">contended by several mechanisms, owned by none of them</text>
          <path d="M150 256 V212" fill="none" stroke="#9A6410" strokeWidth="1.5" opacity=".7" markerEnd="url(#ar3)"/>
          <path d="M530 256 V212" fill="none" stroke="#9A6410" strokeWidth="1.5" opacity=".7" markerEnd="url(#ar3)"/>
        </svg>
      </div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"20%"}}>Position</th><th style={{width:"42%"}}>What sits there</th>
          <th style={{width:"16%"}}>Held by</th><th style={{width:"22%"}}>Why</th></tr></thead>
        <tbody>{REGZONE_T.map(([p,w,h,y])=>(
          <tr key={p}><td>{p}</td><td>{w}</td><td className="m">{h}</td><td>{y}</td></tr>))}</tbody>
      </table></div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>the four registers</span><span className="bar"/>
        <span>click one for its detail</span></div>
      <div className="sy-regcards">
        {REGDET_T.map(([n,sub],i)=>(
          <div key={n} className="sy-regc" onClick={()=>setBloc(i)}>
            <div className="rn">{n}<span className="qmk">?</span></div>
            <div className="rs">{sub}</div>
          </div>))}
      </div>
    </div>

    {R && (
      <div className="sy-back" onClick={()=>setBloc(null)}>
        <div className="sy-modal" onClick={e=>e.stopPropagation()}>
          <div className="mh"><div><div className="mk">register</div><div className="mt">{R[0]}</div></div>
            <button className="pcl" onClick={()=>setBloc(null)}>×</button></div>
          <div className="mb">
            <div className="mblk"><span className="rl">what it holds</span><p>{R[2]}</p></div>
            <div className="mblk"><span className="rl">what it detects</span><p>{R[3]}</p></div>
            <div className="mblk"><span className="rl">filter it hands to iterations</span>
              <p className="fq">« {R[4]} »</p></div>
            <div className="mblk"><span className="rl">the point to remember</span><p>{R[5]}</p></div>
          </div>
          <div className="mf"><button className="sy-b p sm" onClick={()=>setBloc(null)}>Got it</button></div>
        </div>
      </div>)}

    <div className="sy-panel">
      <div className="sy-ph"><span>what is not a register</span><span className="bar"/>
        <span>three cases that look like one</span></div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"26%"}}>Case</th><th style={{width:"38%"}}>Where it belongs</th>
          <th style={{width:"36%"}}>Nuance</th></tr></thead>
        <tbody>{NOTREG_T.map(([c,w,n])=>(
          <tr key={c}><td>{c}</td><td>{w}</td><td>{n}</td></tr>))}</tbody>
      </table></div>
      <div className="sy-warn2">
        <b>The test is position, not dynamics.</b> A stock and a resource behave differently — one
        accumulates and circulates, the other bounds without circulating — but that is not what
        decides where they live. What decides is whether more than one mechanism touches it. A
        shared stock goes to the resources register and keeps its stock nature there, which is why
        that register carries the five natures rather than a single one.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>filling order</span><span className="bar"/>
        <span>create all four, fill them at different times</span></div>
      <ul className="rules">
        <li><b>Create all four before you model.</b> Not to fill them, but so shared objects have somewhere to land instead of being duplicated inside each sheet. A register that does not exist when you draw your first mechanism will never catch up.</li>
        <li><b>Events start today.</b> A date cannot be reconstructed afterwards, and a missing event ruins a conclusion months later — you will not know whether a mechanism was wrong or a test was polluted.</li>
        <li><b>Owners start today too.</b> Authority is a fact about your organisation that you already know without modelling anything.</li>
        <li><b>Resources fill from the second mechanism.</b> Populate them before and you list what you believe is scarce rather than what your mechanisms actually contend for.</li>
        <li><b>Interfaces fill from the third.</b> You cannot write one before two mechanisms touch — it is the only register that is strictly derived.</li>
      </ul>
      <div className="sy-warn2">
        <b>Two of the four blockers live here.</b> A saturated resource and a busy owner are the
        reasons not to iterate that no single mechanism can see. Which also means these two
        registers only start paying once three or four mechanisms are modelled — below that, the
        slow stock and the blind sensor carry the load alone.
      </div>
    </div>
  </div>);
}

/* ================== FAILURE MODES ================== */
const FAIL_T = [
 ["Modelling in percentages",
  "The model is a clean cascade of conversion rates. It looks complete, and it silently assumes the mechanism answers instantly.",
  "Nothing accumulates anywhere. Tests come back inconclusive for no visible reason, and improving one step never shows up at the output.",
  "A ratio is not a flow — it is the ratio of two flows. Modelling in ratios leaves nowhere to put a stock, so delays and loops become invisible.",
  "Conservation gate · organs 08 and 10",
  "Count in units and time, never in percentages. Then add up: what enters must equal what leaves plus what accumulates. The first sales model here failed that test by 28 units, and that is how the follow-up stock was found."],

 ["Building before framing",
  "An elegant, complete model that answers no question. Twenty-one organs filled and nothing to decide.",
  "You cannot say what would count as success, and every friction seems as important as every other.",
  "Starting from the mechanism models what is available. Starting from the gap models what matters — and the gap decides which cut of reality is worth drawing.",
  "Organ 16 · the gap",
  "Write the three terms before anything else: observed value, target, date. If you cannot, you have a concern rather than a problem, and no modelling will fix that."],

 ["Treating a chain as a system",
  "Either you over-model something linear, or you are surprised by something that loops.",
  "Over-modelled: twenty-one organs on a mechanism where gains simply add up. Under-modelled: a gain that eats itself, or a problem that returns despite every correction.",
  "The only difference is whether an effect comes back onto its own cause. Everything else — depth of modelling, what can surprise you — follows from that one property.",
  "Closure gate · organ 18",
  "Follow one effect all the way through. If it returns to its cause, it is a system and the full set earns its keep. If it never returns, the five functions are quickly served."],

 ["Steering faster than the delay",
  "The mechanism oscillates. Direction changes every two weeks, and each change looks perfectly justified at the time.",
  "Corrections stack: the second one leaves before the first has produced its effect, so you amplify what you meant to damp.",
  "Cadence must exceed total delay — process, plus stock turnover, plus sensor latency. The third term is the one everyone forgets.",
  "Cadence law · organs 14 and 17",
  "Add the three terms and compare to your decision cadence. On the sales mechanism here that comparison read 1 day against 7 — daily steering on a weekly system."],

 ["Reacting to sensor noise",
  "Every wobble triggers a discussion. Effects never replicate, and two people read the same number in opposite directions.",
  "Conclusions that reverse from one week to the next, and a growing sense that the mechanism is unpredictable.",
  "Noise lives in the measurement, not in the world. Below the noise floor a gap means nothing, whatever its apparent size.",
  "Dead band law · organ 15",
  "Measure the noise over a period with no intervention, then set the dead band above it. If your intended effect is smaller than the noise, no test at that window can detect it — widen the window or stop."],

 ["Extending instead of redrawing",
  "The library grows. Sheets stop being maintained, stocks appear twice under different names, and nobody knows why a given mechanism exists.",
  "Mechanisms created because a lever you needed happened to sit outside a boundary.",
  "That is a modelling error dressed as growth. A genuine split only happens when the clock test forces it: two halves whose turnovers differ by more than a factor of five.",
  "Organ 01 · the clock test",
  "Before creating anything, ask whether redrawing the existing boundary would do. Record the reason either way — split, or redrawn — because nothing else explains why a mechanism is there."],

 ["Naturalising a choice",
  "An arbitrage becomes indiscussable. « That is just how it is » attaches to something somebody decided, once, for a reason nobody remembers.",
  "The same argument reopens every quarter and is rebuilt from scratch each time, because there is nothing written to point at.",
  "Six of the twenty-one organs are choices, not facts. Treating a choice as a fact removes it from discussion; treating a fact as a choice is magical thinking.",
  "Organ types · choice, fact, construct, annotation",
  "For every organ typed « fact », check it is not an old construct whose origin was forgotten. And for every frozen parameter, write the unfreezing condition — without it, it is a constraint in disguise."],

 ["The open loop",
  "Activity without learning. Tests run, results are discussed, and nothing in the model dates from last month.",
  "The same arguments return each quarter. Every cycle starts from the same level of ignorance, and the volume of iteration keeps rising while the quality of decisions does not.",
  "The write-back is the only step that closes the loop. Without it the apparatus is a queue of tasks, not an iteration system.",
  "The write-back · organs 19, 20 and the events register",
  "Write back whatever the verdict: a failed test still moves the prior. The three exits — amend the value, fix the structure, extend the base — are not optional endings, they are the mechanism by which the base improves."]
];

function ModesEchec(){
  const [sel,setSel]=useState(null);
  const F=sel!=null?FAIL_T[sel]:null;
  return (
  <div className="sy-scroll">
    <div className="sy-head">
      <h2>Failure modes</h2>
      <p>Eight ways this method breaks in practice, each with the symptom you would actually observe and the organ that catches it. Every one of them has happened at least once in building this tool.</p>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>the eight</span><span className="bar"/>
        <span>click one for the full account</span></div>
      <div className="sy-fails">
        {FAIL_T.map(([t,d,sym,,org],i)=>(
          <div key={t} className="sy-fail" onClick={()=>setSel(i)}>
            <div className="fh"><span className="fn">{String(i+1).padStart(2,"0")}</span>
              <span className="ft">{t}</span><span className="fq2">?</span></div>
            <p>{d}</p>
            <div className="fo">caught by — {org}</div>
          </div>))}
      </div>
      <div className="sy-warn2">
        <b>Seven of the eight are caught by a rule, not by insight.</b> That is the point of the
        gates and the two laws: they fire on a comparison, so they do not depend on anyone noticing.
        The exception is naturalising a choice — no rule detects it, only the discipline of
        re-reading what is typed « fact » and asking where it came from.
      </div>
    </div>

    {F && (
      <div className="sy-back" onClick={()=>setSel(null)}>
        <div className="sy-modal" onClick={e=>e.stopPropagation()}>
          <div className="mh"><div><div className="mk">failure mode {String(sel+1).padStart(2,"0")}</div>
            <div className="mt">{F[0]}</div></div>
            <button className="pcl" onClick={()=>setSel(null)}>×</button></div>
          <div className="mb">
            <div className="mblk"><span className="rl">what it looks like</span><p>{F[1]}</p></div>
            <div className="mblk"><span className="rl">the symptom you observe</span><p>{F[2]}</p></div>
            <div className="mblk"><span className="rl">why it happens</span><p>{F[3]}</p></div>
            <div className="mblk"><span className="rl">what catches it</span><p className="fq">{F[4]}</p></div>
            <div className="mblk"><span className="rl">what to do</span><p>{F[5]}</p></div>
          </div>
          <div className="mf"><button className="sy-b p sm" onClick={()=>setSel(null)}>Got it</button></div>
        </div>
      </div>)}

    <div className="sy-panel">
      <div className="sy-ph"><span>the dominant failure mode</span><span className="bar"/>
        <span>not on the list above</span></div>
      <div className="sy-def" style={{fontSize:"18px",padding:"22px 26px"}}>
        None of these eight is what usually kills a method. <em>Abandonment</em> is — a tool unused
        by the third month leaves nothing behind, and nobody ever lightens an overweight method,
        they drop it.
        <span style={{display:"block",marginTop:14,fontSize:"14.5px",fontWeight:400,
          lineHeight:1.65,color:"var(--ink-2)",letterSpacing:0}}>
          That is the whole justification for five served functions rather than twenty-one filled organs, and for
          the reversibility lane that lets small changes skip the gates. Every rule on these pages
          costs something each time it is applied. A rule that catches a rare failure but is paid
          on every iteration is a bad trade, and should be cut.
        </span>
      </div>
    </div>
  </div>);
}

/* ================== MANUAL — BUILD A MECHANISM ================== */
const UI = {
  rail:()=>(
    <svg viewBox="0 0 620 210" className="ui" role="img" aria-label="The organ rail, grouped by function">
      <rect x="0" y="0" width="190" height="210" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <text x="16" y="24" className="uk">THE FIVE FUNCTIONS</text>
      {[["01","Boundary",1],["16","Gap",1],["08","Stocks",1],["15","Sensors",0],
        ["17","Policy",0],["19","Evidence level",0]].map(([n,t,f],i)=>(
        <g key={n}>
          {i===1 && <rect x="0" y={36+i*27} width="190" height="26" fill="#F9EDEF"/>}
          {i===1 && <rect x="0" y={36+i*27} width="2" height="26" fill="#A81D3A"/>}
          <text x="14" y={53+i*27} className="un">{n}</text>
          <text x="34" y={53+i*27} className="ut" fontWeight={i===1?600:400}>{t}</text>
          <circle cx="172" cy={49+i*27} r="3.5" fill={f?"#0E6E7A":"#CFC2BB"}/>
        </g>))}
      <rect x="206" y="0" width="414" height="210" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <text x="224" y="30" className="uh">Gap</text>
      <text x="224" y="48" className="uk">ORGAN 16 · CONSTRUCT · CONTROL · INSIDE THE MODEL</text>
      <rect x="224" y="60" width="378" height="42" rx="6" fill="#FBEFF1" stroke="#A81D3A" strokeWidth="0" />
      <rect x="224" y="60" width="2.5" height="42" fill="#A81D3A"/>
      <text x="238" y="76" className="ut" fontWeight="600" fill="#8E1730">Control · it regulates.</text>
      <text x="238" y="92" className="us">The gap is the definition of the problem itself.</text>
      {[["Current measurement","68"],["Aggregation window (periods)","3"]].map(([l,v],i)=>(
        <g key={l}><text x="224" y={128+i*38} className="uk">{l.toUpperCase()}</text>
          <rect x="224" y={134+i*38} width="180" height="22" rx="5" fill="#FDFBF9" stroke="#E0D6D0"/>
          <text x="234" y={149+i*38} className="ut">{v}</text></g>))}
    </svg>),

  table:()=>(
    <svg viewBox="0 0 620 176" className="ui" role="img" aria-label="An organ filled in as a table">
      <rect x="0" y="0" width="620" height="176" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <text x="16" y="24" className="uh">Stocks</text>
      {["Stock","Level","Turnover (days)","Unit"].map((h,i)=>(
        <text key={h} x={16+[0,270,360,480][i]} y={48} className="uk">{h.toUpperCase()}</text>))}
      <line x1="16" y1="56" x2="604" y2="56" stroke="#CFC2BB"/>
      {[["Unconfirmed leads","11","2","leads"],
        ["Pending appointments","52","4","appointments"],
        ["Rescheduled appointments","14","9","appointments"]].map((r,i)=>(
        <g key={i}>
          {r.map((c,j)=>(
            <g key={j}>
              <rect x={12+[0,270,360,480][j]} y={66+i*32} width={[250,80,110,110][j]} height="22"
                rx="5" fill="#FDFBF9" stroke="#E0D6D0"/>
              <text x={20+[0,270,360,480][j]} y={81+i*32} className="ut">{c}</text>
            </g>))}
          <text x="596" y={82+i*32} className="ux">×</text>
        </g>))}
      <rect x="16" y="166" width="0" height="0"/>
    </svg>),

  graphe:()=>(
    <svg viewBox="0 0 620 200" className="ui" role="img" aria-label="The model graph drawn from the flows">
      <rect x="0" y="0" width="620" height="200" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <rect x="0" y="0" width="620" height="200" rx="8" fill="url(#dotui)"/>
      <defs><pattern id="dotui" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="#E7DCD7"/></pattern>
        <marker id="uma" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,.5 L7.5,4 L0,7.5z" fill="#9C8A84"/></marker></defs>
      {[[20,40,"Appointments","booked · 90/wk","#8A7872"],
        [190,40,"Unconfirmed","11 · 2 d","#7A2233"],
        [360,40,"Pending","52 · 4 d","#7A2233"],
        [190,124,"Rescheduled","14 · 9 d","#7A2233"],
        [500,40,"Showed up","61/wk","#8A7872"]].map(([x,y,t,s,c])=>(
        <g key={t}>
          <rect x={x} y={y} width="104" height="44" rx="7" fill={c+"18"} stroke={c+"88"} strokeWidth="1.2"/>
          <text x={x+10} y={y+19} className="ut" fontWeight="600">{t}</text>
          <text x={x+10} y={y+34} className="us">{s}</text>
        </g>))}
      {[[124,62,186],[294,62,356],[464,62,496]].map(([a,y,b])=>(
        <path key={a} d={`M${a} ${y} H${b}`} fill="none" stroke="#9C8A84" strokeWidth="1.6"
          markerEnd="url(#uma)"/>))}
      <path d="M394 84 V110 H296 V146 H298" fill="none" stroke="#9C8A84" strokeWidth="1.4"
        strokeDasharray="5 3" markerEnd="url(#uma)"/>
      <text x="252" y="106" className="us">reschedule loop</text>
    </svg>),

  pilot:()=>(
    <svg viewBox="0 0 620 186" className="ui" role="img" aria-label="The control screen: two laws then the ignorance map">
      <rect x="0" y="0" width="620" height="186" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <text x="16" y="22" className="uk">TWO LAWS — THEY ARE NOT NEGOTIATED, THEY ARE CHECKED</text>
      <rect x="16" y="32" width="588" height="44" rx="7" fill="#FBEFF1" stroke="#A81D3A" strokeOpacity=".35"/>
      <rect x="16" y="32" width="3" height="44" fill="#A81D3A"/>
      <text x="32" y="50" className="ut" fontWeight="600">Cadence law broken</text>
      <text x="32" y="67" className="us">cadence 1 d &lt; total delay 7 d — every correction leaves before the last one landed</text>
      <text x="16" y="100" className="uk">IGNORANCE MAP — MOST STRUCTURAL FIRST</text>
      {[["SHAPE","The steps are independent of one another","#5B3A9E"],
        ["BOUND","48-call threshold","#9A6410"],
        ["VALUE","Sharp drop beyond 5 days of latency","#8E7C81"]].map(([r,t,c],i)=>(
        <g key={t}>
          <rect x="16" y={110+i*24} width="54" height="16" rx="4" fill={c}/>
          <text x="43" y={121+i*24} className="ub">{r}</text>
          <text x="80" y={122+i*24} className="ut">{t}</text>
        </g>))}
    </svg>),

  registre:()=>(
    <svg viewBox="0 0 620 150" className="ui" role="img" aria-label="An interface register row">
      <rect x="0" y="0" width="620" height="150" rx="8" fill="#FDFBF9" stroke="#E0D6D0"/>
      <text x="16" y="24" className="uh">Interfaces</text>
      {["Interface point","Sender","Receiver","Volume","Per"].map((h,i)=>(
        <text key={h} x={16+[0,180,300,420,490][i]} y={48} className="uk">{h.toUpperCase()}</text>))}
      <line x1="16" y1="56" x2="604" y2="56" stroke="#CFC2BB"/>
      {[["Appointments booked","VSL & booking","Pre-call","90","week"],
        ["Showed up","Pre-call","Sales","61","week"]].map((r,i)=>(
        <g key={i}>{r.map((c,j)=>(
          <g key={j}>
            <rect x={12+[0,180,300,420,490][j]} y={66+i*32} width={[160,110,110,60,100][j]} height="22"
              rx="5" fill="#FDFBF9" stroke="#E0D6D0"/>
            <text x={20+[0,180,300,420,490][j]} y={81+i*32} className="ut">{c}</text>
          </g>))}</g>))}
      <text x="16" y="140" className="us">61 leaves Pre-call · Sales must read 61 here, not 90 from the VSL</text>
    </svg>)
};

const CHAPS = [
 {n:"01",t:"Open the four registers",s:"fifteen minutes, before you model anything",
  p:["Create the four registers first — not to fill them, but so that shared objects have somewhere to land. A register that does not exist when you draw your first sheet never catches up: the lines get written inside the mechanism and stay there.",
     "Two of the four fill in straight away, and neither needs a model. The other two would be guesswork today, so leave them empty on purpose."],
  ui:"registre",
  champs:[["Owners — fill it now","A fact about your organisation you already hold. Who may change what without asking anyone."],
          ["Events — start the log today","A date cannot be reconstructed afterwards. Start it and a missing event will not ruin a conclusion three months from now."],
          ["Resources — leave empty","Filled before modelling, you list what you believe is scarce rather than what your mechanisms actually contend for."],
          ["Interfaces — leave empty","Strictly derived. You cannot write one before two mechanisms touch."]],
  regle:"From here on, whenever you write something inside an organ that another mechanism would write identically, stop: that object belongs in a register, not in the sheet.",
  arret:"stop — the four exist, owners and events have their first lines",
  cas:{t:"Pre-call · opening the registers",l:[["Owners, filled in five minutes","One row: the pre-call lead, holding the reminder sequence, the message content, the maximum booking window and the confirmation script. Refusal test: yes."],["Three rows left as questions","Who owns CRM entry? Who opens the calendar slots? And you — none of the three appears in any sheet, which is precisely why they belong here."],["Events, seeded with one line","« Ad creative changed », flagged high severity and observable in the disturbances. Date left blank until it actually happens."]],n:"The two empty registers stayed empty. Listing resources here would have produced a guess."}},

 {n:"02",t:"Is this a mechanism?",s:"five minutes, before anything else",
  p:["Not everything deserves a sheet. A tool, a team, a project, a one-off event and a goal all fail the same test: none of them has an input and an output.",
     "The cheapest check there is — name what enters, name what leaves, say at what cadence it starts again. If you cannot do all three, stop here."],
  ui:null,
  champs:[["Does it repeat?","No → it is an event. Log it, do not model it."],
          ["Does it transform something?","No, it accumulates → a stock. No, it limits others → a resource."],
          ["Does an effect return onto its cause?","No → a chain. Yes → a system. Both are mechanisms; the answer only sets how deep to model."]],
  regle:"A mechanism is only worth formalising if its delay exceeds your patience. On something that answers in two hours, trial and error beats the model.",
  arret:"stop — you can name the result, its unit and its cadence",
  cas:{t:"Pre-call · does it qualify?",l:[["Does it repeat?","Every week, on a booking calendar. Yes."],["Does it transform something?","Appointments enter, shows and losses leave. Yes — it is not a stock, not a resource."],["Does an effect return onto its cause?","Yes: shows raise slot consumption, which raises booking latency, which lowers shows. A system, not a chain."]],n:"Result: a mechanism, and a system — so every one of the five functions will earn its organs."}},

 {n:"03",t:"Frame the gap",s:"organs 16 and 02",
  p:["The loop starts from what you want to close, never from an object you want to describe. Starting from the mechanism models what is available; starting from the gap models what matters.",
     "Three terms and nothing else: an observed value, a target, a date. Until all three are written you have a concern, not a problem — and nothing downstream can fire."],
  ui:"rail",
  champs:[["Declared objective","The metric, the target value, the unit, the acceptable minimum, the horizon."],
          ["Gap","The current measurement and the aggregation window. The gap computes itself."],
          ["Revealed objective","What was dropped first the last time pressure rose. Observed, never declared."]],
  regle:"While the declared and the revealed objective diverge, iterating on levers produces nothing. Name the divergence or write down that there is none.",
  arret:"stop — an observed value, a target, a date, and the sacrifice test answered",
  cas:{t:"Pre-call · the gap",l:[["Declared objective","Show rate, target 75 %, floor 65 %, horizon 60 days."],["Gap","Measured 68 %, aggregation window 3 periods. Gap: −7."],["Revealed objective","When booking volume drops, qualification friction at booking is loosened before the reminders are touched."]],n:"The two diverge: the mechanism optimises appointments booked, not leads present. Until that is closed, tuning reminders fights the structure."}},

 {n:"04",t:"Draw the boundary",s:"organ 01",
  p:["Write the events that open the mechanism and those that close it. Several of each is normal — a lead can leave because it closed or because it died, and those are two distinct ends.",
     "Draw the line around a complete loop, never around a team. A boundary that follows the org chart will not survive the next reorganisation."],
  ui:null,
  champs:[["Start event","« The lead books a slot in the calendar. » An event, not an object."],
          ["End events","Every way something leaves. Each one must map to an output later."],
          ["Clock test","If the slowest stock turns over more than five times slower than the fastest, you have two mechanisms."]],
  regle:"If no loop closes inside the boundary, the boundary is drawn too narrow — you are observing a cause without its return.",
  arret:"stop — you can name a borderline element and say which side it falls on, without hesitating",
  cas:{t:"Pre-call · the boundary",l:[["Start","The lead books a slot in the calendar."],["Ends","The lead shows up to the call. The lead is lost without ever showing."],["Clock test","Fastest stock 2 days, slowest 9 days. Ratio 4.5 — under five, so one mechanism holds."]],n:"The VSL sits outside: different owner, different clock. It is recorded in the excluded scope with its re-entry signal."}},

 {n:"05",t:"Trace the matter",s:"organs 10, 08, 09, 06 — in that order",
  p:["Outputs first. Always. Starting with inputs models what is available rather than what matters, and that single habit is what keeps stocks invisible.",
     "Then the stocks, each with a level and a turnover time. Then the flows, which name a source and a destination. Inputs come last, because by then you know what the mechanism actually needs."],
  ui:"table",
  champs:[["Outputs","Everything that leaves, including what nobody wanted. Mark the induced ones."],
          ["Stocks","Level and turnover. For turnover: if you cut all inflow now, how long until it empties?"],
          ["Flows","From, to, rate, per. Units per unit of time — never a percentage."],
          ["Inputs","Volume, variability, source. If it comes from another mechanism, name it."]],
  regle:"Then do the arithmetic: what enters equals what leaves plus what accumulates. If it does not balance, a stock or an output is missing.",
  arret:"stop — the conservation test balances, and the graph draws itself from the flows",
  cas:{t:"Pre-call · the matter",l:[["Outputs first","Showed up 61 → Sales. Cancelled 14, no-show 12, lost 3 → outside. Plus two induced: 255 min/wk of setting workload, 4 irritated leads."],["Stocks","Unconfirmed leads 11 · 2 d. Pending appointments 52 · 4 d. Rescheduled 14 · 9 d."],["Flows","Eight, including one return arc: rescheduled feeds back into pending at 7/wk."],["Inputs","90 appointments booked per week, ±22 depending on the live creative, 88 % valid numbers."]],n:"Conservation: 90 in, 61 + 14 + 12 + 3 = 90 out. It balances, so no stock is missing."}},

 {n:"06",t:"Open the machinery",s:"organs 13, 11, 12, 04, 05, 14",
  p:["A transformation rule states a relation, never a result. « Close rate drops beyond 48 calls a week » — not « close rate is 24 % ». Flag the non-linear ones: a model with no threshold only returns what you put in.",
     "Then split what you can move from what you cannot. A lever is adjustable now, by a named person, without outside approval. Anything else is a frozen parameter or a constraint."],
  ui:"graphe",
  champs:[["Transformation rules","The relation, which flow it governs, whether it is non-linear."],
          ["Levers","A setting, never an improvement. Five at most. Each points at a rule."],
          ["Frozen parameters","The reason for freezing, and an observable unfreezing condition."],
          ["Constraints","Pick the nature first — it decides how the alert reads."],
          ["Delays","Process delay plus stock turnover plus sensor latency. The third is always forgotten."]],
  regle:"If a limit lifts through an internal decision — paying, hiring, buying — it is not a constraint but a frozen parameter. And if a constraint is one another mechanism also consumes, this is where it leaves the sheet for the resources register.",
  arret:"stop — every lever has a named owner who can hold a refusal",
  cas:{t:"Pre-call · the machinery",l:[["Transformation rules","Six, four of them non-linear. « Show loses about 4 points per extra day of latency, with a sharp drop beyond 5 days. »"],["Levers","Five. Maximum booking delay, number and channel of reminders, active confirmation, personal video, one-click rescheduling."],["Frozen","No deposit at booking. Slots on a 10-day rolling window — unfreezes if median latency exceeds 5 days."],["Constraints","Calendar slots 90/100 · setting time 255/300 · SMS quota 320/500 · SMS credit 3.4 periods · verified number, presence."]],n:"Four of the five constraints left for the resources register. The verified sending number stayed: Pre-call alone consumes it."}},

 {n:"07",t:"Close the loop",s:"organs 15, 16, 17",
  p:["These three do not exist in the real thing. You build them — which is why they are typed « construct ». A chain becomes a system at this step, not before.",
     "A sensor has three mandatory attributes: latency, noise, and who enters the data. If the person entering it is evaluated on it, write that down — the incentive is part of the sensor."],
  ui:null,
  champs:[["Sensors","What is measured, by what instrument, with what latency and what noise."],
          ["Gap","The signed gap and its window. Always read next to the sensor noise."],
          ["Policy","Cadence, dead band, one lever per cycle, and what happens when nothing moves."]],
  regle:"Two inequalities that do not negotiate: cadence above total delay, dead band above sensor noise. Break either and the mechanism oscillates however good the rest is.",
  arret:"stop — the two laws pass, and the inaction is written down",
  cas:{t:"Pre-call · closing the loop",l:[["Sensors","Calendar and CRM: 2-day latency, ±5 points of noise, attendance confirmed by the sales rep. SMS platform: no latency, ±3, no human entry."],["Gap","−7 points, read against ±5 of noise over 3 periods."],["Policy","Cadence 7 days, dead band ±6, one lever per cycle. Inaction written: nothing is touched while the gap stays inside the band."]],n:"Both laws pass: cadence 7 ≥ total delay 6, dead band 6 > noise 5. Narrowly — and that is worth knowing."}},

 {n:"08",t:"Qualify what you wrote",s:"organs 19 and 20",
  p:["Most of what you have just written is not measured. That is fine — what is not fine is forgetting which parts.",
     "Three levels only: measured, benchmark, hunch. No middle ground, because nuance is always used to dodge. Every value carries its date, and a six-month-old measurement has become a historical benchmark."],
  ui:null,
  champs:[["Evidence level","One line per value that matters. Level and date."],
          ["Structural assumptions","Written as falsifiable claims: « X does not depend on Y », with the test that would break it."]],
  regle:"A value error corrects itself through iteration. A shape error is confirmed at every cycle with growing confidence — which is why assumptions outrank values in the ignorance map.",
  arret:"stop — no value carries a structural conclusion while tagged as a hunch",
  cas:{t:"Pre-call · what is actually known",l:[["Measured","Weekly show rate and 4-day median latency, over 12 weeks."],["Benchmark","SMS beats email under 24 h. Personal video worth 6 to 9 points — industry, unverified here."],["Hunch","The sharp drop beyond 5 days of latency. The 70 % recovery through rescheduling."],["Assumptions","Four, each with its test. « Reminder effects add up rather than substitute » — factorial design: SMS × video × confirmation."]],n:"The dominant lever rests on a hunch. That alone decides which measurement is worth an hour."}},

 {n:"09",t:"Read it, then run one cycle",s:"the Control screen and the decision backlog",
  p:["The mechanism is ready once all five functions are served — at least one organ filled in each — and the two laws are checked. Not twenty-one organs. Below that, diagnosing produces noise: the rules have no inputs, so the frictions they raise are artefacts of what is missing.",
     "Open the Control screen. Laws first: a broken law makes every other reading unreliable. Then the ignorance map, ranked by what each unknown carries. Then the frictions."],
  ui:"pilot",
  champs:[["Diagnose","Two laws, ignorance map, frictions. No judgement involved — only comparison."],
          ["Decide","The blocked question, two options with their cost, the caller. Set the lane: reversible or committing."],
          ["Iterate","One lever, one window, a test at least as long as the turnover of the stock it crosses."],
          ["Write back","Amend a value, fix the structure, or extend the base. Whatever the verdict."]],
  regle:"An iteration whose result is not written back leaves nothing. The next cycle restarts from the same ignorance, and the same arguments come round again.",
  arret:"stop — the model holds something today that it did not hold last month",
  cas:{t:"Pre-call · the first reading",l:[["Laws","Both pass. Nothing invalidates the rest of the screen."],["Ignorance map","Shape first: « the steps are independent of one another », untested. Then the bounds, then the values."],["Frictions","Saturation on calendar slots at 90 % and setting time at 85 %, both past their alert."],["Decision","Blocked question: do we open more slots, or cut the booking window? Two options, one caller — the pre-call lead."]],n:"Any iteration raising booking volume is absorbed by those two constraints before it reaches the show rate. Eliminated before launch."}},

 {n:"10",t:"What came out of the sheet",s:"resources and interfaces, now that you have a model",
  p:["While filling the organs you wrote things a second mechanism would write too. Those are the ones that leave. Described inside each sheet a shared object is entered twice, the copies diverge, and neither sheet is wrong on its own.",
     "You cannot settle everything with one mechanism. A resource is by definition something several mechanisms draw on — so record the candidates with the question each one is waiting on, and let the next mechanism answer it."],
  ui:"registre",
  champs:[["Resources","Every constraint touched by more than one mechanism. With one modelled, mark each as a candidate and write the question."],
          ["Interfaces","Every output with a destination, and every input with a source. One line, one volume, one agreed definition."],
          ["What stays","A constraint only your mechanism consumes stays in the sheet. One name in the « mechanisms involved » column means it is internal."],
          ["Back-reference","Open any node of the model: the register entries naming it appear at the bottom of its popup."]],
  regle:"The agreed definition is the column most often left empty and the most useful one. « Showed up » — connected, or stayed five minutes? Two teams counting differently never reconcile.",
  arret:"stop — nothing left in the sheet would be written identically in another sheet",
  cas:{t:"Pre-call · what left the sheet",l:[["Resources — 5 candidates","Calendar slots, setting time, SMS quota, SMS credit, plus the founder's attention, which appears in no sheet at all."],["Interfaces — 4 lines","Appointments booked in at 90/wk. Showed up out at 61/wk to Sales. Plus the two induced outputs."],["Questions carried","« Does Sales book into the same calendar? » « Does any other sequence send from the same number? »"],["The trap set","Sales must read 61 from the interface, not 90 from the VSL. If it reads 90, the two boundaries overlap."]],n:"Thirteen nodes of the model now carry a register link. Seven carry none — three stocks, three outputs to outside, one internal constraint. That is correct."}}
];

const PHASES_M = [
 ["PREPARE","#8A7872",[0,1],"Nothing is modelled yet. You are deciding whether to model at all, and giving shared objects somewhere to land."],
 ["FRAME","#9A6410",[2,3],"What you want to close, and where you draw the line around it. These two choices decide everything measured afterwards."],
 ["BUILD","#0E6E7A",[4,5,6],"The mechanism itself: what circulates, what governs it, and the loop you graft on to make it steerable."],
 ["RUN","#5B3A9E",[7,8,9],"Qualify what you wrote, read the screen, run one cycle — and see what leaves the sheet."]
];
const ETAPES_M = [
 ["Open registers","4 registers exist"],
 ["Qualify","chain or system"],
 ["Frame the gap","organs 16, 02, 03"],
 ["Draw boundary","organs 01, 21"],
 ["Trace matter","organs 10, 08, 09, 06"],
 ["Open machinery","organs 13, 11, 12, 04"],
 ["Close the loop","organs 15, 16, 17"],
 ["Qualify values","organs 19, 20"],
 ["Read and run","one decision"],
 ["Extract","resources, interfaces"]
];

/* ---- the same ten boxes as the overview, shown at the top of every chapter ---- */
/* ---- the Pre-call sheet restricted to the organs each step has produced ---- */
const CAS_CTX = {
 quoi:"A francophone infobusiness. A paid-ad funnel sends people to a VSL, they book a call, and sales reps sell a high-ticket programme on that call.",
 pb:"Ninety appointments are booked every week. Sixty-one people actually show up. The other twenty-nine were paid for and never met anyone.",
 pq:"Nobody owns the gap. Acquisition is judged on appointments booked and hits its target. Sales is judged on close rate and hits its target too. The twenty-nine disappear between two teams that are each doing well.",
 val:"At an average deal of €4,000 and a 23 % close rate, those twenty-nine no-shows are roughly €27,000 of missed revenue a week — on traffic already paid for. Nothing upstream has to change.",
 but:"Take the show rate from 68 % to 75 % within sixty days, without raising the ad budget and without adding headcount."
};

const ET_POP = [
 ["Create the four registers before you model. Not to fill them — so that shared objects have somewhere to land instead of being written inside a sheet and staying there.",
  "Owners and events fill in today, without any model. Resources and interfaces would be guesswork: leave them empty."],
 ["Not everything deserves a sheet. A tool, a team, a project, an event and a goal all fail the same test — none of them has an input and an output.",
  "Then decide chain or system: does an effect return onto its own cause? The answer sets how deep to model, not whether to."],
 ["Start from what you want to close, never from an object you want to describe. Three terms: an observed value, a target, a date.",
  "And the sacrifice test — what was dropped first the last time pressure rose? That is the revealed objective, and it is often not the declared one."],
 ["Write the events that open the mechanism and those that close it. Several of each is normal.",
  "Draw the line around a complete loop, never around a team. A boundary that follows the org chart dies at the next reorganisation."],
 ["Outputs first, always. Starting with inputs models what is available rather than what matters, and that habit is what keeps stocks invisible.",
  "Then stocks with their turnover, then flows, then inputs. Finish with the arithmetic: in equals out plus what accumulates."],
 ["A rule states a relation, never a result. « Close rate drops beyond 48 calls a week », not « close rate is 24 % ».",
  "Then split what you can move from what you cannot: a lever is adjustable now, by a named person, without outside approval."],
 ["These three organs do not exist in the real thing — you build them. A chain becomes a system here, not before.",
  "Two inequalities that do not negotiate: cadence above total delay, dead band above sensor noise."],
 ["Most of what you just wrote is not measured. That is fine. What is not fine is forgetting which parts.",
  "Three levels only — measured, benchmark, hunch — each with its date. A six-month-old measurement has become a benchmark."],
 ["Laws first: a broken law makes every other reading unreliable. Then the ignorance map, then the frictions.",
  "Turn one friction into a decision, test one lever, and write the result back. An iteration not written back leaves nothing."],
 ["While filling the organs you wrote things a second mechanism would write too. Those are the ones that leave the sheet.",
  "With one mechanism you cannot settle everything — record the candidates with the question each one is waiting on."]
];

const ET_ORG = [
 [],                               /* 01 registers — nothing in the sheet */
 [],                               /* 02 qualify */
 ["02","16","03"],                 /* 03 frame the gap */
 ["01","21"],                      /* 04 boundary */
 ["10","08","09","06"],            /* 05 matter */
 ["13","11","12","04","05","14"],  /* 06 machinery */
 ["15","17"],                      /* 07 close the loop */
 ["19","20"],                      /* 08 qualify values */
 ["18","07"],                      /* 09 read and run */
 []                                /* 10 extract */
];
const modelePartiel = e => {
 const ids=new Set(); for(let k=0;k<=e;k++) ET_ORG[k].forEach(i=>ids.add(i));
 const src=normModele(PREAPPEL), out={};
 ORGANES.forEach(o=>{ out[o.id]= ids.has(o.id) ? src[o.id] : (o.liste?[]:{}); });
 return out;
};
const nouveauxOrg = e => ET_ORG[e]||[];

/* ---- the Pre-call model as it stands at each step of the build ---- */
const PG_BOX = [
 {s:5,x:20,y:82,w:128,t:"Appointments booked",u:"90 /wk",k:"m"},
 {s:5,x:178,y:82,w:128,t:"Unconfirmed leads",u:"11 · 2 d",k:"s"},
 {s:5,x:336,y:82,w:128,t:"Pending appts",u:"52 · 4 d",k:"s"},
 {s:5,x:336,y:166,w:128,t:"Rescheduled",u:"14 · 9 d",k:"s"},
 {s:5,x:612,y:82,w:150,t:"Showed up",u:"61 /wk → Sales",k:"m"},
 {s:5,x:612,y:166,w:150,t:"Lost · no-show",u:"29 /wk → outside",k:"m"},
 {s:6,x:178,y:256,w:128,t:"Transformation rules",u:"6 · 4 non-linear",k:"r"},
 {s:6,x:336,y:256,w:128,t:"Levers",u:"5 · 1 owner",k:"r"},
 {s:7,x:612,y:256,w:150,t:"Sensors",u:"±5 · 2 d latency",k:"c"},
 {s:7,x:450,y:330,w:128,t:"Gap",u:"−7 points",k:"c"},
 {s:7,x:272,y:330,w:128,t:"Policy",u:"7 d · band ±6",k:"c"}
];
const PG_ARR = [
 {s:5,d:"M150 108 H174"},{s:5,d:"M308 108 H332"},{s:5,d:"M466 108 H608"},
 {s:5,d:"M400 136 V162"},{s:5,d:"M466 192 H608",r:1},
 {s:6,d:"M242 254 V140",g:1},{s:6,d:"M334 278 H312",g:1},
 {s:7,d:"M687 136 V252",c:1},{s:7,d:"M687 310 V356 H582",c:1},
 {s:7,d:"M448 356 H404",c:1},{s:7,d:"M336 328 V302",c:1}
];
const PG_COL={m:"#8A7872",s:"#0E6E7A",r:"#5B3A9E",c:"#14705A"};

function SchemaProgressif({etape,M,titre,compact}){
  const e=etape+1;
  const Mp=useMemo(()=>M||modelePartiel(etape),[M,etape]);
  const neufs=new Set(nouveauxOrg(etape));
  const barre=ORGANES.filter(x=>x.zone==="barre");
  const nOrg=ORGANES.filter(x=>estRempli(x,Mp)).length;
  const attendus=(()=>{const a=new Set();for(let k=0;k<=etape;k++)(ET_ORG[k]||[]).forEach(i=>a.add(i));return a;})();
  const manquants=M?[...attendus].filter(id=>!estRempli(OM[id],Mp)):[];
  return (
    <div className={"sy-pg"+(compact?" cpt":"")}>
      <div className="pgw">
        <div className="pgbar">
          {!compact && (
            <div className="pgbt">{titre||"OUTSIDE THE MODEL"} — {nOrg} of 21 organs filled</div>)}
          <div className="pgdb" style={compact
            ? {gridTemplateColumns:`repeat(${barre.length},minmax(0,1fr))`} : undefined}>
            {barre.map(x=>{const k=kpi(x.id,Mp), n=neufs.has(x.id);
              return (
                <div key={x.id} className="pgdt" data-etat={k.etat} data-neuf={n?"1":"0"}
                  style={{"--fc":k.etat==="vide"?"var(--line-2)":couleurOrgane(x.id)}}>
                  <div className="dl">{x.id} · {x.nom.toUpperCase()}</div>
                  <div className={"dv"+(k.txt?" txt":"")}>{k.v}</div>
                  <div className="ds">{k.sub}</div>
                </div>);})}
          </div>
        </div>
        <div className="pgcv">
          <SchemaLecture M={Mp} neufs={neufs}/>
        </div>
      </div>
      <div className="pgl">
        <span><i style={{background:"var(--wine-500)"}}/>lit — what this step produced</span>
        <span><i style={{background:"var(--line-2)"}}/>dimmed — already there</span>
        {M
          ? <span>{manquants.length
              ? `still empty at this step — ${manquants.map(id=>OM[id].nom).join(", ")}`
              : "everything this step asks for is filled"}</span>
          : <span>{e<4?"the graph stays empty until the matter is traced, at step 05":
              `${nOrg} of 21 organs · the same two screens as the workshop`}</span>}
      </div>
    </div>);
}

function SchemaLecture({M,neufs}){
  const g=useMemo(()=>buildGraph(M),[M]);
  const L=useMemo(()=>layout(g),[g]);
  if(!g.nodes.length) return (
    <div className="pgvide">Nothing to draw yet — the graph is built from the flows,
      and they arrive at step 05.</div>);
  const {pos,W,H}=L;
  const traces=tracerGraphe(g,L);
  return (
    <div className="pgsvg" style={{width:W,height:H}}>
      <svg width={W} height={H}>
        {traces.map((t,i)=>{const st=STYLE_G[t.t]||STYLE_G.flux;
          return <path key={i} d={t.d} fill="none" stroke={st.c} strokeWidth={st.w}
            strokeDasharray={st.d||undefined} opacity=".55"/>;})}
      </svg>
      {g.nodes.map(n=>{const p=pos[n.id]; if(!p) return null;
        const K=KIND[n.kind], neuf=neufs.has(n.org);
        return (
          <div key={n.id} className="pgn" data-neuf={neuf?"1":"0"}
            style={{left:p.x,top:p.y,width:NW,height:NH,
              "--nc":n.kind==="ext"?"#A08E93":couleurOrgane(n.org)}}>
            <div className="pgnl">{n.label}</div>
            <div className="pgns">{n.sub}</div>
          </div>);})}
    </div>);
}

function FilEtapes({i,setChap,etat}){
  const [vu,setVu]=useState(null);
  const phaseDe=k=>PHASES_M.find(p=>p[2].includes(k));
  const ph=i<0
    ? ["OVERVIEW","#8E7C81",[],"Ten steps, four phases, one gate. Each step named by what it produces rather than by what you do."]
    : phaseDe(i);
  return (<>
    {vu!==null && (()=>{const p=phaseDe(vu), [t,sub]=ETAPES_M[vu];
      return (
      <div className="sy-back" onClick={()=>setVu(null)}>
        <div className="sy-modal sm2" onClick={e=>e.stopPropagation()}>
          <div className="mh" style={{background:p[1]}}>
            <div><div className="mk">{p[0]} · step {String(vu+1).padStart(2,"0")} of 10</div>
              <div className="mt">{t}</div></div>
            <button className="pcl" onClick={()=>setVu(null)}>×</button>
          </div>
          <div className="mb">
            <div className="mblk"><span className="rl">what this step is</span>
              {ET_POP[vu].map((x,k)=><p key={k}>{x}</p>)}</div>
            <div className="mblk"><span className="rl">what it produces</span>
              <p className="fq">{sub}</p></div>
          </div>
          <div className="mf">
            <button className="sy-b sm" onClick={()=>setVu(null)}>Close</button>
            {vu!==i && <button className="sy-b sm p"
              onClick={()=>{setVu(null);setChap&&setChap(vu);}}>Go to this step</button>}
          </div>
        </div>
      </div>);})()}
    <div className="sy-fil">
      <div className="fph" style={{"--pc":ph[1]}}>
        <span className="fpn">{ph[0]}</span>
        <span className="fpd">{ph[3]}</span>
      </div>
      <div className="fbx">
        {setChap && (
          <button data-on={i<0?"1":"0"} className="fov" style={{"--pc":"#8E7C81"}}
            onClick={()=>setChap(-1)} title="Overview">
            <span className="fn">00</span>
            <span className="ft">Overview</span>
            <span className="fs">the whole path</span>
          </button>)}
        {ETAPES_M.map(([t,s],k)=>{
          const c=phaseDe(k)[1], on=k===i;
          return (
            <button key={t} data-on={on?"1":"0"} data-ok={etat&&etat(k)?"1":"0"}
              style={{"--pc":c}} onClick={()=>setVu(k)} title={t}>
              <span className="fn">{String(k+1).padStart(2,"0")}</span>
              <span className="ft">{t}</span>
              {on && <span className="fs">{s}</span>}
            </button>);})}
      </div>
    </div>
  </>);
}

function VueApercu({setChap}){
  const corps=useRef(null);
  const X=i=>20+(i%5)*180, Y=i=>i<5?86:250;
  const phaseDe=i=>PHASES_M.find(p=>p[2].includes(i));
  return (
  <div className="sy-fixw">
    <div className="sy-fixh">
      <div className="fxl">
        <div className="sy-head"><h2>Building a mechanism</h2></div>
        <FilEtapes i={-1} setChap={setChap}/>
      </div>
    </div>
    <div className="sy-fixb" ref={corps}>

    <div className="sy-panel">
      <div className="sy-ph"><span>the whole path</span><span className="bar"/>
        <span>click a step to open its chapter</span></div>
      <div className="sy-chaine">
        <svg viewBox="0 0 920 372" xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label="Ten steps in two rows, grouped into four phases, with a readiness gate before step nine.">
          <defs><marker id="amo" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#A69196"/></marker></defs>

          {PHASES_M.map(([nom,col,idx])=>{
            const a=Math.min(...idx), b=Math.max(...idx);
            if(Y(a)!==Y(b)) return null;
            return (
              <g key={nom}>
                <rect x={X(a)-8} y={Y(a)-30} width={(b-a)*180+166} height={112} rx="12"
                  fill={col} fillOpacity=".05" stroke={col} strokeOpacity=".3"
                  strokeWidth="1.2" strokeDasharray="6 4"/>
                <text x={X(a)-2} y={Y(a)-14} className="ph2b" fill={col}>{nom}</text>
              </g>);})}
          <g>
            <rect x={X(6)-8} y={Y(6)-30} width={166} height={112} rx="12"
              fill="#0E6E7A" fillOpacity=".05" stroke="#0E6E7A" strokeOpacity=".3"
              strokeWidth="1.2" strokeDasharray="6 4"/>
            <text x={X(6)-2} y={Y(6)-14} className="ph2b" fill="#0E6E7A">BUILD</text>
          </g>

          {ETAPES_M.map(([t,s],i)=>{
            const col=phaseDe(i)[1];
            return (
              <g key={t} className="sy-stepg" onClick={()=>setChap(i)}>
                <rect x={X(i)} y={Y(i)} width="150" height="72" rx="10" fill="#FFFDFC"
                  stroke={col} strokeOpacity=".5" strokeWidth="1.4"/>
                <rect x={X(i)} y={Y(i)} width="150" height="72" rx="10" fill={col} fillOpacity=".08"/>
                <rect x={X(i)+12} y={Y(i)+12} width="26" height="19" rx="5" fill={col}/>
                <text x={X(i)+25} y={Y(i)+25.5} className="sn2">{String(i+1).padStart(2,"0")}</text>
                <text x={X(i)+12} y={Y(i)+49} className="nt">{t}</text>
                <text x={X(i)+12} y={Y(i)+64} className="ns">{s}</text>
              </g>);})}

          {[0,1,2,3,5,6,7,8].map(i=>(
            <path key={i} d={`M${X(i)+152} ${Y(i)+36} H${X(i)+178}`} fill="none"
              stroke="#A69196" strokeWidth="1.8" markerEnd="url(#amo)"/>))}
          <path d="M890 122 Q906 122 906 140 V196 Q906 214 890 214 H30 Q14 214 14 232 V250"
            fill="none" stroke="#A69196" strokeWidth="1.6" markerEnd="url(#amo)"/>

          <g>
            <rect x="562" y="238" width="16" height="96" rx="4" fill="#A81D3A" fillOpacity=".1"
              stroke="#A81D3A" strokeOpacity=".5" strokeWidth="1.2"/>
            <text x="570" y="352" className="ns" textAnchor="middle" fill="#8E1730">gate</text>
          </g>
          <text x="20" y="352" className="ns" fill="#8E1730">
            the gate — all five functions served and the two laws checked. Below it, diagnosing produces noise.</text>
        </svg>
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>the four phases</span><span className="bar"/>
        <span>what changes at each</span></div>
      <div className="sy-phases">
        {PHASES_M.map(([nom,col,idx,txt])=>(
          <div key={nom} className="sy-phl" style={{"--pc":col}}>
            <div className="ph3">{nom}<em>steps {idx.map(i=>String(i+1).padStart(2,"0")).join(" · ")}</em></div>
            <p>{txt}</p>
          </div>))}
      </div>
      <div className="sy-warn2">
        <b>The order is not a preference.</b> Outputs before inputs, stocks before flows, delays
        before the policy, evidence last. Each step needs what the one before it produced — and the
        most common failure is building before framing, which models what is available rather than
        what matters.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what you have at the end</span><span className="bar"/>
        <span>one mechanism, ready to turn</span></div>
      <ul className="rules">
        <li><b>A model that can be wrong in a locatable way.</b> Twenty-one organs across five functions, all five of which must be served — and an arithmetic check that says whether a stock is missing.</li>
        <li><b>Two laws checked.</b> Cadence above total delay, dead band above sensor noise. Neither negotiates.</li>
        <li><b>An ignorance map.</b> What you do not know, ranked by what it carries rather than by how much it bothers you.</li>
        <li><b>Register lines that outlive the sheet.</b> What is shared left the mechanism, so a second one will not have to guess it.</li>
        <li><b>One decision you could not otherwise have named.</b> That is the actual output. A model that produces none is documentation.</li>
      </ul>
    </div>

    <button className="sy-suite" onClick={()=>setChap(0)}>
      <span className="sk">start here</span>
      <span className="st">Step 01 · {CHAPS[0].t}</span>
      <span className="ss">{CHAPS[0].s}</span>
      <span className="sa">→</span>
    </button>
    </div>
  </div>);
}

function Manuel({chap,setChap}){
  const c=CHAPS[chap];
  const corps=useRef(null);
  useEffect(()=>{ if(corps.current) corps.current.scrollTop=0; },[chap]);
  return (
  <div className="sy-fixw">
    <div className="sy-fixh">
      <div className="fxl">
        <div className="sy-head">
          <h2>Step {c.n} · {c.t}</h2>
        </div>
        <FilEtapes i={chap} setChap={setChap}/>
      </div>
      <div className="fxr">
        <div className="fxrt">The model at this step</div>
        <SchemaProgressif etape={chap} compact/>
      </div>
    </div>
    <div className="sy-fixb" ref={corps}>

    <div className="sy-panel">
      <div className="sy-ph"><span>what you are doing</span><span className="bar"/>
        <span>chapter {c.n} of {String(CHAPS.length).padStart(2,"0")}</span></div>
      <div className="sy-manp">{c.p.map((x,i)=><p key={i}>{x}</p>)}</div>
      {c.ui && <div className="sy-shot">{UI[c.ui]()}</div>}
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what to fill in</span><span className="bar"/>
        <span>{c.champs.length} field{c.champs.length>1?"s":""}</span></div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"28%"}}>Field</th><th style={{width:"72%"}}>What goes in</th></tr></thead>
        <tbody>{c.champs.map(([a,b])=>(
          <tr key={a}><td>{a}</td><td>{b}</td></tr>))}</tbody>
      </table></div>
      <div className="sy-warn2"><b>The rule.</b> {c.regle}</div>
      <div className="sy-arret">{c.arret}</div>
    </div>

    {chap===0 && (
      <div className="sy-panel">
        <div className="sy-ph"><span>the case we are going to build</span><span className="bar"/>
          <span>read this once, it carries through all ten steps</span></div>
        <div className="sy-ctx">
          {[["The business",CAS_CTX.quoi],["What is going wrong",CAS_CTX.pb],
            ["Why it stays invisible",CAS_CTX.pq],["What it is worth",CAS_CTX.val]].map(([t,x])=>(
            <div key={t} className="ctl"><b>{t}</b><span>{x}</span></div>))}
        </div>
        <div className="sy-ctgoal">
          <span className="cg">the objective of the mechanism</span>
          <b>{CAS_CTX.but}</b>
        </div>
        <div className="sy-warn2">
          <b>Why model it rather than just fix it.</b> Every obvious fix has already been tried —
          more reminders, a shorter booking window, a deposit. Each helped for a fortnight and then
          faded, and nobody can say which one did what. That is the signal a mechanism is worth
          formalising: the delay between acting and seeing exceeds your patience, so trial and error
          stops teaching you anything.
        </div>
      </div>)}

    {c.cas && (
      <div className="sy-panel">
        <div className="sy-ph"><span>worked example — building Pre-call</span>
          <span className="bar"/>
          <span>step {String(chap+1).padStart(2,"0")} of {String(CHAPS.length).padStart(2,"0")} · {c.t.toLowerCase()}</span></div>
        <div className="sy-casintro">
          <span className="cm">Pre-call</span>
          {c.cas.t.replace(/^Pre-call · /,"")}
        </div>
        <div className="sy-cas">
          {c.cas.l.map(([a,b],i)=>(
            <div key={a} className="sy-casl">
              <span className="cp">part {i+1}</span>
              <div className="cc"><b>{a}</b><span>{b}</span></div>
            </div>))}
        </div>
        <div className="sy-casn">{c.cas.n}</div>
      </div>)}

    <div className="sy-navchap">
      <button className="sy-b" onClick={()=>setChap(chap-1)}>
        ← {chap>0?CHAPS[chap-1].t:"overview"}</button>
      <button className="sy-b p" disabled={chap===CHAPS.length-1} onClick={()=>setChap(chap+1)}>
        {chap<CHAPS.length-1?CHAPS[chap+1].t:"end"} →</button>
    </div>
    </div>
  </div>);
}

/* ================== THEORY VIEWS ================== */

const LOOPT_T = [
 ["Reads a base","The rules have no inputs without a model. Diagnosis runs on the organs, which is why the base has to exist before the loop can turn — and why a mechanism is only ready once all five of its functions are served.",
  "test — can you say which organ each friction points at?"],
 ["A decision someone can make","A friction names an organ. That is not yet a call. Until the blocked question, the options and the caller are written, diagnosis stops one step short of action.",
  "test — who is allowed to close this, and can they hold a refusal?"],
 ["One lever at a time","Two levers moved together make attribution impossible and the cycle is lost. The test lasts at least the turnover of the stock it crosses.",
  "test — how many levers moved in your last test?"],
 ["Maintains its own base","Every turn either confirms the base, corrects it, or extends it. Without the write-back the loop is open and each cycle restarts from the same ignorance.",
  "test — does last month's result appear anywhere in the model today?"]
];

const PRATIQUE_T = [
 ["Open the control screen","Two laws first: cadence against total delay, dead band against sensor noise. If either is broken, stop — every other reading is unreliable until it is fixed.",
  "2 minutes"],
 ["Read the ignorance map, not the friction list","It is ranked by what each unknown carries: an unserved function, then shape, then bound, then value. A shape assumption outranks a wrong number even though it is rarer.",
  "5 minutes"],
 ["Take the top item to the decision backlog","Write the blocked question, two or three options with their cost, and the caller. Then set the lane: reversible under a week, or committing.",
  "10 minutes"],
 ["Check the four blockers before launching","Slow stock, blind sensor, saturated resource, busy owner. Any one of them and the test cannot produce a usable answer — drop it and take the next item.",
  "2 minutes"],
 ["Run one lever, for at least the turnover of the stock it crosses","Write the verdict criterion before you start. Log any context change during the run — that log is what will separate a wrong mechanism from a polluted test.",
  "days to weeks"],
 ["Close it, whatever the verdict","Record the prior and the posterior. Then take one of the three exits: amend the value, fix the structure, or extend the base. An iteration closed without a write-back leaves nothing.",
  "10 minutes"]
];

const FLUX_T = [
 ["The flow layer","Work in progress, cycle time, throughput, inconclusive rate. Little's law: cycle time equals work in progress divided by throughput, so every extra decision held in test lengthens all the others proportionally. The WIP limit is the only lever that shortens cycle time without changing anything else."],
 ["The reversibility lane","A change you can undo in a week and one that commits three months should not carry the same overhead. Reversible ships and gets logged; committing goes through the full gates with a named caller. Without the split the method is too heavy everywhere, which is how method tools die by month three."],
 ["Confidence, not verdict","A binary verdict throws information away — two inconclusive tests can carry very different evidence. Recording the prior and the posterior turns a failed test into a partial answer, and lowers the confidence of every future iteration resting on the same mechanism."]
];

const DETAIL_T = {
mechanisms:["Mechanisms","the base",
 "What runs and produces a result: chains and systems. This is what everything else in the arrangement exists to make more efficient.",
 "Each mechanism is modelled with 21 organs, serving five functions. The loop reads them at diagnose and writes to them at write back — those are the only two points of contact.",
 "Not a foundation you pour once. If the write-back never touches it, the loop is open and every cycle restarts from the same level of ignorance.",
 ["A mechanism is ready for the loop once all five functions are served and the two laws are checked. Below that, diagnosing produces noise.",
  "One primary result per mechanism. Two competing results mean two mechanisms, or a trade-off nobody made.",
  "No two mechanisms produce the same thing. If they do, the boundary between them is badly drawn.",
  "A mechanism is only worth formalising if its delay exceeds your patience. What answers in two hours is steered by eye."]],

registers:["Registers","the base",
 "What belongs to no mechanism in particular. Four shared lists: interfaces, resources, events, owners.",
 "A register holds an object exactly once. Mechanisms populate them; the loop reads them at diagnose to check the two blockers that no single mechanism can see.",
 "Not a preamble. Create them before modelling so shared objects land in them, but their content comes from the mechanisms — populate resources first and you list what you believe is scarce rather than what your mechanisms contend for.",
 ["What belongs to nobody is watched by nobody. That is the whole reason a register exists.",
  "Events and owners start immediately: a date cannot be reconstructed, and authority is a fact you already know.",
  "Resources and interfaces fill themselves as mechanisms arrive. An interface cannot be written before two mechanisms touch.",
  "Position decides where an object lives, not its dynamics. A shared stock — cash, context base, audience — belongs in resources."]],

measure:["Measure","layer",
 "Make quantities observable, continuously. It sits under the base rather than inside the loop.",
 "Sensors read on their own cadence, independent of whether an iteration is running. Every value carries its evidence level and its date: measured, benchmark, hunch.",
 "Not a step of the loop. Making it one implies you measure once per cycle, which is exactly what the noise rule warns against — you need a series, not a reading.",
 ["Instrument the accumulations, not only the output. A swelling stock precedes the effect instead of recording it.",
  "Measure noise over a period without intervention, otherwise you measure your own corrections.",
  "Three readings minimum before trusting a trend.",
  "A value past its shelf life changes level: a six-month-old measurement is a historical benchmark."]],

diagnose:["Diagnose","step 01",
 "Turn the base into a finite list of named problems. The only step that runs entirely on structure — no judgement, only comparison.",
 "Two laws are checked first: cadence against total delay, dead band against sensor noise. Then the ignorance map ranks what you do not know by what it carries. Then eleven friction rules read the organs — conservation, clock mismatch, saturation, blind gap, runway, and the rest.",
 "Not a review meeting. Nothing here needs an opinion. If a rule requires judgement to fire, it is not a rule, it is a discussion.",
 ["Laws before heuristics. A broken law makes the reading of every other friction unreliable.",
  "A friction that points at no organ is not a friction.",
  "Rank by ignorance weighted by what it carries, never by expected gain.",
  "Diagnose across the whole base. Two of the four blockers are invisible from inside a single mechanism."]],

decide:["Decide","step 02",
 "Convert a friction into a call someone is allowed to make. This is where diagnosis becomes action.",
 "Each friction carries a blocked question, two or three options with their cost and their owner, and the caller taken from organ 05. The reversibility lane is set here: reversible under a week goes light, committing goes through the full gates.",
 "Not a prioritisation exercise. Ranking comes after elimination — a decision blocked by a saturated resource or a slow stock is removed before anything is scored.",
 ["No decision without a named caller. A decision everyone owns is one nobody makes.",
  "Two options minimum, and one of them is always « accept and document ».",
  "Eliminate before ranking. The four blockers are checked before any scoring.",
  "The lane is chosen before the test, never after seeing the result."]],

iterate:["Iterate","step 03",
 "Move one lever and read what happens, under conditions where the reading can mean something.",
 "One lever, one window, one measurement comparable to the one before. The test runs at least as long as the turnover of the stock it crosses. The decision criterion is written before it starts and applied unchanged afterwards.",
 "Not an experiment for its own sake. A test that cannot come back negative is not a test, it is a rollout with extra steps.",
 ["One lever per cycle. Two make attribution impossible and the cycle is wasted.",
  "Duration is set by the stock, never by patience.",
  "The criterion is written before the start and applied unchanged after.",
  "Log every context change during the run. That log separates a wrong mechanism from a polluted test."]],

writeback:["Write back","step 04",
 "The only step that closes the loop. It is what makes the whole thing compound rather than repeat.",
 "Three exits: amend a value, fix the structure, extend the base. Whatever the verdict, something is written — a failed test still moves the prior.",
 "Not documentation. Documentation records what happened; the write-back changes what the next diagnosis will read.",
 ["Write back whatever the verdict.",
  "Fixing structure invalidates every earlier diagnosis on that mechanism. Re-run them.",
  "Extend only when the clock test forces it. If the lever is merely outside the boundary, redraw the boundary instead.",
  "Any event during the run goes to the events register, with its date."]],

amend:["Amend values","exit 1",
 "The ordinary case, and the most frequent. A measured value replaces a hunch, a delay is finally known, a prior moves.",
 "The value and its date go into organ 19 of the mechanism concerned. Its evidence level changes: hunch becomes measured, or measured becomes a historical benchmark once past its shelf life.",
 "Not a correction of the model. The structure stands; only a number moved.",
 ["Nothing you concluded before becomes wrong. The next diagnosis simply reads better numbers.",
  "A value error is self-healing: measure again and it moves toward the truth.",
  "Always carry the date. A value without one cannot be aged out.",
  "Record the posterior even when the verdict is inconclusive."]],

fix:["Fix structure","exit 2",
 "The test revealed the model itself was wrong: a missing stock, a boundary drawn too narrow, an assumption of independence that fell.",
 "Correct the organ concerned — 01 for the boundary, 08 for a stock, 20 for an assumption — then re-run the diagnosis on that mechanism from scratch.",
 "Not an amendment. A shape error is a different animal from a value error and must not be treated as one.",
 ["Every earlier diagnosis on that mechanism becomes suspect. Frictions you dismissed may now fire.",
  "A shape error never self-corrects: each iteration refines the parameters of a wrong form and confirms it with growing confidence.",
  "This is why the ignorance map ranks shape above value, despite being far rarer.",
  "One structural fix outweighs fifty amendments."]],

extend:["Extend base","exit 3",
 "A mechanism that did not exist has to be created. The library grows from evidence rather than intention.",
 "Almost always because the clock test forced a split: two halves running at speeds differing by more than a factor of five, so one cadence cannot pilot both.",
 "Not the answer to a lever sitting outside the boundary. That calls for redrawing the boundary, not for a new mechanism.",
 ["Extend only when the clock test forces it. Otherwise redraw.",
  "Record why: split, or redrawn boundary. Nothing else explains why a mechanism exists.",
  "New interfaces appear and resources gain one more claimant. Update both registers.",
  "Multiplying mechanisms because a lever was out of reach is how a library stops being maintainable."]]
};

const REGDET_T = [
 ["Interfaces","the point where what leaves one mechanism enters another",
  "Interface point, sender or senders with their share, receiver or receivers, mode — duplication or split — rate, unit of time, and the agreed definition.",
  "Orphan leaks. If one mechanism reports 90 leaving and the next reports 61 arriving, twenty-nine units vanish between them — and neither sheet is wrong on its own.",
  "This iteration changes what the neighbour receives: warn them, and measure on the slower of the two clocks.",
  "It belongs to neither mechanism. Described inside each, it is entered twice and the two copies diverge. In the register it exists exactly once."],
 ["Resources","what several mechanisms compete for without passing it between them",
  "Name, nature among the five — throughput, threshold, depleting stock, stock threshold, presence — unit, capacity, load, alert threshold, and who draws on it.",
  "Contention. Two mechanisms slow down together with no visible internal cause, and nobody connects them because there is no arrow to follow.",
  "Do not iterate to raise volume here: the resource is saturated and the gain will be absorbed by the queue.",
  "Cross-cutting stocks live here too — cash, the context base, audience, reputation. Position decides where an object lives, not its dynamics."],
 ["Events","what breaks comparability",
  "Date, the event, what it breaks, and the mechanisms affected. Four columns, no modelling.",
  "Nothing, and that is deliberate. It produces an invalidation rather than a friction: measurements before and after are no longer comparable.",
  "Do not compare across this date.",
  "Anything that returns every year — seasonality, holidays — is not an event. It is an unmodelled input and belongs in organ 06."],
 ["Owners","who holds authority over which lever",
  "Person, role, the levers under their authority, the mechanisms involved, and whether they can hold a refusal.",
  "The real human constraint. It is usually the attention of two or three people, rather than budget or time, that bounds the whole.",
  "This iteration has no available owner, whatever its priority.",
  "Authority cuts across mechanisms. Duplicated inside each sheet, the concentration on one person stays invisible."]
];

function RoleIteration(){
  const [bloc,setBloc]=useState(null);
  const D=bloc?DETAIL_T[bloc]:null;
  const QM=({x,y})=>(
    <g className="qm">
      <circle cx={x} cy={y} r="8" fill="#FFFDFC" stroke="#8E7C81" strokeOpacity=".55" strokeWidth="1"/>
      <text x={x} y={y+3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="#8E7C81"
        fontFamily="var(--mono)">?</text>
    </g>);
  return (
  <div className="sy-scroll">
    <div className="sy-head">
      <h2>Iteration system</h2>
      <p>The base sits on top: mechanisms are what you are trying to make more efficient, and everything below exists to serve them. The loop reads the base, works left to right, and every result returns into it.</p>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what it is</span><span className="bar"/><span>one sentence, four steps</span></div>
      <div className="sy-def">
        An iteration system is a <em>closed loop</em> that reads a base of
        <em> mechanisms and registers</em>, turns each friction into
        <em> a decision someone can make</em>, tests <em>one lever at a time</em>, and writes
        every result back — <em>amending, correcting or extending the very base it reads</em>.
      </div>
      <div className="sy-chaine" style={{borderTop:"1px solid var(--line)"}}>
        <svg viewBox="0 0 680 462" xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label="The base sits on top: a mechanisms block holding the twenty-one organs across five functions, and a registers block holding interfaces, resources, events and owners. It feeds four steps below — diagnose, decide, iterate, write back — whose three exits return up the left side into the base. A measurement layer feeds the base continuously.">
          <defs><marker id="ar2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#A69196"/></marker></defs>

          <g className="sy-blk" onClick={()=>setBloc("mechanisms")}>
            <rect className="hl" x="60" y="40" width="350" height="124" rx="11" fill="#FFFDFC"
              stroke="#0E6E7A" strokeOpacity=".5" strokeWidth="1.4"/>
            <rect x="60" y="40" width="350" height="124" rx="11" fill="#0E6E7A" fillOpacity=".09"/>
            <text className="nt" x="78" y="64">Mechanisms</text>
            <text className="ns" x="176" y="64">chains and systems · 21 organs, 5 functions</text>
            {Array.from({length:21},(_,i)=>{
              const n=String(i+1).padStart(2,"0");
              const core=["01","06","11","15","19"].includes(n);
              const cx=76+(i%7)*47, cy=78+Math.floor(i/7)*25;
              return (
                <g key={n}>
                  <rect x={cx} y={cy} width="42" height="20" rx="6"
                    fill={core?"#0E6E7A":"#FFFDFC"} fillOpacity={core?".9":".75"}
                    stroke="#0E6E7A" strokeOpacity={core?"0":".35"} strokeWidth="1"/>
                  <text x={cx+21} y={cy+13.5} textAnchor="middle" fontSize="9.5"
                    fontFamily="var(--mono)" fontWeight={core?"600":"400"}
                    fill={core?"#FFFDFC":"#5D4A50"}>{n}</text>
                </g>);})}
            <QM x="393" y="57"/>
          </g>

          <g className="sy-blk" onClick={()=>setBloc("registers")}>
            <rect className="hl" x="430" y="40" width="202" height="124" rx="11" fill="#FFFDFC"
              stroke="#9A6410" strokeOpacity=".5" strokeWidth="1.4"/>
            <rect x="430" y="40" width="202" height="124" rx="11" fill="#9A6410" fillOpacity=".09"/>
            <text className="nt" x="448" y="64">Registers</text>
            {["Interfaces","Resources","Events","Owners"].map((r,i)=>(
              <g key={r}>
                <rect x="448" y={80+i*21} width="8" height="8" rx="2" fill="#9A6410" fillOpacity=".65"/>
                <text className="ns" x="464" y={88+i*21}>{r}</text>
              </g>))}
            <QM x="615" y="57"/>
          </g>

          <g className="sy-blk" onClick={()=>setBloc("measure")}>
            <rect className="hl" x="300" y="176" width="332" height="46" rx="10" fill="#FFFDFC"
              stroke="#8E7C81" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="6 4"/>
            <rect x="300" y="176" width="332" height="46" rx="10" fill="#8E7C81" fillOpacity=".07"/>
            <text className="nt" x="318" y="198">Measure</text>
            <text className="ns" x="318" y="214">sensors read continuously</text>
            <QM x="615" y="193"/>
          </g>
          <path d="M466 174 V166" fill="none" stroke="#8E7C81" strokeWidth="1.4" markerEnd="url(#ar2)"/>
          <path d="M124 166 V236" fill="none" stroke="#0E6E7A" strokeWidth="1.8" markerEnd="url(#ar2)"/>

          {[[60,"Diagnose","rules fire","diagnose"],[208,"Decide","one caller","decide"],
            [356,"Iterate","one lever","iterate"],[504,"Write back","three exits","writeback"]]
            .map(([x,t,st,k])=>(
            <g key={t} className="sy-blk" onClick={()=>setBloc(k)}>
              <rect className="hl" x={x} y="242" width="128" height="56" rx="10" fill="#FFFDFC"
                stroke="#5B3A9E" strokeOpacity=".45" strokeWidth="1.3"/>
              <rect x={x} y="242" width="128" height="56" rx="10" fill="#5B3A9E" fillOpacity=".09"/>
              <text className="nt" x={x+64} y="266" textAnchor="middle">{t}</text>
              <text className="ns" x={x+64} y="284" textAnchor="middle">{st}</text>
              <QM x={x+111} y="257"/>
            </g>))}
          {[190,338,486].map(a=>(
            <path key={a} d={`M${a} 270 H${a+14}`} fill="none" stroke="#A69196" strokeWidth="1.8"
              markerEnd="url(#ar2)"/>))}

          <path d="M568 300 V322 H198" fill="none" stroke="#A69196" strokeWidth="1.6"/>
          {[198,370,542].map(a=>(
            <path key={a} d={`M${a} 322 V338`} fill="none" stroke="#A69196" strokeWidth="1.6"
              markerEnd="url(#ar2)"/>))}

          {[[120,"Amend values","organ 19","amend"],[292,"Fix structure","stock, boundary","fix"],
            [464,"Extend base","new mechanism","extend"]].map(([x,t,st,k])=>(
            <g key={t} className="sy-blk" onClick={()=>setBloc(k)}>
              <rect className="hl" x={x} y="342" width="156" height="56" rx="10" fill="#FFFDFC"
                stroke="#5B3A9E" strokeOpacity=".38" strokeWidth="1.3" strokeDasharray="6 4"/>
              <text className="nt" x={x+78} y="366" textAnchor="middle">{t}</text>
              <text className="ns" x={x+78} y="384" textAnchor="middle">{st}</text>
              <QM x={x+139} y="357"/>
            </g>))}

          <path d="M198 398 V424 M370 398 V424" fill="none" stroke="#5B3A9E" strokeWidth="1.6" opacity=".7"/>
          <path d="M542 398 V424 H40 V72 H56" fill="none" stroke="#5B3A9E" strokeWidth="1.6"
            opacity=".7" markerEnd="url(#ar2)"/>
          <text className="ns" x="340" y="446" textAnchor="middle">every result returns to the base</text>
        </svg>
      </div>
      <div className="sy-hint">Click any block for its detail — role, how it works, what it is not, and the rules that apply. Chips are coloured by the function each organ serves.</div>

      {D && (
        <div className="sy-back" onClick={()=>setBloc(null)}>
          <div className="sy-modal" onClick={e=>e.stopPropagation()}>
            <div className="mh">
              <div><div className="mk">{D[1]}</div><div className="mt">{D[0]}</div></div>
              <button className="pcl" onClick={()=>setBloc(null)}>×</button>
            </div>
            <div className="mb">
              <div className="mblk"><span className="rl">its role</span><p>{D[2]}</p></div>
              <div className="mblk"><span className="rl">how it works</span><p>{D[3]}</p></div>
              <div className="mblk"><span className="rl">what it is not</span><p>{D[4]}</p></div>
              <div className="mblk"><span className="rl">rules to apply</span>
                <ol className="sy-stpr">{D[5].map((r,i)=><li key={i}>{r}</li>)}</ol></div>
            </div>
            <div className="mf"><button className="sy-b p sm" onClick={()=>setBloc(null)}>Got it</button></div>
          </div>
        </div>)}

      <div className="sy-warn2">
        <b>An open loop is not an iteration system.</b> Running tests without writing the results
        back produces activity, not learning: every cycle restarts from the same level of ignorance
        and the same arguments come round again. The write-back is what makes the loop reinforcing —
        richer base, better-founded hypotheses, fewer inconclusive tests, capacity freed, more
        iterations closed.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>one turn, in practice</span><span className="bar"/>
        <span>what a Monday morning looks like</span></div>
      <div className="steps">
        {PRATIQUE_T.map(([t,p,d])=>(
          <div key={t} className="step"><div><b>{t}</b><p>{p}</p>
            <span className="stop">{d}</span></div></div>))}
      </div>
      <div className="sy-warn2">
        <b>Everything before the run takes under half an hour.</b> The expensive part is the test
        itself, and its duration is set by the stock it crosses rather than by your patience. If a
        turn is taking longer than that on the desk work, the model is being rebuilt rather than
        read — which means it was not ready to enter the loop.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>where the gap comes from</span><span className="bar"/>
        <span>the loop has two entry points</span></div>
      <div className="sy-regi">
        <div className="sy-regb"><span className="rl">first pass</span>
          <p>You name it: an observed value, a target, a date. This is phase one of modelling, not a step of the loop — it happens once, when the mechanism is built.</p></div>
        <div className="sy-regb"><span className="rl">every pass after that</span>
          <p>The previous write-back hands it to you. A value moved, an assumption fell, a structure was corrected — and the next diagnosis reads a different base, raising frictions the last one could not.</p></div>
        <div className="sy-regb"><span className="rl">why it matters</span>
          <p className="fq">« Starting from the mechanism models what is available. Starting from the gap models what matters. »</p></div>
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what the loop measures about itself</span><span className="bar"/>
        <span>built into the decision backlog</span></div>
      <div className="sy-regi">
        {FLUX_T.map(([t,d])=>(
          <div key={t} className="sy-regb"><span className="rl">{t}</span><p>{d}</p></div>))}
      </div>
      <div className="sy-warn2">
        <b>The iteration system is itself a mechanism.</b> It has stocks — decisions open, in test,
        pending — a delay, and noise. It is the one thing in the company that would otherwise be
        exempt from its own method, which is why the backlog carries these numbers rather than a
        task list.
      </div>
    </div>

  </div>);
}

/* ================== THEORY VIEWS ================== */
/* ================== ROLE OF THE ITERATION SYSTEM ================== */

function RoleSysteme(){
  const BOX = ({x,y,lines,col})=>(
    <g>
      <rect x={x} y={y} width="140" height="52" rx="10" fill="#FFFDFC"
        stroke={col} strokeOpacity=".5" strokeWidth="1.3"/>
      <rect x={x} y={y} width="140" height="52" rx="10" fill={col} fillOpacity=".1"/>
      {lines.length===1
        ? <text className="nt" x={x+70} y={y+31} textAnchor="middle">{lines[0]}</text>
        : lines.map((l,i)=>(
            <text key={i} className="nt" x={x+70} y={y+23+i*16} textAnchor="middle">{l}</text>))}
    </g>);
  const MAT=[[20,["Inputs"]],[280,["Stocks"]],[540,["Outputs"]]];
  const matiere = k=>(<>
    {MAT.map(([x,l])=><BOX key={x} x={x} y={34} lines={l} col="#0E6E7A"/>)}
    {[[162,274,218],[422,534,478]].map(([a,b,c])=>(
      <g key={a}>
        <path d={`M${a} 60 H${b}`} fill="none" stroke="#9C8A84" strokeWidth="2"
          markerEnd={`url(#mf${k})`}/>
        <text className="ns" x={c} y={50} textAnchor="middle">flow</text>
      </g>))}
  </>);

  return (
  <div className="sy-scroll">
    <div className="sy-head">
      <h2>Mechanisms</h2>
      <p>A mechanism is a chain or a system. Same organs in both — what separates them is a single return path, and everything else follows from that.</p>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>definition</span><span className="bar"/><span>one sentence</span></div>
      <div className="sy-def">
        A mechanism is a <em>chain or a system</em> — a set of elements that
        <em> interact</em> to produce an <em>intended result</em>,
        <em> regularly enough</em> that it can be steered rather than rebuilt every time.
      </div>
      <div className="sy-terms">
        {TERMES_T.map(([t,d,c])=>(
          <div key={t} className="sy-trm"><b>{t}</b><p>{d}</p><span className="tc">{c}</span></div>))}
      </div>
      <div className="sy-warn2">
        <b>The mechanism is not the model.</b> The mechanism exists and runs whether you wrote it
        down or not: your sales mechanism is turning today with its sales reps and its CRM. The model
        is your representation of it, and it can be wrong. Conflating the two makes it impossible to
        say a model is mistaken, hence impossible to correct it.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>the two shapes, same organs</span><span className="bar"/>
        <span>same notation as the model graph</span></div>

      <div className="sy-shape">
        <div className="shl"><b>Chain</b> — matter goes one way and never comes back</div>
        <div className="sy-chaine">
          <svg viewBox="0 0 700 224" xmlns="http://www.w3.org/2000/svg" role="img"
            aria-label="A chain: inputs flow into stocks and out to outputs, with transformation rules governing the outflow from the side. No return path.">
            <defs>
              <marker id="mf1" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#9C8A84"/></marker>
              <marker id="mr1" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,.5 L7.5,4 L0,7.5z" fill="#B0572E"/></marker>
            </defs>
            {matiere(1)}
            <BOX x={380} y={130} lines={["Transformation","rules"]} col="#5B3A9E"/>
            <path d="M450 128 V68" fill="none" stroke="#B0572E" strokeWidth="1.6"
              strokeDasharray="2 4" markerEnd="url(#mr1)"/>
            <text className="ns" x="462" y="106" fill="#B0572E">governs the flow</text>
            <text className="ns" x="350" y="200" textAnchor="middle">behaviour is deducible from the parts</text>
            <text className="ns" x="350" y="216" textAnchor="middle">improve one step, the result moves proportionally</text>
          </svg>
        </div>
      </div>

      <div className="sy-shape">
        <div className="shl"><b>System</b> — one effect returns onto its own cause</div>
        <div className="sy-chaine">
          <svg viewBox="0 0 700 336" xmlns="http://www.w3.org/2000/svg" role="img"
            aria-label="A system: the same chain, plus sensors reading the outputs, a gap, a policy and levers acting back on the transformation rules — a closed balancing loop.">
            <defs>
              <marker id="mf2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,.5 L8.5,4.5 L0,8.5z" fill="#9C8A84"/></marker>
              <marker id="mr2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,.5 L7.5,4 L0,7.5z" fill="#B0572E"/></marker>
              <marker id="mm2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,.5 L7.5,4 L0,7.5z" fill="#9578A6"/></marker>
              <marker id="mc2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,.5 L7.5,4 L0,7.5z" fill="#C39B4E"/></marker>
            </defs>
            {matiere(2)}
            <BOX x={380} y={130} lines={["Transformation","rules"]} col="#5B3A9E"/>
            <BOX x={540} y={130} lines={["Sensors"]} col="#14705A"/>
            <path d="M450 128 V68" fill="none" stroke="#B0572E" strokeWidth="1.6"
              strokeDasharray="2 4" markerEnd="url(#mr2)"/>
            <path d="M610 88 V126" fill="none" stroke="#9578A6" strokeWidth="1.6"
              strokeDasharray="5 4" markerEnd="url(#mm2)"/>
            <BOX x={540} y={222} lines={["Gap"]} col="#14705A"/>
            <BOX x={340} y={222} lines={["Policy"]} col="#14705A"/>
            <BOX x={140} y={222} lines={["Levers"]} col="#5B3A9E"/>
            <path d="M610 182 V218" fill="none" stroke="#9578A6" strokeWidth="1.6"
              strokeDasharray="5 4" markerEnd="url(#mm2)"/>
            <path d="M538 248 H484" fill="none" stroke="#C39B4E" strokeWidth="1.6"
              strokeDasharray="5 4" markerEnd="url(#mc2)"/>
            <path d="M338 248 H284" fill="none" stroke="#C39B4E" strokeWidth="1.6"
              strokeDasharray="5 4" markerEnd="url(#mc2)"/>
            <path d="M210 220 V162 H376" fill="none" stroke="#C39B4E" strokeWidth="1.6"
              strokeDasharray="5 4" markerEnd="url(#mc2)"/>
            <circle cx="72" cy="248" r="13" fill="#FFFDFC" stroke="#14705A" strokeWidth="1.6"/>
            <text x="72" y="253" textAnchor="middle" fontSize="12" fontWeight="600"
              fill="#14705A" fontFamily="var(--mono)">B</text>
            <text className="ns" x="72" y="277" textAnchor="middle">balancing</text>
            <text className="ns" x="350" y="312" textAnchor="middle">behaviour is not deducible from the parts</text>
            <text className="ns" x="350" y="328" textAnchor="middle">every element behaves as predicted, the whole contradicts it</text>
          </svg>
        </div>
      </div>

      <div className="sy-legend">
        <span><i className="sw" style={{background:"#9C8A84"}}/>matter flow</span>
        <span><i className="sw" style={{background:"#B0572E"}}/>rule governing a flow</span>
        <span><i className="sw" style={{background:"#9578A6"}}/>measurement</span>
        <span><i className="sw" style={{background:"#C39B4E"}}/>command</span>
      </div>

      <div className="sy-warn2">
        <b>Only stocks carry matter.</b> A rule does not sit in the path — it governs a flow from
        the side, which is why it is drawn with a dotted line onto the arrow rather than as a box
        between two stocks. Same for levers and the policy: they command, they do not transport.
        This is the notation the model graph uses, so a mechanism drawn here reads the same way as
        one drawn in the workshop.
        <span style={{display:"block",marginTop:11}}><b>The same matter path, plus four organs
        that close the loop.</b> Sensors, gap, policy and levers are what the system has and the
        chain does not — and all four are constructs: they do not exist in the real thing, you
        build them. A chain does not become a system by being more complicated. It becomes one
        when you build the loop it was missing.</span>
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>chain or system</span><span className="bar"/>
        <span>both are mechanisms, they differ in depth</span></div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"18%"}}></th><th style={{width:"41%"}}>Chain</th>
          <th style={{width:"41%"}}>System</th></tr></thead>
        <tbody>{CHVSY_T.map(([k,a,b])=>(
          <tr key={k}><td>{k}</td><td>{a}</td><td>{b}</td></tr>))}</tbody>
      </table></div>
      <div className="sy-warn2">
        <b>The loop is a deliverable, not an entry requirement.</b> A chain enters your library as
        a candidate. The second role — absorbing variation without mobilising anyone — needs a
        regulation loop: a dead band, a cadence, a policy. So modelling takes something that
        already runs and grafts on the loop it lacks. That is why four organs are typed
        « construct »: sensors, gap, policy and owner do not exist in the real thing, you build them.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>what is not a mechanism</span><span className="bar"/>
        <span>five things people model by mistake</span></div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"14%"}}>Not this</th><th style={{width:"56%"}}>Why, and where it belongs instead</th>
          <th style={{width:"30%"}}>The question that settles it</th></tr></thead>
        <tbody>{PASMECA_T.map(([n,d,q])=>(
          <tr key={n}><td>{n}</td><td>{d}</td><td className="m">{q}</td></tr>))}</tbody>
      </table></div>
      <div className="sy-warn2">
        <b>The common thread is that none of them has an input and an output.</b> That is the
        cheapest test available: name what enters, name what leaves, and say at what cadence it
        starts again. If you cannot do all three, whatever you are looking at belongs in a register,
        in an organ of some other mechanism, or nowhere.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>the four roles</span><span className="bar"/>
        <span>each with its test</span></div>
      <div className="steps">
        {ROLES_T.map(([t,p,a,o])=>(
          <div key={t} className="step"><div><b>{t}</b><p>{p}</p>
            <span className="stop">{a}</span>
            <span className="prod"><i>checked by</i>{o}</span></div></div>))}
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>ready for the loop</span><span className="bar"/>
        <span>the gate between building and iterating</span></div>
      <div className="sy-def" style={{fontSize:"18px",padding:"22px 26px"}}>
        A mechanism enters the loop once all <em>five functions</em> are served and the
        <em> two laws</em> are checked. Not twenty-one organs.
      </div>
      <div className="sy-regi">
        <div className="sy-regb"><span className="rl">the five</span>
          <p>Frame, Matter, Machinery, Control, Epistemic. Every organ serves exactly one, and nothing in the diagnosis works while one is unserved.</p></div>
        <div className="sy-regb"><span className="rl">below the gate</span>
          <p>Diagnosing produces noise. The rules have no inputs, so the frictions they raise are artefacts of what is missing rather than of what is wrong.</p></div>
        <div className="sy-regb"><span className="rl">above the gate</span>
          <p>The loop turns with most organs still empty — and it fills them itself, through the write-back. Completeness is an output of iterating, not a prerequisite.</p></div>
      </div>
      <div className="sy-warn2">
        <b>The gate is the same for a chain and for a system.</b> Depth of modelling differs — a
        chain rarely needs every organ, a system usually does — but the five functions are what the
        rules read, and no diagnosis runs without them either way.
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>modelling</span><span className="bar"/>
        <span>6 phases, each producing its share of the model</span></div>
      <div className="steps">
        {PHASES_T.map(([t,p,l,a])=>(
          <div key={t} className="step"><div><b>{t}</b><p>{p}</p>
            <span className="prod"><i>{l}</i>{a}</span></div></div>))}
      </div>
    </div>

    <div className="sy-panel">
      <div className="sy-ph"><span>library rules</span><span className="bar"/>
        <span>once you have several</span></div>
      <ul className="rules">{BIBLIO_T.map((r,i)=><li key={i}>{r}</li>)}</ul>
    </div>
  </div>);
}


function Canevas({sel,setSel,vus}){
  const o = sel!=null ? ORGANS_T.find(x=>x.id===sel) : null;
  const no = n=>String(n).padStart(2,"0");
  const A={fill:"none",stroke:"#A69196",strokeWidth:2,markerEnd:"url(#a)"};
  const noeud = x=>{
    const col=FAMT[x.f].c;
    const props={className:"organ"+(sel===x.id?" on":""),style:{"--c":col},
      onClick:()=>setSel(x.id),role:"button",tabIndex:0,
      onKeyDown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSel(x.id);}}};
    if(x.badge) return (
      <g key={x.id} {...props}>
        <circle className="base" cx={x.badge.cx} cy={x.badge.cy} r="17"/>
        <circle className="card" cx={x.badge.cx} cy={x.badge.cy} r="17"/>
        <circle className="chip" cx={x.badge.cx} cy={x.badge.cy} r="12"/>
        <text className="numg" x={x.badge.cx} y={x.badge.cy+4.5}>{no(x.id)}</text>
        <text className="ns" x={x.badge.cx} y={x.badge.cy+32} textAnchor="middle">flows</text>
      </g>);
    const cy=x.y+x.h/2, bs=x.h<40?26:30;
    return (
      <g key={x.id} {...props}>
        <rect className="base" x={x.x} y={x.y} width={x.w} height={x.h} rx="10"/>
        <rect className="card" x={x.x} y={x.y} width={x.w} height={x.h} rx="10"/>
        <rect className="chip" x={x.x+11} y={cy-bs/2} width={bs} height={bs} rx="8"/>
        <text className="numg" x={x.x+11+bs/2} y={cy+4.5}>{no(x.id)}</text>
        <text className="nt" x={x.x+11+bs+13} y={cy-4}>{x.name}</text>
        <text className="ns" x={x.x+11+bs+13} y={cy+15}>{x.sub}</text>
      </g>);
  };
  return (
  <div className="sy-scroll">
    <div className="sy-head">
      <h2>Organs</h2>
      <p>The 21 organs on one map. Matter flows left to right, control comes back right to left. Click an organ for its card: function, control question, and what breaks when it is missing.</p>
    </div>
    <div className="sy-panel sy-stage">
      <div className="sy-ph"><span>structural model</span><span className="bar"/>
        <span>{vus.size} / 21 viewed</span></div>
      <div className="sy-scroller">
        <svg viewBox="0 0 1500 960" xmlns="http://www.w3.org/2000/svg" role="img"
          aria-label="Structural model of a mechanism">
          <defs>
            <pattern id="dotsT" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.2" fill="#DCCFCA"/></pattern>
            <linearGradient id="frT" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#A81D3A" stopOpacity=".55"/>
              <stop offset="1" stopColor="#3A0A17" stopOpacity=".35"/></linearGradient>
            {[["a","#A69196"],["ag","#14705A"],["aa","#B5761E"],["ac","#9A6410"]].map(([i,c])=>(
              <marker key={i} id={i} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,.5 L8.5,4.5 L0,8.5z" fill={c}/></marker>))}
          </defs>
          <rect width="1500" height="960" fill="url(#dotsT)"/>
          <rect x="90" y="150" width="1300" height="640" rx="20" fill="#FFFFFF" fillOpacity=".5"
            stroke="url(#frT)" strokeWidth="1.8" strokeDasharray="9 7"/>
          <text className="zone" x="110" y="42">frame — what defines the mechanism before any machinery</text>
          <text className="zone" x="125" y="540">control — the loop that closes the gap</text>
          <text className="zone" x="1170" y="864">epistemic layer — what the model is worth</text>
          <g fill="none">
            <path d="M30 288 H117" {...A}/><path d="M305 288 H352" {...A}/>
            <path d="M590 288 H662" {...A}/><path d="M845 288 H897" {...A}/>
            <path d="M1075 288 H1142" {...A}/><path d="M1325 288 H1468" {...A}/>
            <path d="M475 230 V242" {...A}/><path d="M760 230 V242" {...A}/><path d="M475 390 V334" {...A}/>
            <path d="M630 122 V520 H850 V552" stroke="#9A6410" strokeWidth="1.6"
              strokeDasharray="6 5" opacity=".75" markerEnd="url(#ac)"/>
            <path d="M1300 326 C1345 338 1360 358 1360 392 V730 Q1360 745 1345 745 H230 Q215 745 215 730 V392 C215 360 215 348 215 334"
              stroke="#B5761E" strokeWidth="2" markerEnd="url(#aa)"/>
            <path d="M1237 326 V552" stroke="#14705A" strokeWidth="2" markerEnd="url(#ag)"/>
            <path d="M1150 598 H948" stroke="#14705A" strokeWidth="2" markerEnd="url(#ag)"/>
            <path d="M760 598 H568" stroke="#14705A" strokeWidth="2" markerEnd="url(#ag)"/>
            <path d="M470 560 V468" stroke="#14705A" strokeWidth="2" markerEnd="url(#ag)"/>
            <path d="M630 699 H650 V608" stroke="#A69196" strokeWidth="1.4" strokeDasharray="3 4"/>
            <path d="M505 730 V743" stroke="#A69196" strokeWidth="1.4" strokeDasharray="3 4"/>
            {[315,655,995].map(x=>(
              <path key={x} d={`M${x} 790 V826`} stroke="#A81D3A" strokeWidth="1.4"
                strokeDasharray="3 4" opacity=".55"/>))}
          </g>
          <text className="edge-l" x="32" y="274">upstream</text>
          <text className="edge-l" x="1332" y="274">downstream / next mechanism</text>
          <text className="edge-l" x="660" y="514" fill="#9A6410">reference target</text>
          <circle cx="690" cy="598" r="12" fill="#FDFBF9" stroke="#14705A" strokeWidth="1.6"/>
          <text className="loop-b" x="690" y="602" fill="#14705A">B</text>
          <circle cx="790" cy="745" r="12" fill="#FDFBF9" stroke="#B5761E" strokeWidth="1.6"/>
          <text className="loop-b" x="790" y="749" fill="#B5761E">R</text>
          <g className={"organ"+(sel===1?" on":"")} style={{"--c":"#9A6410"}} role="button" tabIndex={0}
            onClick={()=>setSel(1)}>
            <rect className="base" x="1112" y="130" width="262" height="42" rx="21"/>
            <rect className="card" x="1112" y="130" width="262" height="42" rx="21"/>
            <rect className="chip" x="1119" y="137" width="28" height="28" rx="8"/>
            <text className="numg" x="1133" y="155.5">01</text>
            <text className="nt" x="1158" y="156">Boundary of the mechanism</text>
          </g>
          {ORGANS_T.filter(x=>!x.skip).map(noeud)}
        </svg>
      </div>
      <div className="sy-legend">
        {Object.values(FAMT).map(f=>(
          <span key={f.n}><i className="sw" style={{background:f.c}}/>{f.n}</span>))}
        <span><i className="sw" style={{background:"#14705A"}}/>B — balancing loop</span>
        <span><i className="sw" style={{background:"#B5761E"}}/>R — reinforcing loop</span>
      </div>
      <div className="sy-hint">Click an organ to open its card. The model scrolls horizontally on narrow screens.</div>
      {o && (
        <aside className="sy-fiche" role="dialog">
          <div className="sy-ft" style={{background:`linear-gradient(135deg,var(--wine-800),${FAMT[o.f].c})`}}>
            <span className="fam">{FAMT[o.f].n.toLowerCase()}</span>
            <span className="no">{no(o.id)}</span>
            <button className="sy-fx" onClick={()=>setSel(null)}>×</button>
            <h3>{o.name}</h3>
          </div>
          <div className="sy-fb">
            <div className="blk"><span className="lbl">function</span><p>{o.fonc}</p></div>
            <div className="blk q"><span className="lbl">control question</span><p>{o.q}</p></div>
            <div className="blk f"><span className="lbl">if the organ is missing</span><p>{o.abs}</p></div>
            <div className="blk"><span className="lbl">filled in when</span><p>{o.ok}</p></div>
          </div>
        </aside>)}
    </div>
    <div className="sy-panel">
      <div className="sy-ph"><span>the ten proposed organs, settled</span>
        <span className="bar"/><span>eight absorbed, two still open</span></div>
      <div className="tw"><table>
        <thead><tr><th style={{width:"19%"}}>Proposed</th><th style={{width:"33%"}}>What it was</th>
          <th style={{width:"11%"}}>Verdict</th><th style={{width:"37%"}}>Where it went</th></tr></thead>
        <tbody>{PROPS_T.map(([t,d,v,w])=>(
          <tr key={t}><td>{t}</td><td>{d}</td>
            <td><span className={"pv2 "+(v==="open"?"pv-open":"pv-abs")}>{v}</span></td>
            <td>{w}</td></tr>))}</tbody>
      </table></div>
      <div className="sy-warn2">
        <b>The derivation settled eight of the ten.</b> Once the five functions were named, most of
        these turned out to belong to something that already
        existed rather than new objects. Two survive: the actuator, and the list of known failure
        modes. Both are real gaps, and neither has a home yet.
      </div>
    </div>
  </div>);
}


function ModaleRegistres({regData,maj,systemes,onFermer,initial}){
  const [rid,setRid]=useState(initial||"acteurs");
  const reg=RM[rid];
  return (
    <div className="sy-back" onClick={onFermer}>
      <div className="sy-modal lg" onClick={e=>e.stopPropagation()}>
        <div className="mh">
          <div><div className="mk">registers · open alongside the build</div>
            <div className="mt">{reg.nom}</div></div>
          <button className="pcl" onClick={onFermer}>×</button>
        </div>
        <div className="mregtabs">
          {REGISTRES.map(r=>(
            <button key={r.id} data-on={rid===r.id?"1":"0"} onClick={()=>setRid(r.id)}>
              {r.nom}<i>{(regData[r.id]||[]).length}</i></button>))}
        </div>
        <div className="mb nopad">
          <div className="mregq">{reg.q}</div>
          <TableRegistre reg={reg} lignes={regData[rid]||[]} maj={maj} systemes={systemes}/>
        </div>
        <div className="mf">
          <span className="mfn">Owners and events fill in now. Resources and interfaces stay empty
            until a second mechanism exists.</span>
          <button className="sy-b sm p" onClick={onFermer}>Back to the build</button>
        </div>
      </div>
    </div>);
}

/* ================== GUIDED BUILD — mirrors the ten steps of the manual ================== */
const BUILD_ET = [
 {c:0, organes:[], lien:"registers"},
 {c:1, organes:[], type:true},
 {c:2, organes:["02","16","03"]},
 {c:3, organes:["01","21"]},
 {c:4, organes:["10","08","09","06"]},
 {c:5, organes:["13","11","12","04","05","14"]},
 {c:6, organes:["15","16","17"]},
 {c:7, organes:["19","20"]},
 {c:8, organes:["18","07"], lien:"control"},
 {c:9, organes:[], lien:"registers"}
];

function etatEtape(i,M,sys,R){
  const o=n=>obj(M,n), l=n=>lst(M,n);
  switch(i){
    case 0:{const a=((R||{}).acteurs||[]).filter(x=>String(x.nom||"").trim()).length;
      const e=((R||{}).evenements||[]).filter(x=>String(x.date||"").trim()).length;
      return {ok:a>0&&e>0,
        txt:a>0&&e>0?`${a} owner${a>1?"s":""} named, ${e} dated event${e>1?"s":""} logged.`
          :`Owners ${a} named, events ${e} dated. Both fill in today, without any model.`};}
    case 1: return {ok:!!(sys&&sys.type),txt:sys&&sys.type?`Recorded as a ${sys.type}.`:"Pick chain or system."};
    case 2:{const c=+o("02").cible,m=+o("16").mesure;
      return {ok:!isNaN(c)&&!isNaN(m),txt:(!isNaN(c)&&!isNaN(m))
        ?`Gap ${(m-c>0?"+":"")+ +(m-c).toFixed(1)} — measured ${m} against target ${c}.`
        :"A target and a current measurement are both needed before a gap exists."};}
    case 3:{const b=l("01"),d=b.filter(x=>x.type==="start").length,f=b.filter(x=>x.type==="end").length;
      return {ok:d>0&&f>0,txt:d&&f?`${d} start event, ${f} end event${f>1?"s":""}.`
        :"At least one start event and one end event."};}
    case 4:{const e=l("06").reduce((a,b)=>a+(+b.volume||0),0);
      const s=l("10").filter(x=>x.induite!=="yes").reduce((a,b)=>a+(+b.valeur||0),0);
      if(!e||!s) return {ok:false,txt:"Fill outputs and inputs, then the arithmetic can run."};
      const d=e-s;
      return {ok:Math.abs(d)<=0.5,txt:Math.abs(d)<=0.5
        ?`Conservation balances: ${e} in = ${s} out.`
        :`${Math.abs(d)} units ${d>0?"vanish":"appear"} — a stock or an output is missing.`};}
    case 5:{const r=l("13").length,lv=l("11").length;
      return {ok:r>0&&lv>0,txt:r&&lv?`${r} rule${r>1?"s":""}, ${lv} lever${lv>1?"s":""}.`
        :"At least one transformation rule and one lever."};}
    case 6:{const d=totalDelai(M),c=+o("17").cadence,b=+o("17").bande,br=bruitMax(M);
      if(!d||!c) return {ok:false,txt:"Delays and cadence are needed to check the first law."};
      const l1=c>=d, l2=!br||!b?null:b>br;
      return {ok:l1&&l2!==false,
        txt:`Cadence ${c} d ${l1?"≥":"<"} delay ${d} d${l2===null?"":` · dead band ±${b} ${l2?">":"≤"} noise ±${br}`}`};}
    case 7:{const v=l("19").length,h=l("19").filter(x=>x.niveau==="hunch").length;
      return {ok:v>0,txt:v?`${v} value${v>1?"s":""} tagged, ${h} on a hunch.`
        :"Tag at least the values that carry a conclusion."};}
    case 8:{const n=fonctionsCouvertes(M);
      return {ok:n>=FONCTIONS.length,txt:n>=FONCTIONS.length?"All five served — the control screen can be read."
        :`${n} of 5 functions served. Below five, diagnosing produces noise.`};}
    case 9:{const nom=(sys||{}).nom||"";
      const it=((R||{}).interfaces||[]).filter(x=>relie(x.de,nom)||relie(x.vers,nom)).length;
      const rs=((R||{}).ressources||[]).filter(x=>relie(x.puisent,nom)).length;
      return {ok:it>0||rs>0,
        txt:it||rs?`${it} interface${it>1?"s":""}, ${rs} resource${rs>1?"s":""} naming this mechanism.`
          :"Nothing has left the sheet yet. Whatever a second mechanism would also write belongs in a register."};}
    default: return {ok:false,txt:""};
  }
}

function OrganeEdit({o,M,maj,restaurer}){
  return (
  <div className="sy-oe">
    <div className="oeh">
      <span className="on">{o.id}</span>
      <div><b>{o.nom}</b>
        <span>{EXPL[o.id][1]}</span></div>
    </div>
    {o.liste ? (
      <div>
        <table className="sy-tb">
          <thead><tr>{o.cols.map(c=><th key={c.k} style={{width:c.w}}>{c.l}</th>)}
            <th style={{width:26}}/></tr></thead>
          <tbody>
            {lst(M,o.id).map((row,i)=>(
              <tr key={i}>
                {o.cols.map(c=>(
                  <td key={c.k}>
                    {c.t==="sel"
                      ? <select value={row[c.k]??""} onChange={e=>maj.setLi(o.id,i,c.k,e.target.value)}>
                          <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>
                      : <input type={c.t==="num"?"number":"text"} value={row[c.k]??""}
                          placeholder={typeof c.ph==="function"?c.ph(row):(c.ph||"")}
                          onChange={e=>maj.setLi(o.id,i,c.k,e.target.value)}/>}
                  </td>))}
                <td><button className="sy-x" aria-label="Delete this line" onClick={()=>window.sklConfirm({title:"Delete this line?",body:"The line will be removed from the register.",ok:"Delete",onOk:()=>maj.delLi(o.id,i)})}>×</button></td>
              </tr>))}
          </tbody>
        </table>
        <button className="sy-b sm" onClick={()=>maj.addLi(o.id)}>Add a row</button>
        {restaurer && lst(M,o.id).length===0 && (
          <button className="sy-b sm" style={{marginLeft:8}}
            onClick={()=>restaurer(o.id)}>Restore from the example</button>)}
      </div>
    ) : (
      <div className="oef">
        {o.ch.map(c=>(
          <div key={c.k} className="sy-f" style={{maxWidth:320}}>
            <div className="sy-lbl">{c.l}</div>
            {c.t==="sel"
              ? <select className="sy-in" value={obj(M,o.id)[c.k]??""}
                  onChange={e=>maj.setCh(o.id,c.k,e.target.value)}>
                  <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>
              : <input className="sy-in" type={c.t==="num"?"number":"text"} placeholder={c.ph||""}
                  value={obj(M,o.id)[c.k]??""} onChange={e=>maj.setCh(o.id,c.k,e.target.value)}/>}
          </div>))}
      </div>
    )}
  </div>);
}

function Assistant({sys,M,maj,etape,setEtape,restaurer,setType,onControl,regData,majReg,systemes}){
  const [modReg,setModReg]=useState(null);
  const corps=useRef(null);
  useEffect(()=>{ if(corps.current) corps.current.scrollTop=0; },[etape]);
  const E=BUILD_ET[etape], C=CHAPS[E.c], S=etatEtape(etape,M,sys);
  return (
  <div className="sy-fixw">
    {modReg && <ModaleRegistres regData={regData} maj={majReg} systemes={systemes}
      initial={modReg} onFermer={()=>setModReg(null)}/>}
    <div className="sy-fixh">
      <div className="fxl">
        <div className="sy-head">
          <h2>Step {C.n} · {C.t}</h2>
        </div>
        <FilEtapes i={etape} setChap={setEtape} etat={k=>etatEtape(k,M,sys,regData).ok}/>
      </div>
      <div className="fxr">
        <div className="fxrt">The model at this step</div>
        <SchemaProgressif etape={etape} M={M} compact/>
      </div>
    </div>
    <div className="sy-fixb" ref={corps}>

    <div className="sy-panel">
      <div className="sy-ph"><span>what you are doing</span><span className="bar"/>
        <span>{C.s}</span></div>
      <div className="sy-manp">{C.p.map((x,i)=><p key={i}>{x}</p>)}</div>
      <div className="sy-warn2"><b>The rule.</b> {C.regle}</div>
    </div>

    {E.type && (
      <div className="sy-panel">
        <div className="sy-ph"><span>chain or system</span><span className="bar"/>
          <span>sets how deep to model</span></div>
        <div className="sy-typech">
          {[["chain","No effect returns onto its cause. Gains add up, nothing surprises. The five functions are quickly served."],
            ["mechanism","At least one effect returns onto its own cause. The full twenty-one earn their keep."]].map(([k,d])=>(
            <button key={k} data-on={(sys.type||"")===k?"1":"0"} onClick={()=>setType(k)}>
              <b>{k==="chain"?"Chain":"System"}</b><span>{d}</span></button>))}
        </div>
      </div>)}

    {E.organes.length>0 && (
      <div className="sy-panel">
        <div className="sy-ph"><span>what to fill in</span><span className="bar"/>
          <span>{E.organes.length} organ{E.organes.length>1?"s":""}, in this order</span></div>
        <div className="sy-oes">
          {E.organes.map(id=>(
            <OrganeEdit key={id} o={OM[id]} M={M} maj={maj} restaurer={restaurer}/>))}
        </div>
      </div>)}

    {E.lien==="registers" && (
      <div className="sy-panel">
        <div className="sy-ph"><span>this step happens in the registers</span><span className="bar"/>
          <span>outside the sheet</span></div>
        <div className="sy-regt">
          <p className="sy-none" style={{padding:"0 0 12px"}}>
            Nothing is filled in the mechanism here — the registers sit above every mechanism.
            They open on top of this screen, so you keep your place.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {REGISTRES.map(r=>(
              <button key={r.id} className={"sy-b"+(r.id==="acteurs"||r.id==="evenements"?" p":"")}
                onClick={()=>setModReg(r.id)}>{r.nom}
                <i style={{fontStyle:"normal",opacity:.6,marginLeft:6}}>
                  {(regData[r.id]||[]).length}</i></button>))}
          </div>
        </div>
      </div>)}

    {E.lien==="control" && (
      <div className="sy-panel">
        <div className="sy-ph"><span>this step happens on the control screen</span><span className="bar"/>
          <span>laws, ignorance, frictions</span></div>
        <div className="sy-regt">
          <p className="sy-none" style={{padding:"0 0 12px"}}>
            The rules read what you have written. Nothing more to fill here.</p>
          <button className="sy-b p" onClick={onControl}>Open the control screen</button>
        </div>
      </div>)}

    <div className={"sy-arretbox"+(S.ok?" ok":"")}>
      <span className="ab">{S.ok?"stop condition met":"stop condition"}</span>
      <div><b>{C.arret.replace(/^stop — /,"")}</b><span>{S.txt}</span></div>
    </div>

    <div className="sy-navchap">
      <button className="sy-b" disabled={etape===0} onClick={()=>setEtape(etape-1)}>
        ← {etape>0?CHAPS[BUILD_ET[etape-1].c].t:""}</button>
      <button className="sy-b p" disabled={etape===BUILD_ET.length-1}
        onClick={()=>setEtape(etape+1)}>
        {etape<BUILD_ET.length-1?CHAPS[BUILD_ET[etape+1].c].t:"done"} →</button>
    </div>
    </div>
  </div>);
}

/* ================== APP ================== */
function App(){
  const [interf,setInterf]=useState("mechanisms");
  const [systemes,setSystemes]=useState(()=>normSys([
    {id:"s-preappel",nom:"Pre-call",type:"mechanism",modele:PREAPPEL},
    {id:"s-vente",nom:"Sales",type:"mechanism",modele:DEFAUT}]));
  const [actif,setActif]=useState("s-preappel");
  const [registre,setRegistre]=useState(null);
  const [vue,setVue]=useState("schema");
  const [vueT,setVueT]=useState("global");
  const [chap,setChap]=useState(-1);
  const [selT,setSelT]=useState(null);
  const [vus]=useState(()=>new Set());
  const [,forceMaj]=useState(0);
  const [sel,setSel]=useState("16");
  const [ouv,setOuv]=useState(()=>new Set());
  const [pop,setPop]=useState(null);
  const [voirExpl,setVoirExpl]=useState(false);
  const [voirRegles,setVoirRegles]=useState(false);
  const [charge,setCharge]=useState(false);
  const [nouveauNom,setNouveauNom]=useState(null);
  const [nouveauType,setNouveauType]=useState("chain");
  const [barPliee,setBarPliee]=useState(false);
  const [suppSys,setSuppSys]=useState(false);
  const [fnOuv,setFnOuv]=useState("frame");
  const [regData,setRegData]=useState(()=>regSemer(null));
  const [decisions,setDecisions]=useState([]);
  const [limite,setLimite]=useState(4);
  const [ecran,setEcran]=useState("mecanisme");
  const [filtre,setFiltre]=useState({critique:true,attention:true,veille:true});

  useEffect(()=>{(async()=>{
    const lire=async k=>{try{const v=await window.storage.get(k);
      return v&&v.value?JSON.parse(v.value):null;}catch(e){return null;}};
    try{
      const r=await lire("systemes");
      if(r){let d=normSys(migrerFR(r));
        if(!d.some(x=>x.id==="s-preappel"))
          d=[{id:"s-preappel",nom:"Pre-call",type:"mechanism",modele:normModele(PREAPPEL)},...d];
        if(d.length){setSystemes(d);setActif(d[0].id);}}
      let e=await lire("registres");
      if(e && estFR(e)) e=null;
      setRegData(regSemer(e));
      const dd=await lire("decisions");
      if(dd&&Array.isArray(dd.list)){
        setDecisions(dd.list.filter(x=>!estFR(x, x.sysNom)));setLimite(dd.limite||4);}
    }catch(e){} finally{setCharge(true);}
  })();},[]);
  useEffect(()=>{ if(!charge)return;
    (async()=>{try{await window.storage.set("systemes",JSON.stringify(systemes));}catch(e){}})();
  },[systemes,charge]);
  useEffect(()=>{ if(!charge)return;
    (async()=>{try{await window.storage.set("registres",JSON.stringify(regData));}catch(e){}})();
  },[regData,charge]);
  useEffect(()=>{ if(!charge)return;
    (async()=>{try{await window.storage.set("decisions",
      JSON.stringify({list:decisions,limite}));}catch(e){}})();
  },[decisions,limite,charge]);
  const majDec={
    set:(id,k,v)=>setDecisions(p=>p.map(d=>d.id===id?{...d,[k]:v}:d)),
    setOpt:(id,i,k,v)=>setDecisions(p=>p.map(d=>{if(d.id!==id)return d;
      const o=[...(d.options||[])];o[i]={...o[i],[k]:v};return{...d,options:o};})),
    addOpt:id=>setDecisions(p=>p.map(d=>d.id===id?
      {...d,options:[...(d.options||[]),{label:"",cout:"",qui:""}]}:d)),
    delOpt:(id,i)=>setDecisions(p=>p.map(d=>d.id===id?
      {...d,options:(d.options||[]).filter((_,j)=>j!==i)}:d)),
    addMany:l=>setDecisions(p=>[...l,...p]),
    del:id=>setDecisions(p=>p.filter(d=>d.id!==id))};
  const fluxD=useMemo(()=>fluxDecisions(decisions,limite),[decisions,limite]);

  useEffect(()=>{ if(!charge)return;
    setRegData(p=>{const q=regSemer(p);
      return REG_CLES.some(k=>(p[k]||[]).length!==q[k].length)?q:p;});
  },[charge]);

  const sys=systemes.find(s=>s.id===actif);
  /* l'étape courante appartient au mécanisme : elle part dans le même enregistrement */
  const etape=Math.min(Math.max(0,(sys&&sys.etape)||0),BUILD_ET.length-1);
  const setEtape=n=>setSystemes(p=>p.map(x=>x.id===actif
    ?{...x,etape:Math.min(Math.max(0,typeof n==="function"?n(x.etape||0):n),BUILD_ET.length-1)}
    :x));
  const M=sys?sys.modele:{};
  const majM=fn=>setSystemes(p=>p.map(s=>s.id===actif?{...s,modele:fn(s.modele)}:s));
  const nEtapesOk=useMemo(()=>sys?BUILD_ET.filter((_,i)=>etatEtape(i,M,sys,regData).ok).length:0,[M,sys,regData]);
  const notifs=useMemo(()=>calcNotifs(M),[M]);
  const ign=useMemo(()=>carteIgnorance(M),[M]);
  const nRempli=ORGANES.filter(x=>estRempli(x,M)).length;
  const nCrit=notifs.filter(n=>n.sev==="critique").length;
  const nSocle=fonctionsCouvertes(M);
  const ecartTxt=useMemo(()=>{const e=ecart(M), o=obj(M,"02");
    return e===null?"not computable"
      :`${obj(M,"16").mesure} → ${o.cible} (${e>0?"+":""}${e})`;},[M]);

  const setCh=(id,k,v)=>majM(m=>({...m,[id]:{...obj(m,id),[k]:v}}));
  const setLi=(id,i,k,v)=>majM(m=>{const l=[...lst(m,id)];l[i]={...l[i],[k]:v};return{...m,[id]:l};});
  const addLi=id=>majM(m=>({...m,[id]:[...lst(m,id),{}]}));
  const delLi=(id,i)=>majM(m=>({...m,[id]:lst(m,id).filter((_,j)=>j!==i)}));
  const maj={setCh,setLi,addLi,delLi};
  const SEED_MODELE={"s-preappel":PREAPPEL,"s-vente":DEFAUT};
  const srcSeed=SEED_MODELE[actif];
  const restaurer=srcSeed
    ? id=>majM(m=>({...m,[id]:JSON.parse(JSON.stringify(srcSeed[id]||[]))}))
    : null;
  const majReg={
    set:(r,i,k,v)=>setRegData(p=>{const l=[...p[r]];l[i]={...l[i],[k]:v};return{...p,[r]:l};}),
    add:r=>setRegData(p=>({...p,[r]:[...p[r],{}]})),
    seed:r=>setRegData(p=>({...p,[r]:(REG_SEED[r]||[]).map(x=>({...x}))})),
    del:(r,i)=>setRegData(p=>({...p,[r]:p[r].filter((_,j)=>j!==i)}))};

  const creer=()=>{const n=(nouveauNom||"").trim(); if(!n){setNouveauNom(null);return;}
    const id=uid(); setSystemes(p=>[...p,{id,nom:n,type:"",etape:0,modele:{}}]);
    setActif(id);setRegistre(null);setEcran("mecanisme");setVue("build");
    setPop(null);setNouveauNom(null);};
  const setType=t=>setSystemes(p=>p.map(x=>x.id===actif?{...x,type:t}:x));
  const ouvrirOrgane=id=>{setPop(null);setEcran("mecanisme");setRegistre(null);setSel(id);setVue("organes");};
  const choisirT=id=>{setSelT(id); if(id!=null){vus.add(id);forceMaj(v=>v+1);}};

  const theorie = interf==="theory";
  const oSel = selT!=null ? ORGANS_T.find(x=>x.id===selT) : null;

  return (
  <div className="sy">
    <style>{CSS}</style>

    <aside className="sy-nav">
      <div className="sy-brand">
        <div className="sy-mark"/>
        <h1>Iteration&nbsp;system</h1>
        <p>mechanisms · registers · theory</p>
      </div>

      <div className="sy-mode">
        <button data-on={!theorie?"1":"0"} onClick={()=>setInterf("mechanisms")}>Mechanisms</button>
        <button data-on={theorie?"1":"0"} onClick={()=>setInterf("theory")}>Theory</button>
      </div>

      <div className="sy-navls">
        {theorie ? (
          <>
            <div className="sy-navt">CONCEPTS<span>what it is</span></div>
            <button className="sy-tab" data-on={vueT==="global"?"1":"0"}
              onClick={()=>setVueT("global")}><span className="idx">01</span> Iteration system</button>
            <button className="sy-tab" data-on={vueT==="role"?"1":"0"}
              onClick={()=>setVueT("role")}><span className="idx">02</span> Mechanisms</button>
            <button className="sy-tab" data-on={vueT==="registres"?"1":"0"}
              onClick={()=>setVueT("registres")}><span className="idx">03</span> Registers</button>
            <button className="sy-tab" data-on={vueT==="canevas"?"1":"0"}
              onClick={()=>setVueT("canevas")}><span className="idx">04</span> Organs</button>

            <div className="sy-navt" style={{marginTop:24}}>METHODS<span>what to do</span></div>
            <button className="sy-tab" data-on={vueT==="manuel"?"1":"0"}
              onClick={()=>setVueT("manuel")}><span className="idx">01</span> Build a mechanism</button>
            {vueT==="manuel" && (
              <div className="sy-chaps">
                <button data-on={chap<0?"1":"0"} onClick={()=>setChap(-1)}>
                  <span className="cn">00</span>Overview</button>
                {CHAPS.map((c,i)=>(
                  <button key={c.n} data-on={chap===i?"1":"0"} onClick={()=>setChap(i)}>
                    <span className="cn">{c.n}</span>{c.t}</button>))}
              </div>)}
            <button className="sy-tab" data-on={vueT==="echec"?"1":"0"}
              onClick={()=>setVueT("echec")}><span className="idx">02</span> Failure modes</button>
          </>
        ) : (
          <>
            <button className="sy-mapbtn" data-on={ecran==="map"?"1":"0"}
              onClick={()=>{setEcran("map");setRegistre(null);setPop(null);}}>
              <span className="mi"/>
              <span className="mtx">
                <span className="mt3">Map of mechanisms</span>
                <span className="ms3">7 domains · {CATALOG.length} mechanisms</span>
              </span>
            </button>

            <div className="sy-navt" style={{marginTop:20}}>MECHANISMS<span>{systemes.length}</span></div>
            {systemes.map(s=>{
              const nt=calcNotifs(s.modele);
              const c=nt.filter(x=>x.sev==="critique").length;
              return (
                <button key={s.id} className="sy-sys" data-on={(s.id===actif&&!registre)?"1":"0"}
                  onClick={()=>{setActif(s.id);setRegistre(null);setEcran("mecanisme");setPop(null);setVue("schema");}}>
                  <span className="sn">{s.nom}</span>
                  <span className="cnt" data-crit={c>0?"1":"0"}>{nt.length}</span>
                </button>);})}
            <div style={{marginTop:10}}>
              {nouveauNom===null ? (
                <button className="sy-b p w" onClick={()=>setNouveauNom("")}>New mechanism</button>
              ) : (
                <div className="sy-neuf">
                  <input className="sy-in" autoFocus placeholder="Paid acquisition" value={nouveauNom}
                    onChange={e=>setNouveauNom(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")creer();if(e.key==="Escape")setNouveauNom(null);}}/>
                  <div style={{display:"flex",gap:6}}>
                    <button className="sy-b p sm" style={{flex:1}} onClick={creer}
                      disabled={!nouveauNom.trim()}>Create</button>
                    <button className="sy-b sm" onClick={()=>setNouveauNom(null)}>Cancel</button>
                  </div>
                </div>)}
            </div>

            <div className="sy-navt" style={{marginTop:26}}>DECISIONS<span>backlog</span></div>
            <button className="sy-sys" data-on={ecran==="decisions"?"1":"0"}
              onClick={()=>{setEcran("decisions");setRegistre(null);setPop(null);}}>
              <span className="sn">Decision backlog</span>
              <span className="cnt" data-crit={fluxD.sature?"1":"0"}>{decisions.length}</span>
            </button>

            <div className="sy-navt" style={{marginTop:26}}>REGISTERS<span>transverse</span></div>
            {REGISTRES.map(r=>(
              <button key={r.id} className="sy-sys" data-on={registre===r.id?"1":"0"}
                onClick={()=>{setRegistre(r.id);setEcran("registre");setPop(null);}}>
                <span className="sn">{r.nom}</span>
                <span className="cnt">{regData[r.id].length}</span>
              </button>))}
          </>)}
      </div>

      <div className="sy-navft">
        <div className="fi"><b>21 organs · 4 registers</b>5 functions · v4</div>
      </div>
    </aside>

    <div className="sy-col">
      {theorie ? (
        <>
          <div className="sy-hud">
            {vueT==="manuel" ? (<>
              <span className="sy-rd">Chapter <b>{chap<0?"overview":CHAPS[chap].n+" / "+String(CHAPS.length).padStart(2,"0")}</b></span>
              <span className="sy-rd">Step <b>{chap<0?"the whole path":String(chap+1).padStart(2,"0")+" · "+CHAPS[chap].t}</b></span>
            </>) : vueT==="global" ? (<>
              <span className="sy-rd">Loop terms <b>4</b></span>
              <span className="sy-rd">Containers <b>2</b></span>
              <span className="sy-rd">Loop <b>5 steps</b></span>
              <span className="sy-rd">Blockers checked <b>4</b></span>
            </>) : vueT==="role" ? (<>
              <span className="sy-rd">Forms <b>5</b></span>
              <span className="sy-rd">Mechanisms <b>2</b></span>
              <span className="sy-rd">Roles <b>4</b></span>
              <span className="sy-rd">Tests <b>4</b></span>
              <span className="sy-rd">Phases <b>6</b></span>
              <span className="sy-rd">Library rules <b>3</b></span>
            </>) : vueT==="registres" ? (<>
              <span className="sy-rd">Registers <b>4</b></span>
              <span className="sy-rd">Positions <b>3</b></span>
              <span className="sy-rd">Blockers held here <b>2</b></span>
            </>) : vueT==="echec" ? (<>
              <span className="sy-rd">Failure modes <b>8</b></span>
              <span className="sy-rd">Caught by a rule <b>7</b></span>
              <span className="sy-rd">Dominant mode <b>abandonment</b></span>
            </>) : (<>
              <span className="sy-rd">Nomenclature <b>21 organs</b></span>
              <span className="sy-rd">Proposed <b>10</b></span>
              <span className="sy-rd">Selection <b>{oSel?`${String(oSel.id).padStart(2,"0")} · ${oSel.name}`:"none"}</b></span>
            </>)}
            <span className="sy-live"><i className="sy-dot"/>
              <span className="sy-rd">{vueT==="manuel"?"manual":vueT==="global"?"overview":vueT==="role"?"framing":vueT==="registres"?"transverse":vueT==="echec"?"diagnostics":"organs"}</span></span>
          </div>
          {vueT==="global" ? <RoleIteration/>
            : vueT==="manuel" ? (chap<0 ? <VueApercu setChap={setChap}/>
                                        : <Manuel chap={chap} setChap={setChap}/>)
            : vueT==="role" ? <RoleSysteme/>
            : vueT==="registres" ? <RoleRegisters/>
            : vueT==="echec" ? <ModesEchec/>
            : <Canevas sel={selT} setSel={choisirT} vus={vus}/>}
        </>
      ) : ecran==="map" ? (
        <>
          <div className="sy-hud">
            <span className="sy-rd">Map <b>{CATALOG.length} mechanisms</b></span>
            <span className="sy-rd">Modelled <b>{systemes.length}</b></span>
            <span className="sy-rd">Domains <b>4</b></span>
            <span className="sy-live"><i className="sy-dot"/>
              <span className="sy-rd">tech tree</span></span>
          </div>
          <CarteMecanismes systemes={systemes} decisions={decisions}
            onCreer={nom=>{const id=uid();
              setSystemes(p=>[...p,{id,nom,type:"chain",modele:{}}]);
              setActif(id);setEcran("mecanisme");setRegistre(null);
              setVue("organes");setSel("16");setPop(null);}}
            onOuvrir={id=>{setActif(id);setEcran("mecanisme");setRegistre(null);
              setVue("schema");setPop(null);}}
            onCycle={id=>{setActif(id);setEcran("mecanisme");setRegistre(null);
              setVue("pilotage");setPop(null);}}/>
        </>
      ) : ecran==="decisions" ? (
        <>
          <div className="sy-hud">
            <span className="sy-rd">Backlog <b>{decisions.length}</b></span>
            <span className="sy-rd">In test <b>{fluxD.enCours}</b> / {limite}</span>
            <span className="sy-rd">Cycle <b>{fluxD.cycle??"—"}</b> days</span>
            <span className="sy-rd">Inconclusive <b>{fluxD.incRate!=null?fluxD.incRate+" %":"—"}</b></span>
            <span className="sy-live"><i className="sy-dot"/>
              <span className="sy-rd">flow layer</span></span>
          </div>
          <VueDecisions systemes={systemes} decisions={decisions} maj={majDec}
            limite={limite} setLimite={setLimite}/>
        </>
      ) : (registre && ecran==="registre") ? (
        <>
          <div className="sy-hud">
            <span className="sy-rd">Register <b>{RM[registre].nom}</b></span>
            <span className="sy-rd">Entries <b>{(regData[registre]||[]).length}</b></span>
            <span className="sy-rd">All four <b>{REG_CLES.map(k=>(regData[k]||[]).length).join(" · ")}</b></span>
            <span className="sy-rd">Scope <b>transverse</b></span>
            <span className="sy-live"><i className="sy-dot"/>
              <span className="sy-rd">outside mechanisms</span></span>
          </div>
          <VueRegistre reg={RM[registre]} lignes={regData[registre]||[]} maj={majReg} systemes={systemes}/>
        </>
      ) : !sys ? <div className="sy-empty">No mechanism selected.</div> : (
        <>
          <div className="sy-hud">
            <span className="sy-rd">Mechanism <b>{sys.nom}</b> · {sys.type||"mechanism"}</span>
            <span className="sy-rd">Gap <b>{ecartTxt}</b></span>
            <span className="sy-rd">Ignorance <b>{ign.length}</b> point{ign.length>1?"s":""}</span>
            <span className="sy-rd">Functions <b>{nSocle}</b> / 5</span>
            <span className="sy-rd">Notifications <b>{notifs.length}</b>
              {nCrit>0?<> · <b>{nCrit} crit.</b></>:null}</span>
            <span className="sy-rd">Registers <b>{REG_CLES.map(k=>(regData[k]||[]).length).join(" · ")}</b></span>
            <div className="sy-sp"/>
            <div className="sy-tabs">
              <button data-on={vue==="build"?"1":"0"}
                onClick={()=>{setVue("build");setPop(null);}}>Build
                <i className="tbn" data-fait={nEtapesOk===BUILD_ET.length?"1":"0"}>
                  {String(nEtapesOk).padStart(2,"0")}/{BUILD_ET.length}</i></button>
              <button data-on={vue==="schema"?"1":"0"} onClick={()=>setVue("schema")}>Model</button>
              <button data-on={vue==="organes"?"1":"0"}
                onClick={()=>{setVue("organes");setPop(null);}}>Organs</button>
              <button data-on={vue==="pilotage"?"1":"0"}
                onClick={()=>{setVue("pilotage");setPop(null);}}>Control</button>
            </div>
          </div>

          {vue==="build" ? (
            <Assistant sys={sys} M={M} maj={maj} etape={etape} setEtape={setEtape}
              restaurer={restaurer} setType={setType} regData={regData} majReg={majReg}
              systemes={systemes} onControl={()=>setVue("pilotage")}/>
          ) : vue==="schema" ? (
            <div className="sy-schema">
              <div className="sy-bar" data-plie={barPliee?"1":"0"}>
                <div className="sy-bart">OUTSIDE THE MODEL — THEY FRAME, CONDITION OR ANNOTATE THE MECHANISM
                  <button className="sy-plier" onClick={()=>setBarPliee(v=>!v)}>
                    {barPliee?"show":"hide"}</button></div>
                <div className="sy-db">
                  {ORGANES.filter(x=>x.zone==="barre").map(x=>{const k=kpi(x.id,M);
                    const col=k.etat==="vide"?"var(--line-2)"
                            :k.etat==="alerte"?"var(--wine-600)":"var(--ink)";
                    return (
                      <div key={x.id} className="sy-dbt" data-etat={k.etat}
                        style={{"--fc":k.etat==="vide"?"var(--line-2)":couleurOrgane(x.id)}}
                        onClick={()=>setPop(x.id)}>
                        <span className="dp"/>
                        <div className="dl">{x.id} · {x.nom.toUpperCase()}</div>
                        <div className={"dv"+(k.txt?" txt":"")} style={{color:col}}>{k.v}</div>
                        <div className="ds">{k.sub}</div>
                      </div>);})}
                </div>
                <div className="sy-leg">
                  {Object.values(FAMT).map(f=>(
                    <span key={f.n}><i style={{background:f.c,height:8,width:8,borderRadius:2}}/>{f.n}</span>))}
                  <span style={{opacity:.4}}>│</span>
                  <span><i style={{background:"#9C8A84"}}/>matter flow</span>
                  <span><i style={{background:"#9C8A84",borderTop:"2px dashed #9C8A84",height:0}}/>return flow</span>
                  <span><i style={{background:"#9578A6",borderTop:"2px dashed #9578A6",height:0}}/>measurement</span>
                  <span><i style={{background:"#C39B4E",borderTop:"2px dashed #C39B4E",height:0}}/>command</span>
                  <span><i style={{background:"#B0572E",borderTop:"2px dotted #B0572E",height:0}}/>rule governing a flow</span>
                </div>
              </div>
              <div className="sy-cv">
                <Schema M={M} reg={regData} sysNom={sys.nom} restaurer={restaurer}
                  pop={estOrganeId(pop)?null:pop}
                  onPick={id=>setPop(p=>p===id?null:id)}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane} maj={maj}/>
              </div>
              {estOrganeId(pop) && (
                <PopEdit organId={pop} rowIdx={null} titre={OM[pop].nom} soustitre={OM[pop].ty}
                  couleur={couleurOrgane(pop)} M={M} maj={maj} reg={regData} sysNom={sys.nom}
                  restaurer={restaurer}
                  style={{top:14,right:18}}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane}/>)}
            </div>
          ) : vue==="pilotage" ? (
            <Pilotage notifs={notifs} ign={ign} filtre={filtre} setFiltre={setFiltre}
              onOuvrir={ouvrirOrgane}/>
          ) : (
            <div className="sy-view">
              <div className="sy-rail">
                <div className="sy-fam">THE FIVE FUNCTIONS</div>
                {FONCTIONS.map(([cle,nom,verbe])=>{
                  const liste=ORGANES.filter(o=>FN_KEY[o.fam]===cle);
                  const n=liste.filter(o=>estRempli(o,M)).length;
                  const ouvert=fnOuv===cle || liste.some(o=>o.id===sel);
                  return (
                    <div key={cle} className="sy-fnb" data-ouv={ouvert?"1":"0"}
                      style={{"--fc":FAMT[cle].c}}>
                      <button className="fnh" onClick={()=>setFnOuv(v=>v===cle?null:cle)}>
                        <b>{nom}</b><span>{verbe}</span>
                        <i data-ok={n>0?"1":"0"}>{n}/{liste.length}</i>
                        <em>{ouvert?"−":"+"}</em>
                      </button>
                      {ouvert && liste.map(x=>(
                        <button key={x.id} className="sy-o fnx" data-on={sel===x.id?"1":"0"}
                          onClick={()=>setSel(x.id)}>
                          <span className="no">{x.id}</span>
                          <span className="nm">{x.nom}</span>
                          <span className="dot" data-on={estRempli(x,M)?"1":"0"}/>
                        </button>))}
                    </div>);})}
                <div className="sy-railft">
                  Every organ serves exactly one of the five functions. A mechanism that leaves
                  one function unserved cannot be steered, whatever else is filled in.
                </div>
                <button className="sy-delsys" onClick={()=>setSuppSys(true)}>
                  Delete this mechanism</button>
              </div>
              <Fiche o={OM[sel]} M={M} voirExpl={voirExpl} setVoirExpl={setVoirExpl}
                voirRegles={voirRegles} setVoirRegles={setVoirRegles} maj={maj} restaurer={restaurer}/>
            </div>
          )}
        </>)}
{suppSys && sys && (() => {
      const nOrg=ORGANES.filter(x=>estRempli(x,M)).length;
      const nDec=decisions.filter(d=>d.sysId===sys.id).length;
      const nReg=REG_CLES.reduce((a,k)=>a+(regData[k]||[]).filter(r=>
        (RM[k].mec||[]).some(c=>relie(r[c],sys.nom))).length,0);
      return (
      <div className="sy-back" onClick={()=>setSuppSys(false)}>
        <div className="sy-modal sm2" onClick={e=>e.stopPropagation()}>
          <div className="mh" style={{background:"linear-gradient(135deg,var(--wine-800),var(--stop))"}}>
            <div><div className="mk">delete a mechanism</div><div className="mt">{sys.nom}</div></div>
            <button className="pcl" onClick={()=>setSuppSys(false)}>×</button>
          </div>
          <div className="mb">
            <div className="mblk"><span className="rl">what goes with it</span>
              <div className="sy-delrows">
                <div><span>Organs filled</span><b>{nOrg} of 21</b></div>
                <div><span>Decisions in the backlog</span><b>{nDec}</b></div>
                <div><span>Register entries naming it</span><b>{nReg} — kept</b></div>
              </div></div>
            <div className="mblk"><span className="rl">what survives</span>
              <p>The registers are not deleted: what was shared stays, and the lines naming this
              mechanism keep pointing at a name that no longer exists. Clean them up afterwards, or
              leave them as a record that it once ran.</p></div>
            <div className="mblk"><span className="rl">no undo</span>
              <p>There is no export yet, so this cannot be recovered.</p></div>
          </div>
          <div className="mf">
            <button className="sy-b sm" onClick={()=>setSuppSys(false)}>Keep it</button>
            <button className="sy-b sm danger" onClick={()=>{
              const reste=systemes.filter(x=>x.id!==sys.id);
              setDecisions(d=>d.filter(x=>x.sysId!==sys.id));
              setSystemes(reste);
              setSuppSys(false);
              if(reste.length){setActif(reste[0].id);setSel("16");setVue("schema");}
              else {setActif(null);setEcran("theorie");}
            }}>Delete the mechanism</button>
          </div>
        </div>
      </div>);})()}

    </div>
  </div>);
}

/* ================== ORGAN SHEET ================== */
function Fiche({o,M,voirExpl,setVoirExpl,voirRegles,setVoirRegles,maj,restaurer}){
  const [supp,setSupp]=useState(null);
  return (
  <div className="sy-main">
    <h2 className="sy-h">{o.nom}</h2>
    <div className="sy-meta">
      Organ {o.id} · <span style={{color:TYCOL[o.ty],fontWeight:600}}>{o.ty}</span> ·{" "}
      {o.fam} · {o.zone==="schema"?"inside the model":"outside the model"}
    </div>
    {(()=>{const f=FONCTIONS.find(x=>x[0]===FN_KEY[o.fam]);
      return <div className="sy-socle" style={{"--fc":FAMT[f[0]].c}}>
        <b>{f[1]} — it {f[2]}s.</b> {f[3]}</div>;})()}
    <div className="sy-tg">
      <button data-on={voirExpl?"1":"0"} onClick={()=>setVoirExpl(v=>!v)}>
        What this organ is for <span className="cx">{voirExpl?"−":"+"}</span></button>
      <button data-on={voirRegles?"1":"0"} onClick={()=>setVoirRegles(v=>!v)}>
        Construction rules <span className="cx">{voirRegles?"−":"+"}</span></button>
    </div>
    {voirExpl && (
      <div className="sy-pan">
        <div className="pt">its role</div><p>{EXPL[o.id][0]}</p>
        <div className="pt">how to fill it in</div><p>{EXPL[o.id][1]}</p>
      </div>)}
    {voirRegles && (
      <div className="sy-pan">
        {o.rg.map((r,i)=><div key={i} className="sy-r"><span className="i">{i+1}</span><span>{r}</span></div>)}
      </div>)}
    {o.liste ? (
      <div>
        <table className="sy-tb">
          <thead><tr>{o.cols.map(c=><th key={c.k} style={{width:c.w}}>{c.l}</th>)}<th style={{width:30}}/></tr></thead>
          <tbody>
            {lst(M,o.id).map((row,i)=>(
              <tr key={i}>
                {o.cols.map(c=>(
                  <td key={c.k}>
                    {c.t==="sel"
                      ? <select value={row[c.k]??""} onChange={e=>maj.setLi(o.id,i,c.k,e.target.value)}>
                          <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>
                      : <input type={c.t==="num"?"number":"text"} value={row[c.k]??""}
                          placeholder={typeof c.ph==="function"?c.ph(row):(c.ph||"")}
                          onChange={e=>maj.setLi(o.id,i,c.k,e.target.value)}/>}
                  </td>))}
                <td><button className="sy-x" onClick={()=>setSupp(i)}>×</button></td>
              </tr>))}
          </tbody>
        </table>
        <button className="sy-b" onClick={()=>maj.addLi(o.id)}>Add a row</button>
        {restaurer && lst(M,o.id).length===0 && (
          <button className="sy-b" style={{marginLeft:8}}
            onClick={()=>restaurer(o.id)}>Restore from the example</button>)}
        {supp!==null && <ConfirmSuppr o={o} row={lst(M,o.id)[supp]}
          onAnnuler={()=>setSupp(null)}
          onValider={()=>{maj.delLi(o.id,supp);setSupp(null);}}/>}
      </div>
    ) : (
      <div>
        {o.ch.map(c=>(
          <div key={c.k} className="sy-f">
            <div className="sy-lbl">{c.l}</div>
            {c.t==="sel"
              ? <select className="sy-in" value={obj(M,o.id)[c.k]??""} onChange={e=>maj.setCh(o.id,c.k,e.target.value)}>
                  <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>
              : <input className="sy-in" type={c.t==="num"?"number":"text"} placeholder={c.ph||""}
                  value={obj(M,o.id)[c.k]??""} onChange={e=>maj.setCh(o.id,c.k,e.target.value)}/>}
          </div>))}
      </div>
    )}
  </div>);
}

/* ---- register references attached to a node ---- */
const relie = (a,b) => { const x=(a||"").trim().toLowerCase(), y=(b||"").trim().toLowerCase();
  return !!x && !!y && (x.includes(y) || y.includes(x)); };

function liensRegistres(label, sysNom, R){
  R = R || {}; const out=[];
  (R.interfaces||[]).forEach(r=>{
    if(relie(r.point,label) || relie(r.de,label) || relie(r.vers,label))
      out.push({k:"interface",t:r.point||"unnamed transit",
        d:`${r.de||"?"} → ${r.vers||"?"}${r.debit?` · ${r.debit} ${r.unite||""}`:""}`.trim(),
        n:r.def?`definition — ${r.def}`:""});});
  (R.ressources||[]).forEach(r=>{
    if(relie(r.nom,label) || relie(r.puisent,label))
      out.push({k:"resource",t:r.nom||"unnamed resource",
        d:`${r.nature||"nature not set"}${r.borne?` · ${r.charge??"?"} / ${r.borne} ${r.unite||""}`:""}`.trim(),
        n:r.puisent?`drawn on by — ${r.puisent}`:""});});
  (R.acteurs||[]).forEach(r=>{
    if(relie(r.leviers,label))
      out.push({k:"owner",t:r.nom||"unnamed person",
        d:`${r.role||"role not set"} · holds a refusal: ${r.refus||"?"}`,
        n:r.leviers?`levers — ${r.leviers}`:""});});
  (R.evenements||[]).filter(r=>(r.date||"").trim() &&
      (relie(r.rouages,sysNom)||relie(r.rompt,label)||relie(r.nom,label)))
    .slice(0,2).forEach(r=>out.push({k:"event",t:`${r.date} · ${r.nom||"unnamed"}`,
      d:r.rompt||"what it breaks not stated",
      n:r.rouages?`affects — ${r.rouages}`:""}));
  return out;
}

/* ---- deletion guard, shared by the organ sheet and the graph popup ---- */
function ConfirmSuppr({o,row,onAnnuler,onValider}){
  const rempli=(o.cols||[]).filter(c=>String(row?.[c.k]??"").trim()!=="");
  return (
    <div className="sy-back" onClick={onAnnuler}>
      <div className="sy-modal sm2" onClick={e=>e.stopPropagation()}>
        <div className="mh" style={{background:"linear-gradient(135deg,var(--wine-800),var(--stop))"}}>
          <div><div className="mk">delete from {o.nom}</div>
            <div className="mt">{rempli.length?String(row[rempli[0].k]):"empty row"}</div></div>
          <button className="pcl" onClick={onAnnuler}>×</button>
        </div>
        <div className="mb">
          <div className="mblk"><span className="rl">what you are removing</span>
            {rempli.length===0
              ? <p>An empty row. Nothing is lost.</p>
              : <div className="sy-delrows">
                  {rempli.map(c=>(
                    <div key={c.k}><span>{c.l}</span><b>{String(row[c.k])}</b></div>))}
                </div>}</div>
          <div className="mblk"><span className="rl">what else it touches</span>
            <p>Anything referring to this line by name loses its link: a friction that pointed at it
            stops firing, and a register entry naming it will match nothing.</p></div>
        </div>
        <div className="mf">
          <button className="sy-b sm" onClick={onAnnuler}>Keep it</button>
          <button className="sy-b sm danger" onClick={onValider}>Delete</button>
        </div>
      </div>
    </div>);
}

/* ================== EDITABLE POPUP ================== */
function Champ({c,val,row,onCh}){
  const ph = typeof c.ph==="function" ? c.ph(row||{}) : (c.ph||"");
  if(c.t==="sel") return (
    <select className="sy-in" value={val??""} onChange={e=>onCh(e.target.value)}>
      <option value=""/>{c.o.map(x=><option key={x}>{x}</option>)}</select>);
  return <input className="sy-in" type={c.t==="num"?"number":"text"} placeholder={ph}
    value={val??""} onChange={e=>onCh(e.target.value)}/>;
}

function PopEdit({organId,rowIdx,titre,soustitre,couleur,M,maj,style,onFermer,onOuvrir,note,reg,sysNom,restaurer}){
  const o=OM[organId];
  const [supp,setSupp]=useState(null);
  const corps=[];
  if(note){ corps.push(<div key="n" className="sy-pvide">{note}</div>); }
  else if(o&&o.liste&&rowIdx!==null&&rowIdx!==undefined&&rowIdx>=0){
    const row=lst(M,organId)[rowIdx]||{};
    o.cols.forEach(c=>corps.push(
      <div key={c.k} className="sy-pe"><div className="pk">{c.l}</div>
        <Champ c={c} val={row[c.k]} row={row} onCh={v=>maj.setLi(organId,rowIdx,c.k,v)}/></div>));
  } else if(o&&o.liste){
    const rows=lst(M,organId);
    if(!rows.length) corps.push(
      <div key="v" className="sy-pvide">No rows yet. Add the first one below.
        {restaurer && <button className="sy-b sm" style={{marginTop:8,width:"100%"}}
          onClick={()=>restaurer(organId)}>Restore this organ from the example</button>}</div>);
    rows.forEach((row,i)=>corps.push(
      <div key={i} className="sy-pr">
        <button className="prx" onClick={()=>setSupp(i)}>×</button>
        <div className="prn">row {i+1}</div>
        {o.cols.map(c=>(
          <div key={c.k} className="sy-pe"><div className="pk">{c.l}</div>
            <Champ c={c} val={row[c.k]} row={row} onCh={v=>maj.setLi(organId,i,c.k,v)}/></div>))}
      </div>));
    corps.push(<button key="a" className="sy-b sm" style={{width:"100%"}}
      onClick={()=>maj.addLi(organId)}>Add a row</button>);
  } else if(o){
    const v=obj(M,organId);
    o.ch.forEach(c=>corps.push(
      <div key={c.k} className="sy-pe"><div className="pk">{c.l}</div>
        <Champ c={c} val={v[c.k]} onCh={x=>maj.setCh(organId,c.k,x)}/></div>));
  }
  const liens=liensRegistres(titre, sysNom, reg);
  const KREG={interface:"#9A6410",resource:"#0E6E7A",owner:"#5B3A9E",event:"#8E7C81"};
  return (
    <div className="sy-pop" style={style} onClick={e=>e.stopPropagation()}>
      {supp!==null && <ConfirmSuppr o={o} row={lst(M,organId)[supp]}
        onAnnuler={()=>setSupp(null)}
        onValider={()=>{maj.delLi(organId,supp);setSupp(null);}}/>}
      <div className="ph2" style={couleur?{background:`linear-gradient(135deg,var(--wine-800),${couleur})`}:undefined}>
        <div>
          <div className="pn">{o?`Organ ${o.id} · ${o.nom}`:"Outside the model"}</div>
          <div className="pt2">{titre}</div>
          {soustitre && <div className="pty">{soustitre}</div>}
        </div>
        <button className="pcl" onClick={onFermer}>×</button>
      </div>
      <div className="pb">{corps}
        <div className="sy-rlink">
          <div className="rlh">Registers · {liens.length}</div>
          {liens.length===0
            ? <p className="rle">No register entry references this yet. It would appear here if an
                interface names it, a resource is drawn on by it, an owner holds it as a lever, or
                a dated event affects this mechanism.
                {(reg && REG_CLES.some(k=>(reg[k]||[]).length>0))
                  ? <span style={{display:"block",marginTop:6}}>
                      The registers hold {REG_CLES.map(k=>(reg[k]||[]).length).join(" · ")} entries —
                      none of them names « {titre} ».</span>
                  : <span style={{display:"block",marginTop:6,color:"var(--wine-600)"}}>
                      All four registers are empty in this browser. Open a register screen once and
                      it will fill itself.</span>}</p>
            : liens.map((l,i)=>(
                <div key={i} className="rli">
                  <span className="rk" style={{background:KREG[l.k]}}>{l.k}</span>
                  <div className="rlt">
                    <b>{l.t}</b>
                    {l.d && <span>{l.d}</span>}
                    {l.n && <em>{l.n}</em>}
                  </div>
                </div>))}
        </div>
      </div>
      <div className="sy-pf">
        {o && <button className="sy-b sm" onClick={()=>onOuvrir(o.id)}>Open full sheet</button>}
        <button className="sy-b p sm" onClick={onFermer}>Done</button>
      </div>
    </div>);
}

/* ================== CONTROL ================== */
const SEV={critique:{l:"critical",c:"var(--stop)",bg:"var(--stopbg)",
   d:"The mechanism already misbehaves. Handle before any iteration."},
 attention:{l:"attention",c:"var(--wait)",bg:"var(--waitbg)",
   d:"A gate fails or an organ of the model is missing."},
 veille:{l:"watch",c:"var(--ink-3)",bg:"var(--bone-3)",
   d:"Nothing to do today, but worth watching."}};
const CAT={friction:"friction",porte:"gate",manque:"missing organ",veille:"watch"};

function Pilotage({notifs,ign,filtre,setFiltre,onOuvrir}){
  const par=s=>notifs.filter(n=>n.sev===s).length;
  const lois=notifs.filter(n=>n.loi);
  const vis=notifs.filter(n=>filtre[n.sev]&&!n.loi);
  const groupes=[["Active frictions","friction"],["Gates","porte"],
                 ["Missing organs","manque"],["Watch items","veille"]];
  const rangs=["core","shape","bound","value"];
  return (
  <div className="sy-pil">
    <div className="sy-lois">
      <div className="sy-loit">TWO LAWS — they are not negotiated, they are checked</div>
      {lois.length===0
        ? <div className="sy-loiok"><b>Both inequalities hold.</b> The decision cadence exceeds the
            total loop delay, and the dead band exceeds the sensor noise. The apparatus cannot
            oscillate for structural reasons.</div>
        : lois.map(l=>(
            <div key={l.id} className="sy-loiko">
              <div className="lt">{l.titre}</div>
              <p>{l.txt}</p>
              <div className="lc">{l.calc}</div>
              <div className="na">{l.org.map(id=>OM[id]&&(
                <button key={id} className="sy-b sm" onClick={()=>onOuvrir(id)}>
                  {id} · {OM[id].nom}</button>))}</div>
            </div>))}
    </div>

    <div className="sy-sec">Ignorance map — {ign.length} point{ign.length>1?"s":""}, most structural first</div>
    {ign.length===0
      ? <p className="sy-none">No ignorance declared. That is rare, and more likely a gap in organ 19 than a state of the model.</p>
      : <div className="sy-ign">
          {ign.map((x,i)=>(
            <div key={i} className="sy-igr" data-rang={x.rang} onClick={()=>onOuvrir(x.org)}>
              <span className="ir">{rangs[x.rang]}</span>
              <div className="iq"><b>{x.quoi}</b><span>{x.pq}</span></div>
              <span className="io">{x.ou}</span>
            </div>))}
        </div>}

    <div className="sy-sec">Notifications</div>
    <div className="sy-sum">
      {["critique","attention","veille"].map(s=>(
        <div key={s} className="sy-su" data-on={filtre[s]?"1":"0"}
          onClick={()=>setFiltre(f=>({...f,[s]:!f[s]}))}>
          <div className="sv" style={{color:SEV[s].c}}>{par(s)}</div>
          <div className="sl">{SEV[s].l}<br/>{SEV[s].d}</div>
        </div>))}
      <div className="sy-su" data-on="1" style={{cursor:"default"}}>
        <div className="sv">{notifs.length}</div>
        <div className="sl">in total<br/>Click a counter to filter.</div>
      </div>
    </div>

    {vis.length===0 && (
      <p className="sy-none">Nothing to show. If every counter reads zero, the model is complete and consistent — which is rare and deserves a second look at the honesty gate.</p>)}

    {groupes.map(([titre,cat])=>{
      const l=vis.filter(n=>n.cat===cat);
      if(!l.length) return null;
      return (
        <div key={cat}>
          <div className="sy-sec">{titre} — {l.length}</div>
          {l.map(n=>(
            <div key={n.id} className="sy-nt2" data-sev={n.sev}>
              <div className="sy-nth">
                <span className="nn2">{n.titre}</span>
                <span className="nb" style={{background:SEV[n.sev].bg,color:SEV[n.sev].c}}>{SEV[n.sev].l}</span>
                <span className="no2">{CAT[n.cat]}</span>
              </div>
              <p>{n.txt}</p>
              {n.calc && n.calc!=="—" && <div className="nc">{n.calc}</div>}
              <div className="na">
                {n.org.map(id=>OM[id]&&(
                  <button key={id} className="sy-b sm" onClick={()=>onOuvrir(id)}>
                    {id} · {OM[id].nom}</button>))}
              </div>
            </div>))}
        </div>);})}
  </div>);
}
/* ================== GRAPH CONSTRUCTION ================== */
const norm = x => (x||"").toString().trim().toLowerCase();

const KIND = {
  entree:  {c:"#8A7872", l:"input"},
  stock:   {c:"#7A2233", l:"stock", fort:true},
  sortie:  {c:"#8A7872", l:"output"},
  ext:     {c:"#C6B8B3", l:"outside boundary"},
  regle:   {c:"#B0572E", l:"rule"},
  levier:  {c:"#A0721A", l:"lever"},
  capteur: {c:"#6B4A7A", l:"sensor"},
  ecart:   {c:"#6B4A7A", l:"gap"},
  polit:   {c:"#6B4A7A", l:"policy"}
};
const NW=192, NH=68;

function buildGraph(M){
  const nodes=[], edges=[];
  const add=(id,kind,label,sub,org,idx)=>{nodes.push({id,kind,label:label||"unnamed",sub:sub||"",org,idx});return id;};

  lst(M,"06").forEach((e,i)=>add("e"+i,"entree",e.nom,`${e.volume??"?"} ${e.unite||""}`.trim(),"06",i));
  lst(M,"08").forEach((x,i)=>add("s"+i,"stock",x.nom,`${x.niveau??"?"} ${x.unite||""} · ${x.rotation??"?"} j`,"08",i));
  lst(M,"10").forEach((x,i)=>add("o"+i,"sortie",x.nom,`${x.valeur??"?"}${x.induite==="yes"?" · induced":""}`,"10",i));

  const matiere=[...nodes];
  const trouve=n=>matiere.find(x=>norm(x.label)===norm(n));
  const ext={};
  const resoudre=(n)=>{ if(!n) return null;
    const t=trouve(n); if(t) return t.id;
    const k=norm(n); if(!ext[k]){ext[k]=add("x"+Object.keys(ext).length,"ext",n,"not modelled","09",-1);}
    return ext[k]; };

  const fluxIdx={};
  lst(M,"09").forEach((f,i)=>{
    const a=resoudre(f.de), b=resoudre(f.vers);
    if(a&&b&&a!==b){ edges.push({a,b,t:"flux",lab:`${f.debit??""} ${f.unite||""}`.trim(),org:"09",idx:i});
      fluxIdx[norm(f.nom)]={a,b}; }
  });

  const R13=lst(M,"13"), L11=lst(M,"11");
  if(R13.length) add("R","regle","Transformation rules",
    `${R13.length} rule${R13.length>1?"s":""} · ${R13.filter(x=>x.nonlin==="yes").length} non-linear`,"13",null);
  if(L11.length) add("L","levier","Levers",
    `${L11.length} lever${L11.length>1?"s":""} · ${new Set(L11.map(x=>x.acteur).filter(Boolean)).size} owner(s)`,"11",null);
  lst(M,"15").forEach((c,i)=>add("c"+i,"capteur",c.nom,`±${c.bruit??"?"} · ${c.latence??"?"} j`,"15",i));

  const P=obj(M,"17"), E=obj(M,"16"), O=obj(M,"02");
  const aEcart = E.mesure!==undefined && E.mesure!=="";
  const aPol   = P.cadence!==undefined && P.cadence!=="";
  if(aEcart) add("ec","ecart","Gap",`${E.mesure} vs target ${O.cible??"?"}`,"16",-1);
  if(aPol)   add("po","polit","Policy",`every ${P.cadence} d · ±${P.bande??"?"}`,"17",-1);

  lst(M,"15").forEach((c,i)=>{ const src=c.mesure?trouve(c.mesure):null;
    if(src) edges.push({a:src.id,b:"c"+i,t:"mesure",org:"15",idx:i});
    if(aEcart) edges.push({a:"c"+i,b:"ec",t:"mesure",org:"16",idx:-1}); });
  if(aEcart&&aPol) edges.push({a:"ec",b:"po",t:"mesure",org:"17",idx:-1});
  if(aPol && L11.length) edges.push({a:"po",b:"L",t:"ctrl",org:"11",idx:null});
  if(L11.length && R13.length) edges.push({a:"L",b:"R",t:"ctrl",org:"13",idx:null});
  R13.forEach(r=>{ const f=fluxIdx[norm(r.porte)];
    if(f && !edges.some(e=>e.t==="gouv"&&e.b===f.b&&e.src===f.a))
      edges.push({a:"R",b:f.b,src:f.a,t:"gouv",org:"09",idx:-1}); });

  return {nodes,edges};
}

/* ---- layered layout, simplified Sugiyama ---- */
const GAP=104, COLW=NW+GAP, ROWH=116, MARG=34, CANAL=52;
const BANDE=52;   /* gouttière entre deux bandes */

function layout({nodes,edges}){
  const MATK=["entree","stock","sortie","ext"];
  const mat=nodes.filter(n=>MATK.includes(n.kind));
  const ids=new Set(mat.map(n=>n.id));
  const fl=edges.filter(e=>e.t==="flux"&&ids.has(e.a)&&ids.has(e.b));

  /* 0 - strip back edges: a matter loop would break the layering */
  const adjF={}; fl.forEach(e=>{(adjF[e.a]=adjF[e.a]||[]).push(e);});
  const vus={},pile={},retour=new Set();
  const dfs=id=>{vus[id]=1;pile[id]=1;
    (adjF[id]||[]).forEach(e=>{ if(pile[e.b]) retour.add(e.a+">"+e.b);
      else if(!vus[e.b]) dfs(e.b); }); pile[id]=0;};
  mat.forEach(n=>{if(!vus[n.id])dfs(n.id);});
  const dag=fl.filter(e=>!retour.has(e.a+">"+e.b));

  /* 1 - layers by longest path */
  const col={}; mat.forEach(n=>col[n.id]=0);
  for(let k=0;k<mat.length+1;k++){ let ch=false;
    dag.forEach(e=>{ if(col[e.b]<col[e.a]+1){col[e.b]=col[e.a]+1;ch=true;} });
    if(!ch) break; }
  /* nodes untouched by any flow get placed by nature, not left in column 0 */
  const touche=new Set(); fl.forEach(e=>{touche.add(e.a);touche.add(e.b);});
  let nbCol=mat.length?Math.max(...mat.map(n=>col[n.id]))+1:1;
  const orphelins=mat.filter(n=>!touche.has(n.id));
  if(orphelins.length){
    const parNat={entree:0,ext:0,stock:Math.max(1,Math.floor((nbCol-1)/2)),sortie:nbCol-1};
    orphelins.forEach(n=>{col[n.id]=parNat[n.kind]??0;});
    nbCol=Math.max(...mat.map(n=>col[n.id]))+1;
  }

  /* 2 - dummy nodes for edges spanning layers */
  const couches=Array.from({length:nbCol},()=>[]);
  mat.forEach(n=>couches[col[n.id]].push({id:n.id,reel:true}));
  const chemins={};
  dag.forEach((e,i)=>{
    const ca=col[e.a], cb=col[e.b], ch=[e.a];
    for(let c=ca+1;c<cb;c++){ const d="d"+i+"_"+c; couches[c].push({id:d,reel:false}); ch.push(d); }
    ch.push(e.b); chemins[e.a+">"+e.b]=ch;
  });

  /* 3 - barycentre ordering, four sweeps */
  const rang={}; couches.forEach(c=>c.forEach((n,i)=>rang[n.id]=i));
  const liens=[]; Object.values(chemins).forEach(ch=>{
    for(let i=0;i<ch.length-1;i++) liens.push([ch[i],ch[i+1]]); });
  const colDe={}; couches.forEach((c,ci)=>c.forEach(n=>colDe[n.id]=ci));
  const bary=(id,sens)=>{ const v=liens.filter(l=>l[sens?0:1]===id).map(l=>rang[l[sens?1:0]]);
    return v.length?v.reduce((a,b)=>a+b,0)/v.length:rang[id]; };
  for(let it=0;it<4;it++){
    const ordre=it%2? [...couches.keys()].reverse() : [...couches.keys()];
    ordre.forEach(ci=>{
      couches[ci]=[...couches[ci]].sort((a,b)=>bary(a.id,it%2)-bary(b.id,it%2));
      couches[ci].forEach((n,i)=>rang[n.id]=i); });
  }

  /* 4 - coordinates */
  const pos={}, dum={};
  couches.forEach((c,ci)=>c.forEach((n,i)=>{
    const x=MARG+ci*COLW, y=MARG+i*ROWH;
    if(n.reel) pos[n.id]={x,y,cx:x+NW/2,cy:y+NH/2};
    else dum[n.id]={x:x+NW/2,y:y+NH/2,col:ci};
  }));
  const hMat=Math.max(1,...couches.map(c=>c.length))*ROWH+MARG;
  const wMat=nbCol*COLW+MARG;

  /* 5 - machinery and control bands, laid out in wrapped rows like the theory diagram */
  const retourY=hMat+4;
  const laneY=hMat+BANDE/2;
  const parLigne=Math.max(3,Math.min(5,nbCol));
  const poser=(liste,y0)=>{
    liste.forEach((n,i)=>{
      const x=MARG+(i%parLigne)*COLW, y=y0+Math.floor(i/parLigne)*ROWH;
      pos[n.id]={x,y,cx:x+NW/2,cy:y+NH/2};});
    return liste.length?y0+Math.ceil(liste.length/parLigne)*ROWH:y0;
  };
  const regles=nodes.filter(n=>n.kind==="regle");
  const chaine=nodes.filter(n=>["levier","polit","ecart","capteur"].includes(n.kind))
    .sort((a,b)=>["levier","polit","ecart","capteur"].indexOf(a.kind)
                -["levier","polit","ecart","capteur"].indexOf(b.kind));
  const yR=laneY+BANDE/2+6;
  const finR=poser(regles,yR);
  const laneY2=regles.length?finR-ROWH+NH+BANDE/2+10:finR;
  const yC=regles.length?laneY2+BANDE/2+6:yR;
  const finC=poser(chaine,yC);
  const miniY=yC-18;

  const W=Math.max(wMat,parLigne*COLW+MARG)+CANAL+14;
  const H=(chaine.length?finC-ROWH+NH:yC)+MARG+10;
  return {pos,dum,chemins,retour,retourY,col,colDe,W,H,laneY,laneY2:regles.length?laneY2:null,
          miniY,canalX:W-CANAL+8,nbCol};
}

const lirePts=d=>{const p=[];const re=/([ML])\s*([-\d.]+)[ ,]+([-\d.]+)|Q\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([-\d.]+)[ ,]+([-\d.]+)/g;
  let m;while((m=re.exec(d))){ p.push(m[1]?[+m[2],+m[3]]:[+m[4],+m[5]]); } return p;};

/* ---- orthogonal routing, rounded corners ---- */
function ortho(pts,r=9){
  const p=[pts[0]];
  for(let i=1;i<pts.length;i++){const a=p[p.length-1],b=pts[i];
    if(Math.abs(a[0]-b[0])<0.5&&Math.abs(a[1]-b[1])<0.5) continue;
    p.push(b);}
  const q=[p[0]];
  for(let i=1;i<p.length-1;i++){const a=p[i-1],c=p[i],n=p[i+1];
    const col1=Math.abs(a[0]-c[0])<0.5&&Math.abs(c[0]-n[0])<0.5;
    const lig=Math.abs(a[1]-c[1])<0.5&&Math.abs(c[1]-n[1])<0.5;
    if(!col1&&!lig) q.push(c); else if(!(col1||lig)) q.push(c);}
  q.push(p[p.length-1]);
  if(q.length<3) return `M ${q[0][0]} ${q[0][1]} L ${q[q.length-1][0]} ${q[q.length-1][1]}`;
  const d=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
  const vers=(c,t,k)=>{const L=d(c,t)||1;return [c[0]+(t[0]-c[0])*k/L,c[1]+(t[1]-c[1])*k/L];};
  let s=`M ${q[0][0]} ${q[0][1]}`;
  for(let i=1;i<q.length-1;i++){const a=q[i-1],c=q[i],n=q[i+1];
    const k=Math.min(r,d(a,c)/2,d(c,n)/2);
    const u=vers(c,a,k), v=vers(c,n,k);
    s+=` L ${u[0].toFixed(1)} ${u[1].toFixed(1)} Q ${c[0]} ${c[1]} ${v[0].toFixed(1)} ${v[1].toFixed(1)}`;}
  s+=` L ${q[q.length-1][0]} ${q[q.length-1][1]}`;
  return s;
}
/* ================== MODEL GRAPH ================== */
/* ---- edge routing, shared by the workshop and the manual ---- */
function tracerGraphe(g,L){
  const {pos,dum,chemins,retour,retourY,W,H,laneY,laneY2,miniY,canalX,nbCol}=L;
  const traces=[];
  const centre=id=>pos[id]?{x:pos[id].cx,y:pos[id].cy}:(dum[id]?{x:dum[id].x,y:dum[id].y}:null);
  const colDeId=id=>pos[id]?Math.round((pos[id].x-MARG)/COLW):(dum[id]?dum[id].col:0);
  /* ---- vertical channels: one offset per edge sharing a gutter ---- */
  const comptGout={};
  const goutX=(ci,key)=>{const base=MARG+ci*COLW+NW+GAP/2;
    if(comptGout[ci]===undefined) comptGout[ci]={n:0,k:{}};
    if(comptGout[ci].k[key]===undefined){comptGout[ci].k[key]=comptGout[ci].n;comptGout[ci].n++;}
    const i=comptGout[ci].k[key];
    return base+((i%2?1:-1)*Math.ceil(i/2)*11);};


  /* ---- routing helpers: never cross a box ---- */
  const boites=Object.values(pos);
  const colLibre=x=>!boites.some(p=>x>p.x-10 && x<p.x+NW+10);
  const ligneLibre=y=>!boites.some(p=>y>p.y-10 && y<p.y+NH+10);
  const gouttiere=x=>{ if(colLibre(x)) return x;
    const c=[]; for(let k=-1;k<=nbCol+2;k++) c.push(MARG+k*COLW-GAP/2);
    const l=c.filter(colLibre);
    return l.length? l.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a) : x; };
  const couloir=y=>{ if(ligneLibre(y)) return y;
    for(let d=8;d<600;d+=8){ if(ligneLibre(y-d)) return y-d; if(ligneLibre(y+d)) return y+d; }
    return y; };
  /* relie deux boîtes en passant par une gouttière verticale et un couloir horizontal libres */
  const lien=(A,B,yPref)=>{
    const gx=gouttiere(B.x>A.x ? B.x-GAP/2 : B.x+NW+GAP/2);
    const cy=couloir(yPref);
    const sortie=[A.cx, cy<A.y ? A.y : A.y+NH];
    const entree=[B.x>A.x||Math.abs(B.x-A.x)<4 ? (gx<B.x?B.x:B.x+NW) : B.x+NW, B.cy];
    return ortho([sortie,[A.cx,cy],[gx,cy],[gx,B.cy],entree]);
  };

  /* matter flows */
  const fluxE=g.edges.filter(e=>e.t==="flux");
  fluxE.forEach((e,i)=>{
    const cle=e.a+">"+e.b;
    if(retour&&retour.has(cle)){
      const A=pos[e.a],B=pos[e.b]; if(!A||!B) return;
      const y=couloir(retourY+(i%3)*6);
      const gA=gouttiere(A.x+NW+GAP/2), gB=gouttiere(B.x+NW+GAP/2);
      traces.push({d:ortho([[A.x+NW,A.cy],[gA,A.cy],[gA,y],[gB,y],[gB,B.cy],[B.x+NW,B.cy]]),
        t:"retour",lab:e.lab,mx:[(gA+gB)/2,y+13]});
      return;
    }
    const ch=chemins[cle];
    if(!ch) return;
    const pts=[]; const a0=pos[ch[0]]; if(!a0) return;
    pts.push([a0.x+NW,a0.cy]);
    for(let k=0;k<ch.length-1;k++){
      const u=centre(ch[k]), v=centre(ch[k+1]); if(!u||!v) return;
      const gx=goutX(colDeId(ch[k]),e.a+">"+e.b);
      pts.push([gx,u.y]); pts.push([gx,v.y]);
    }
    const b=pos[ch[ch.length-1]]; if(!b) return;
    pts.push([b.x,b.cy]);
    traces.push({d:ortho(pts),t:"flux",lab:e.lab,mx:pts[Math.floor(pts.length/2)]});
  });

  /* measured output to sensor: reserved right channel, then a free lane */
  g.edges.filter(e=>e.t==="mesure").forEach(e=>{
    const A=pos[e.a],B=pos[e.b]; if(!A||!B) return;
    /* sort par le bas dans l'entre-deux-rangées, file par le canal réservé,
       puis entre par le haut du capteur — que des couloirs libres */
    const ly=couloir(A.y+NH+(ROWH-NH)/2);
    const cy=couloir(B.y-BANDE/2);
    traces.push({d:ortho([[A.cx,A.y+NH],[A.cx,ly],[canalX,ly],[canalX,cy],
                          [B.cx,cy],[B.cx,B.y]]),t:"mesure"});
  });

  /* policy to lever, lever to rule */
  g.edges.filter(e=>e.t==="ctrl").forEach(e=>{
    const A=pos[e.a],B=pos[e.b]; if(!A||!B) return;
    /* même rangée : trait droit, quelle que soit la distance, si rien ne s'interpose */
    if(Math.abs(A.cy-B.cy)<6){
      const x1=A.x<B.x?A.x+NW:A.x, x2=A.x<B.x?B.x:B.x+NW;
      if(!boites.some(p=>p!==A&&p!==B&&Math.max(x1,x2)>p.x+6&&Math.min(x1,x2)<p.x+NW-6
          &&A.cy>p.y+6&&A.cy<p.y+NH-6)){
        traces.push({d:ortho([[x1,A.cy],[x2,B.cy]]),t:"ctrl"}); return; }
    }
    /* colonnes alignées : trait vertical droit */
    if(Math.abs(A.cx-B.cx)<6){
      const y1=A.y<B.y?A.y+NH:A.y, y2=A.y<B.y?B.y:B.y+NH;
      if(!boites.some(p=>p!==A&&p!==B&&Math.max(y1,y2)>p.y+6&&Math.min(y1,y2)<p.y+NH-6
          &&A.cx>p.x+6&&A.cx<p.x+NW-6)){
        traces.push({d:ortho([[A.cx,y1],[B.cx,y2]]),t:"ctrl"}); return; }
    }
    /* sinon un seul coude, par la gouttière la plus proche */
    const gx=gouttiere(B.x>A.x?B.x-GAP/2:B.x+NW+GAP/2);
    traces.push({d:ortho([[A.cx,A.cy<B.cy?A.y+NH:A.y],[A.cx,B.cy],[gx,B.cy],
                          [gx<B.x?B.x:B.x+NW,B.cy]]),t:"ctrl"});
  });

  /* rule to governed flow: climbs via the horizontal lane */
  /* a rule points at the FLOW it governs, never at a node: the last segment climbs
     a column gutter, which by construction holds nothing. */
  g.edges.filter(e=>e.t==="gouv").forEach((e,i)=>{
    const A=pos[e.a], B=pos[e.b], S=pos[e.src]||dum[e.src];
    if(!A||!B) return;
    const bx=B.x, sx=S?(S.x!==undefined?S.x:S.x):null;
    let gx;
    if(sx===null || Math.abs(sx-bx)<4) gx=bx-GAP/2;
    else gx = sx<bx ? (sx+NW+bx)/2 : (bx+NW+sx)/2;
    gx=Math.max(MARG-GAP/2+4, gx);
    /* si la verticale tomberait dans une boîte, on la repousse dans la gouttière la plus proche */
    const dansUneBoite=x=>Object.values(pos).some(p=>x>p.x-6 && x<p.x+NW+6);
    if(dansUneBoite(gx)){
      const cand=[];
      for(let c=-1;c<=nbCol;c++) cand.push(MARG+c*COLW-GAP/2);
      const libre=cand.filter(x=>!dansUneBoite(x));
      if(libre.length) gx=libre.reduce((a,b)=>Math.abs(b-gx)<Math.abs(a-gx)?b:a);
    }
    const y=Math.min(laneY+(i%3)*6, A.y-14);   /* toujours dans la gouttière, jamais sur une boîte */
    traces.push({d:ortho([[A.cx,A.y],[A.cx,y],[gx,y],[gx,B.cy+4]]),t:"gouv"});
  });

  /* RÈGLE D'OR — aucun segment ne traverse une boîte. Dernier filet : on relit chaque
     tracé et on décale le segment fautif vers le couloir libre le plus proche. */
  const traverse=(x1,y1,x2,y2)=>boites.find(p=>
    Math.max(x1,x2)>p.x+6 && Math.min(x1,x2)<p.x+NW-6 &&
    Math.max(y1,y2)>p.y+6 && Math.min(y1,y2)<p.y+NH-6);
  traces.forEach(t=>{
    const pts=lirePts(t.d); if(pts.length<2) return;
    let change=false;
    for(let k=1;k<pts.length-1;k++){
      const [x1,y1]=pts[k-1],[x2,y2]=pts[k];
      if(!traverse(x1,y1,x2,y2)) continue;
      if(Math.abs(y1-y2)<2){ const ny=couloir(y1);
        if(ny!==y1){pts[k-1][1]=ny;pts[k][1]=ny;change=true;} }
      else { const nx=gouttiere(x1);
        if(nx!==x1){pts[k-1][0]=nx;pts[k][0]=nx;change=true;} }
    }
    if(change) t.d=ortho(pts);
  });

  return traces;
}

const STYLE_G={flux:{c:"#9C8A84",w:1.8,d:null},retour:{c:"#9C8A84",w:1.6,d:"7 4"},
  gouv:{c:"#B0572E",w:1.5,d:"2 4"},mesure:{c:"#9578A6",w:1.5,d:"5 4"},
  ctrl:{c:"#C39B4E",w:1.5,d:"5 4"}};

function Schema({M,pop,onPick,onFermer,onOuvrir,maj,reg,sysNom,restaurer}){
  const g=useMemo(()=>buildGraph(M),[M]);
  const L=useMemo(()=>layout(g),[g]);
  const {pos,dum,chemins,retour,retourY,W,H,laneY,laneY2,miniY,canalX,nbCol}=L;

  /* le popup est positionné dans le repère de l'écran : il reste entièrement visible
     même quand le nœud est en bas ou à droite du canevas défilant */
  const cvRef=useRef(null);
  const [vp,setVp]=useState(null);
  const vide=!g.nodes.length;
  useEffect(()=>{
    const placer=()=>{
      if(vide){setVp(null);return;}
      const p=po?pos[po.id]:null;
      if(!p||!cvRef.current){setVp(null);return;}
      const r=cvRef.current.getBoundingClientRect();
      const LP=322, HP=Math.min(520,Math.max(240,window.innerHeight-32));
      let x=r.left+p.x+NW+16;
      if(x+LP>window.innerWidth-14) x=r.left+p.x-LP-16;
      x=Math.max(14,Math.min(x,window.innerWidth-LP-14));
      let y=r.top+p.y-8;
      y=Math.max(14,Math.min(y,window.innerHeight-HP-14));
      setVp({position:"fixed",left:x,top:y,maxHeight:HP});
    };
    placer();
    if(vide||!po) return;
    window.addEventListener("resize",placer,{passive:true});
    window.addEventListener("scroll",placer,true);
    return ()=>{window.removeEventListener("resize",placer);
                window.removeEventListener("scroll",placer,true);};
  },[pop,vide]);

  if(!g.nodes.length) return (
    <div className="sy-empty">Nothing to draw yet. Fill in inputs, stocks, outputs and above all flows — the « from » and « to » fields of each flow are what build the graph.</div>);

  const traces=tracerGraphe(g,L);
  const STYLE={flux:{c:"#9C8A84",w:1.8,d:null},retour:{c:"#9C8A84",w:1.6,d:"7 4"},
               mesure:{c:"#9578A6",w:1.4,d:"5 4"},
               ctrl:{c:"#C39B4E",w:1.4,d:"5 4"},gouv:{c:"#B0572E",w:1.4,d:"2 4"}};
  const popOrgane = estOrganeId(pop) ? pop : null;
  const po = (!popOrgane&&pop) ? g.nodes.find(n=>n.id===pop) : null;


  return (
    <div className="sy-canvas" ref={cvRef} style={{width:W,height:H}} onClick={onFermer}>

      <svg style={{position:"absolute",inset:0,width:W,height:H,pointerEvents:"none"}}>
        <defs>{Object.entries(STYLE).map(([k,v])=>(
          <marker key={k} id={"a-"+k} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6"
            markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke={v.c} strokeWidth="1.7" strokeLinecap="round"/>
          </marker>))}</defs>
        {traces.map((tr,i)=>{const st=STYLE[tr.t];
          return <path key={i} d={tr.d} fill="none" stroke={st.c} strokeWidth={st.w}
            strokeDasharray={st.d||undefined} strokeLinejoin="round" markerEnd={`url(#a-${tr.t})`}/>;})}
        {traces.filter(t=>(t.t==="flux"||t.t==="retour")&&t.lab&&t.mx).map((t,i)=>(
          <text key={"l"+i} x={t.mx[0]} y={t.mx[1]-7} textAnchor="middle" fontSize="9.5"
            fill="#B0A19F" fontFamily="ui-monospace,Menlo,monospace">{t.lab}</text>))}
      </svg>
      {g.nodes.map(n=>{const p=pos[n.id]; if(!p)return null;
        const K=KIND[n.kind];
        const ext=n.kind==="ext";
        const col=ext?"#A08E93":couleurOrgane(n.org);
        return (
          <div key={n.id} className={"sy-gn"+(pop===n.id?" act":"")}
            style={{left:p.x,top:p.y,width:NW,height:NH,
                    background:col+(K.fort?"2E":"1C"),
                    borderColor:col+(K.fort?"C0":"7A"),
                    borderWidth:K.fort?"1.3px 1.3px 1.3px 4px":"1.3px"}}
            onClick={ev=>{ev.stopPropagation();onPick(n.id);}}>
            <span className="gchip" style={{background:col}}>{ext?"··":n.org}</span>
            <div className="gtxt">
              <div className="gk" style={{color:col}}>{K.l.toUpperCase()}</div>
              <div className="gt">{n.label}</div>
              {n.sub && <div className="gs">{n.sub}</div>}
            </div>
          </div>);})}
      {po && <PopEdit organId={po.org} rowIdx={po.idx===null?null:po.idx} titre={po.label}
        reg={reg} sysNom={sysNom} restaurer={restaurer}
        soustitre={KIND[po.kind].l} couleur={po.kind==="ext"?"#A08E93":couleurOrgane(po.org)} M={M} maj={maj}
        style={vp||{left:-9999,top:-9999}} onFermer={onFermer} onOuvrir={onOuvrir}
        note={po.kind==="ext"?"This name appears in a flow but matches no input, stock or output. Either it sits outside the boundary, or it is a typo in a flow's « from » or « to » field.":null}/>}
    </div>);
}


/* ================== SKL OS EMBED ==================
   The editor's own mechanism workspace — HUD, Build, Model, Organs, Control — mounted inside SKL OS.
   State lives in a module store so it survives the host page re-rendering its frame. */

/* ================== THE OPERATING SYSTEM, MODELLED AS TWO MECHANISMS ==================
   Built with the Iteration-system method that produced Pre-call. One mechanism per clock:
   - Execution steering: event alerts on tasks and decisions, closed in days.
   - Results steering: key results read every week, corrected over weeks.
   Alert rules are not mechanisms: each one is a sensor (organ 15) with its threshold, filed in the
   mechanism it watches. Load and work-in-progress alerts are states, read as constraints (organ 04). */
const OS_EXEC = {
 "01":[{type:"start",nom:"A task rule fires: overdue (a1), blocked over 24 h (a2), over 8 h (a3), timebox used up (a11)"},
       {type:"start",nom:"A decision rule fires: reversible or irreversible decision overdue (a8, a9), review due (a10)"},
       {type:"end",nom:"The alert is closed by the data: task unblocked, split or done"},
       {type:"end",nom:"The decision is taken"},
       {type:"end",nom:"The alert expires unhandled"}],
 "02":{metrique:"Execution alerts closed within 7 days",cible:85,unite:"% of alerts raised",plancher:70,horizon:"one quarter"},
 "03":{sacrifie:"When the week fills up, alert triage is the first thing skipped; owners keep shipping tasks and leave blocked ones waiting",
       revele:"Keep tasks moving, not clear what blocks them. Activity is protected, unblocking gives way"},
 "04":[{nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,preuve:"benchmark"},
       {nom:"Team planned load (read by rules a4, a13, a14)",nature:"throughput",unite:"h/7 days",borne:82,charge:62,seuil:57,preuve:"measured"},
       {nom:"Lead available to receive escalations",nature:"presence",unite:"person",borne:1,charge:1,seuil:7,preuve:"measured"}],
 "05":{nom:"Romain · CPO",
       autorite:"Task and decision alert rules, the escalation delay, who owns each alert, the snooze rule",
       refus:"yes"},
 "06":[{nom:"Task alerts",volume:18,unite:"per week",varia:"±6 · doubles in a launch week",source:"Tasks in My Day and Roadmap"},
       {nom:"Decision alerts",volume:6,unite:"per week",varia:"±2",source:"Decisions board"}],
 "07":[{nom:"A launch week pulls everyone into execution",gravite:"high",obs:"yes"},
       {nom:"The lead is away: escalations have no receiver",gravite:"high",obs:"yes"},
       {nom:"Tasks created without a date or an owner",gravite:"medium",obs:"yes"},
       {nom:"Shared database unavailable",gravite:"low",obs:"no"}],
 "08":[{nom:"Open alerts",niveau:12,rotation:2,unite:"alerts"},
       {nom:"Decisions waiting",niveau:8,rotation:4,unite:"decisions"}],
 "09":[{nom:"Triage",de:"Task alerts",vers:"Open alerts",debit:18,unite:"/wk"},
       {nom:"Fixed at the source",de:"Open alerts",vers:"Closed by the data",debit:13,unite:"/wk"},
       {nom:"Expired unhandled",de:"Open alerts",vers:"Expired unhandled",debit:1,unite:"/wk"},
       {nom:"Escalated or framed as a decision",de:"Open alerts",vers:"Decisions waiting",debit:4,unite:"/wk"},
       {nom:"Decision due",de:"Decision alerts",vers:"Decisions waiting",debit:6,unite:"/wk"},
       {nom:"Decided",de:"Decisions waiting",vers:"Decision taken",debit:10,unite:"/wk"},
       {nom:"Read but not acted on",de:"Open alerts",vers:"Alert fatigue",debit:3,unite:"/wk"},
       {nom:"Leads' triage time",de:"Decisions waiting",vers:"Leadership time on escalations",debit:150,unite:"min/wk"},
       {nom:"The decision unblocks tasks, which raises or removes the next alerts",de:"Decision taken",vers:"Task alerts",debit:10,unite:"/wk"}],
 "10":[{nom:"Closed by the data",valeur:13,dest:"The steered mechanisms (task unblocked, split or done)",induite:"no"},
       {nom:"Decision taken",valeur:10,dest:"Results steering (plan of the key result)",induite:"no"},
       {nom:"Expired unhandled",valeur:1,dest:"Quarter close (lesson only)",induite:"no"},
       {nom:"Leadership time on escalations",valeur:150,dest:"Founder's attention",induite:"yes"},
       {nom:"Alert fatigue",valeur:3,dest:"Trust in the OS",induite:"yes"}],
 "11":[{nom:"Escalation delay for Critical and High alerts (24 h)",
        agit:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",acteur:"Romain"},
       {nom:"Blocked threshold (a2, 24 h) and task size cap (a3, 8 h)",
        agit:"A task over 8 h is three times more likely to block than two tasks of 4 h",acteur:"Romain"},
       {nom:"Decision lead time (48 h reversible, 7 d irreversible)",
        agit:"A decision taken within its lead time unblocks about 2 tasks",acteur:"Romain"},
       {nom:"Snooze allowed once per alert",
        agit:"A second snooze ends in expiry three times out of four",acteur:"Romain"}],
 "12":[{nom:"Medium and Low alerts never escalate",raison:"Protect the leads' triage time",
        degel:"If a Medium alert stays open over 14 days three times in a quarter"},
       {nom:"Tasks capped at 8 h, unknown work as a timeboxed exploration",raison:"Keeps cycle time readable",
        degel:"If cycle time stays above 5 days for 4 weeks"},
       {nom:"One owner per alert",raison:"An alert owned by two people is owned by nobody",
        degel:"Never: change who owns it instead"}],
 "13":[{nom:"An alert left unowned beyond 24 h loses half its chance of being closed by the data within the week",
        porte:"Fixed at the source",nonlin:"yes",usage:"intervene"},
       {nom:"A task over 8 h is three times more likely to block than two tasks of 4 h",
        porte:"Triage",nonlin:"yes",usage:"intervene"},
       {nom:"Escalation converts about 3 in 4 escalated alerts into a decision within the week",
        porte:"Escalated or framed as a decision",nonlin:"no",usage:"predict"},
       {nom:"A decision taken within its lead time unblocks about 2 tasks",
        porte:"Decided",nonlin:"no",usage:"predict"},
       {nom:"A second snooze ends in expiry three times out of four",
        porte:"Expired unhandled",nonlin:"yes",usage:"intervene"}],
 "14":{processus:3,capteur:1},
 "15":[{nom:"Alert log",mesure:"Closed by the data",latence:0,bruit:3,unite:"pts of closure rate",
        saisie:"Automatic: an alert closes when the data behind it is fixed"},
       {nom:"Decision log",mesure:"Decision taken",latence:1,bruit:2,unite:"pts of closure rate",
        saisie:"The decision owner, when the decision moves to Decided"},
       {nom:"Task rules · a1 overdue · a2 blocked > 24 h · a3 over 8 h · a11 timebox",mesure:"Open alerts",latence:0,bruit:3,unite:"alerts",
        saisie:"Automatic, from tasks in My Day and Roadmap"},
       {nom:"Decision rules · a8 · a9 overdue · a10 review due",mesure:"Decisions waiting",latence:0,bruit:1,unite:"decisions",
        saisie:"Automatic, from the Decisions board"}],
 "16":{mesure:74,fenetre:2},
 "17":{cadence:7,bande:5,gain:1,
       inaction:"Nothing. Rules and thresholds stay as they are; alerts keep flowing to their owners in My Day."},
 "18":[{nom:"Alert open > 24 h → escalated → decision taken → task unblocked → alert closed",type:"balancing",delai:3},
       {nom:"Load > 70 % → tasks late → more alerts → more triage time → less time to execute → load ↑",type:"reinforcing",delai:14}],
 "19":[{valeur:"Open alerts and decisions waiting",niveau:"measured",date:"live in the OS"},
       {valeur:"Planned load 76 % for the team",niveau:"measured",date:"live in My Day"},
       {valeur:"Task over 8 h three times more likely to block",niveau:"benchmark",date:"flow literature"},
       {valeur:"Escalation converts 3 in 4 into a decision",niveau:"hunch",date:"—"},
       {valeur:"Cycle time 3.4 days",niveau:"hunch",date:"sample data until phase 4"}],
 "20":[{nom:"Alert closure time does not depend on who owns the alert",test:"Compare closure time by owner over one quarter"},
       {nom:"Escalation speed does not depend on the day of the week",test:"Cross escalation-to-decision time with the weekday the alert fired"}],
 "21":[{nom:"Key result alerts (a5, a6, a7)",raison:"Weekly clock: they belong to Results steering",
        signal:"If a key result alert closes in under 3 days, three times in a quarter"},
       {nom:"The steered mechanisms themselves (Pre-call, Sales…)",raison:"Different owners, their own clocks",
        signal:"If more than half of the alerts come from one mechanism three weeks running"}]
};
const OS_RES = {
 "01":[{type:"start",nom:"A key result is read at its weekly check-in, or the stale rule (a7) fires after 7 days without one"},
       {type:"end",nom:"The key result is read on plan"},
       {type:"end",nom:"The key result comes back on plan after a recovery"},
       {type:"end",nom:"The plan changes: recovery plan, target or owner, decided at the Saturday call"},
       {type:"end",nom:"The key result is kept off plan by an explicit go"}],
 "02":{metrique:"Key results on plan at the weekly read",cible:80,unite:"% of key results",plancher:60,horizon:"one quarter"},
 "03":{sacrifie:"Under pressure, the check-in is skipped before the work is: an off-plan key result goes unread rather than being declared",
       revele:"Avoid declaring a key result off plan. Silence is preferred to a red status"},
 "04":[{nom:"Saturday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,preuve:"measured"},
       {nom:"Weeks left in the quarter",nature:"depleting stock",unite:"weeks",borne:10,charge:1,seuil:3,preuve:"measured"},
       {nom:"Owners' check-in time",nature:"throughput",unite:"min/week",borne:75,charge:40,seuil:60,preuve:"hunch"}],
 "05":{nom:"Amin · CEO",
       autorite:"The go / no-go call, recovery plans, changing a target or an owner, the KR colour rule",
       refus:"yes"},
 "06":[{nom:"Weekly key result readings",volume:5,unite:"per week",varia:"one per key result",source:"Roadmap check-ins, and rule a7 when one is missing"}],
 "07":[{nom:"A key result whose data arrives monthly, not weekly",gravite:"high",obs:"yes"},
       {nom:"A launch moves the curve by steps, not by slope",gravite:"medium",obs:"yes"},
       {nom:"The owner is away on Saturday",gravite:"medium",obs:"yes"},
       {nom:"A target is copied from another quarter without a baseline",gravite:"low",obs:"no"}],
 "08":[{nom:"Key results off plan",niveau:3,rotation:21,unite:"key results"},
       {nom:"Key results not tracked",niveau:1,rotation:7,unite:"key results"}],
 "09":[{nom:"Check-in on plan",de:"Weekly key result readings",vers:"Read on plan",debit:2,unite:"/wk"},
       {nom:"Check-in off plan (a5, a6)",de:"Weekly key result readings",vers:"Key results off plan",debit:2,unite:"/wk"},
       {nom:"No check-in (a7)",de:"Weekly key result readings",vers:"Key results not tracked",debit:1,unite:"/wk"},
       {nom:"Checked in late",de:"Key results not tracked",vers:"Key results off plan",debit:1,unite:"/wk"},
       {nom:"Back on plan",de:"Key results off plan",vers:"Back on plan",debit:1,unite:"/wk"},
       {nom:"No-go: recovery plan decided",de:"Key results off plan",vers:"Plan changed",debit:1,unite:"/wk"},
       {nom:"Go despite the gap",de:"Key results off plan",vers:"Kept off plan by a go",debit:1,unite:"/wk"},
       {nom:"Recovery actions",de:"Plan changed",vers:"Recovery actions sent to execution",debit:6,unite:"actions/wk"},
       {nom:"The changed plan sets a new expected value for the next reading",de:"Plan changed",vers:"Weekly key result readings",debit:1,unite:"/wk"}],
 "10":[{nom:"Read on plan",valeur:2,dest:"Cockpit · On track",induite:"no"},
       {nom:"Back on plan",valeur:1,dest:"Cockpit · On track",induite:"no"},
       {nom:"Plan changed",valeur:1,dest:"Roadmap (recovery plan, target or owner)",induite:"no"},
       {nom:"Kept off plan by a go",valeur:1,dest:"Weekly Review (written down, read again next Saturday)",induite:"no"},
       {nom:"Recovery actions sent to execution",valeur:6,dest:"Execution steering (new tasks)",induite:"yes"}],
 "11":[{nom:"KR colour thresholds (landing below 90 % = red, behind plan below 0.9 = recovering)",
        agit:"Confidence below 5 / 10 predicts an off-plan reading two weeks later",acteur:"Amin"},
       {nom:"Stale check-in threshold (7 days)",
        agit:"Each missed check-in delays detection by a week and doubles the recovery needed",acteur:"Amin"},
       {nom:"Recovery plan due within one week of a no-go",
        agit:"A no-go followed by a recovery plan within a week brings 1 key result in 2 back on plan within 4 weeks",acteur:"Amin"},
       {nom:"Mid-point review at W6: keep or pivot the initiatives",
        agit:"A key result off plan for 3 weeks without a recovery plan almost never comes back",acteur:"Amin"}],
 "12":[{nom:"Quarter of 13 weeks",raison:"Same clock for every objective",degel:"If two key results are rewritten mid-quarter"},
       {nom:"Target fixed after W2, except through a decision",raison:"Stops targets from drifting towards the result",
        degel:"If more than one target change per quarter is needed"},
       {nom:"2 to 5 initiatives per key result",raison:"Focus",degel:"If a key result needs a sixth bet to cover its gap"}],
 "13":[{nom:"A key result off plan for 3 weeks without a recovery plan almost never comes back",
        porte:"Back on plan",nonlin:"yes",usage:"intervene"},
       {nom:"A no-go followed by a recovery plan within a week brings 1 key result in 2 back on plan within 4 weeks",
        porte:"No-go: recovery plan decided",nonlin:"no",usage:"intervene"},
       {nom:"Each missed check-in delays detection by a week and doubles the recovery needed",
        porte:"No check-in (a7)",nonlin:"yes",usage:"intervene"},
       {nom:"Confidence below 5 / 10 predicts an off-plan reading two weeks later",
        porte:"Check-in off plan (a5, a6)",nonlin:"no",usage:"predict"}],
 "14":{processus:14,capteur:7},
 "15":[{nom:"Weekly check-ins",mesure:"Read on plan",latence:3,bruit:20,unite:"pts (one key result = 20)",
        saisie:"Each key result owner, before Saturday"},
       {nom:"Status rule · a5 off track · a6 at risk or recovering",mesure:"Key results off plan",latence:0,bruit:0,unite:"key results",
        saisie:"Automatic, from the forecast in the Cockpit"},
       {nom:"Stale rule · a7 no check-in for 7 days",mesure:"Key results not tracked",latence:0,bruit:0,unite:"key results",
        saisie:"Automatic"}],
 "16":{mesure:40,fenetre:2},
 "17":{cadence:21,bande:25,gain:1,
       inaction:"Nothing. The Saturday review reads the statuses every week, but levers and thresholds are only changed every three weeks, once a correction has had time to show."},
 "18":[{nom:"Key result off plan → no-go → recovery plan → pace ↑ → back on plan",type:"balancing",delai:28},
       {nom:"Key result off plan → recovery actions → execution load ↑ → pace ↓ → key result off plan",type:"reinforcing",delai:21}],
 "19":[{valeur:"Key result statuses",niveau:"measured",date:"live in the Cockpit"},
       {valeur:"Landing forecast at the recent pace",niveau:"benchmark",date:"two check-ins needed"},
       {valeur:"1 key result in 2 comes back after a recovery plan",niveau:"hunch",date:"—"},
       {valeur:"Confidence predicts the reading two weeks later",niveau:"hunch",date:"—"}],
 "20":[{nom:"Confidence predicts the next reading whoever the owner",test:"Compare confidence and the reading two weeks later, owner by owner, over one quarter"},
       {nom:"A plan changed mid-quarter does not lower the team's commitment",test:"Compare commitments kept the 3 weeks before and after each plan change"}],
 "21":[{nom:"Task and decision alerts",raison:"Days, not weeks: they belong to Execution steering",
        signal:"If a task alert stays open more than 3 weeks"},
       {nom:"Setting the objectives of the quarter",raison:"A 13-week clock, slower than weekly steering",
        signal:"If a key result is rewritten twice in a quarter"}]
};
CATALOG.push({id:"opexec",nom:"Execution steering",lane:6,col:2,
  quoi:"Turns task and decision alerts into fixes or decisions within days. Part of the Operating System.",
  pre:["tools"]});
CATALOG.push({id:"opres",nom:"Results steering",lane:6,col:3,
  quoi:"Reads every key result each week and changes the plan when one goes off it. Part of the Operating System.",
  pre:["opexec"]});
const OS_IDS = ["s-os-exec","s-os-res"];
const OS_REG = {
 interfaces:[
  {point:"Decisions taken",de:"Execution steering",part:"100 %",vers:"Results steering",mode:"duplication",debit:10,unite:"week",
   def:"A decision changes a plan, a target or an owner of a key result"},
  {point:"Recovery actions",de:"Results steering",part:"100 %",vers:"Execution steering",mode:"duplication",debit:6,unite:"week",
   def:"Induced output — a no-go adds tasks, which raise the next execution alerts"},
  {point:"Leadership time on escalations",de:"Execution steering",part:"100 %",vers:"Founder's attention",mode:"duplication",debit:150,unite:"week (minutes)",
   def:"Induced output — the cost of steering, paid by the leads"}],
 ressources:[
  {nom:"Leadership triage time",nature:"throughput",unite:"min/week",borne:180,charge:150,seuil:140,puisent:"Execution steering",
   note:"CONFIRM — the same two people as Founder's attention"},
  {nom:"Saturday review slot",nature:"throughput",unite:"min/week",borne:60,charge:45,seuil:50,puisent:"Results steering",note:"45-minute agenda, 6 steps"}],
 evenements:[
  {date:"1 Oct 2026",nom:"Inbox merged into My Day",rompt:"Alert handling times before and after are not comparable",rouages:"Execution steering"},
  {date:"1 Oct 2026",nom:"KR colour rule moved to the forecast",rompt:"Status history: reds before this date read differently",rouages:"Results steering"},
  {date:"1 Oct 2026",nom:"Roadmap rebuilt: review and builder",rompt:"How milestones and actions are created",rouages:"Results steering · Execution steering"}],
 acteurs:[
  {nom:"Romain",role:"CPO · owns Execution steering",leviers:"Task and decision alert rules · escalation delay · snooze rule",
   rouages:"Execution steering",note:"",refus:"yes"},
  {nom:"Amin",role:"CEO · owns Results steering",leviers:"Go / no-go call · recovery plans · KR colour rule · targets and owners",
   rouages:"Results steering",note:"",refus:"yes"}]
};
/* Add the Operating System lines to the registers once, without touching anyone else's lines. */
function withOsReg(R){
  const r={...(R||{})};
  Object.keys(OS_REG).forEach(k=>{
    const cur=Array.isArray(r[k])?r[k]:[];
    const key=x=>(x.point||x.nom||"")+"|"+(x.rouages||x.puisent||x.vers||"");
    const have=new Set(cur.map(key));
    r[k]=cur.concat(OS_REG[k].filter(x=>!have.has(key(x))).map(x=>({...x})));
  });
  return r;
}

const SKL_STORE = {
  systemes: normSys([
    {id:"s-preappel",nom:"Pre-call",type:"mechanism",modele:PREAPPEL},
    {id:"s-vente",nom:"Sales",type:"mechanism",modele:DEFAUT},
    {id:"s-os-exec",nom:"Execution steering",type:"mechanism",etape:9,modele:OS_EXEC},
    {id:"s-os-res",nom:"Results steering",type:"mechanism",etape:9,modele:OS_RES}]),
  regData: withOsReg(regSemer(null)),
  ui: {}
};

/* Shared database: one document per mechanism (mech/sys-<id>) and one for the registers (mech/registers),
   stored as JSON text so the editor's deep model never hits the database depth limit. */
const SKL_SYNC = { last: {}, timers: {}, subs: new Set() };
function sklDbPush(){
  const S = window.SKL; if(!S) return;
  const docs = SKL_STORE.systemes.map(x=>["sys-"+x.id, x]).concat([["registers", SKL_STORE.regData]]);
  docs.forEach(([id,val])=>{
    const json = JSON.stringify(val);
    if(SKL_SYNC.last[id]===json) return;
    clearTimeout(SKL_SYNC.timers[id]);
    SKL_SYNC.timers[id] = setTimeout(()=>{
      SKL_SYNC.last[id]=json;
      try{ S.save("mech",{id, json, at:S.iso(S.today), by:S.me||""}); }catch(e){ console.error(e); }
    }, 1200);
  });
}
function sklDbPull(){
  const S = window.SKL; if(!S) return;
  let changed=false;
  S.list("mech").forEach(d=>{
    if(!d || typeof d.json!=="string" || SKL_SYNC.last[d.id]===d.json) return;
    let val; try{ val=JSON.parse(d.json); }catch(e){ return; }
    SKL_SYNC.last[d.id]=d.json;
    if(d.id==="registers"){ SKL_STORE.regData=withOsReg(val); changed=true; return; }
    if(d.id.indexOf("sys-")!==0 || !val || !val.id || val.id==="s-os") return;
    const i=SKL_STORE.systemes.findIndex(x=>x.id===val.id);
    const n=normSys([val])[0];
    SKL_STORE.systemes = i<0 ? [...SKL_STORE.systemes, n] : SKL_STORE.systemes.map((x,k)=>k===i?n:x);
    changed=true;
  });
  if(changed) SKL_SYNC.subs.forEach(f=>f());
}
function useSklSync(pull){
  useEffect(()=>{ SKL_SYNC.subs.add(pull); return ()=>SKL_SYNC.subs.delete(pull); },[]);
}
(function initSync(){
  // what is already in the demo store counts as saved, so opening a page never writes
  SKL_STORE.systemes.forEach(x=>{ SKL_SYNC.last["sys-"+x.id]=JSON.stringify(x); });
  SKL_SYNC.last.registers=JSON.stringify(SKL_STORE.regData);
  const start=()=>{ if(!window.SKL) return setTimeout(start,50); sklDbPull(); window.SKL.onChange(()=>sklDbPull()); };
  start();
})();

const SKL_CSS = `
.sy.sy-embed{
 --wine-900:#1B1B18;--wine-800:#2C2B26;--wine-700:#1B1B18;--wine-600:#B42318;
 --wine-500:#9A6614;--wine-300:#D9B46A;
 --bone:#F6F4EF;--bone-2:#FFFFFF;--bone-3:#EFECE4;
 --line:#E3DFD5;--line-2:#D8D3C7;
 --ink:#1B1B18;--ink-2:#5E5B53;--ink-3:#8E8A80;
 --grad:linear-gradient(135deg,#1B1B18,#34322C);
 --grad2:linear-gradient(135deg,#FBF6EC,#F4ECDD);
 --dark:linear-gradient(135deg,#2C2B26,#1B1B18);
 --sans:'IBM Plex Sans',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
 --mono:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
 height:var(--screen-h,100vh);width:100%;display:flex;overflow:hidden}
.sy.sy-embed .sy-hud{padding-right:96px}
.sy.sy-embed .sy-delsys{display:none}
.sy.sy-embed .sy-tabs button[data-on="1"]{color:#7A4B00}
.sy.sy-embed .sy-tabs .tbn{margin-left:6px}
`;

function SklMech({sysId,onBack}){
  const u = SKL_STORE.ui[sysId] || (SKL_STORE.ui[sysId] = {});
  const [systemes,setSystemesRaw]=useState(SKL_STORE.systemes);
  const [regData,setRegDataRaw]=useState(SKL_STORE.regData);
  const setSystemes=f=>setSystemesRaw(p=>{const n=typeof f==="function"?f(p):f;SKL_STORE.systemes=n;setTimeout(sklDbPush,0);return n;});
  const setRegData=f=>setRegDataRaw(p=>{const n=typeof f==="function"?f(p):f;SKL_STORE.regData=n;setTimeout(sklDbPush,0);return n;});
  useSklSync(()=>{setSystemesRaw(SKL_STORE.systemes);setRegDataRaw(SKL_STORE.regData);});
  const keep=(k,init)=>{const [v,s]=useState(k in u?u[k]:init);
    return [v,x=>s(p=>{const n=typeof x==="function"?x(p):x;u[k]=n;return n;})];};
  const [vue,setVue]=keep("vue","schema");
  const [sel,setSel]=keep("sel","16");
  const [pop,setPop]=keep("pop",null);
  const [voirExpl,setVoirExpl]=keep("voirExpl",false);
  const [voirRegles,setVoirRegles]=keep("voirRegles",false);
  const [barPliee,setBarPliee]=keep("barPliee",false);
  const [fnOuv,setFnOuv]=keep("fnOuv","frame");
  const [filtre,setFiltre]=keep("filtre",{critique:true,attention:true,veille:true});
  const actif=sysId;

  const sys=systemes.find(s=>s.id===actif);
  const etape=Math.min(Math.max(0,(sys&&sys.etape)||0),BUILD_ET.length-1);
  const setEtape=n=>setSystemes(p=>p.map(x=>x.id===actif
    ?{...x,etape:Math.min(Math.max(0,typeof n==="function"?n(x.etape||0):n),BUILD_ET.length-1)}
    :x));
  const M=sys?sys.modele:{};
  const majM=fn=>setSystemes(p=>p.map(s=>s.id===actif?{...s,modele:fn(s.modele)}:s));
  const nEtapesOk=useMemo(()=>sys?BUILD_ET.filter((_,i)=>etatEtape(i,M,sys,regData).ok).length:0,[M,sys,regData]);
  const notifs=useMemo(()=>calcNotifs(M),[M]);
  const ign=useMemo(()=>carteIgnorance(M),[M]);
  const nCrit=notifs.filter(n=>n.sev==="critique").length;
  const nSocle=fonctionsCouvertes(M);
  const ecartTxt=useMemo(()=>{const e=ecart(M), o=obj(M,"02");
    return e===null?"not computable"
      :`${obj(M,"16").mesure} → ${o.cible} (${e>0?"+":""}${e})`;},[M]);

  const setCh=(id,k,v)=>majM(m=>({...m,[id]:{...obj(m,id),[k]:v}}));
  const setLi=(id,i,k,v)=>majM(m=>{const l=[...lst(m,id)];l[i]={...l[i],[k]:v};return{...m,[id]:l};});
  const addLi=id=>majM(m=>({...m,[id]:[...lst(m,id),{}]}));
  const delLi=(id,i)=>majM(m=>({...m,[id]:lst(m,id).filter((_,j)=>j!==i)}));
  const maj={setCh,setLi,addLi,delLi};
  const SEED_MODELE={"s-preappel":PREAPPEL,"s-vente":DEFAUT,"s-os-exec":OS_EXEC,"s-os-res":OS_RES};
  const srcSeed=SEED_MODELE[actif];
  const restaurer=srcSeed
    ? id=>majM(m=>({...m,[id]:JSON.parse(JSON.stringify(srcSeed[id]||[]))}))
    : null;
  const majReg={
    set:(r,i,k,v)=>setRegData(p=>{const l=[...p[r]];l[i]={...l[i],[k]:v};return{...p,[r]:l};}),
    add:r=>setRegData(p=>({...p,[r]:[...p[r],{}]})),
    seed:r=>setRegData(p=>({...p,[r]:(REG_SEED[r]||[]).map(x=>({...x}))})),
    del:(r,i)=>setRegData(p=>({...p,[r]:p[r].filter((_,j)=>j!==i)}))};
  const setType=t=>setSystemes(p=>p.map(x=>x.id===actif?{...x,type:t}:x));
  const ouvrirOrgane=id=>{setPop(null);setSel(id);setVue("organes");};

  if(!sys) return <div className="sy sy-embed"><style>{CSS+SKL_CSS}</style><div className="sy-empty">No mechanism selected.</div></div>;
  return (
  <div className="sy sy-embed">
    <style>{CSS+SKL_CSS}</style>
    <div className="sy-col">
          <div className="sy-hud">
            {onBack && <button className="sy-b sm" onClick={onBack}>← Map</button>}
            <span className="sy-rd">Mechanism <b>{sys.nom}</b> · {sys.type||"mechanism"}</span>
            <span className="sy-rd">Gap <b>{ecartTxt}</b></span>
            <span className="sy-rd">Ignorance <b>{ign.length}</b> point{ign.length>1?"s":""}</span>
            <span className="sy-rd">Functions <b>{nSocle}</b> / 5</span>
            <span className="sy-rd">Notifications <b>{notifs.length}</b>
              {nCrit>0?<> · <b>{nCrit} crit.</b></>:null}</span>
            <span className="sy-rd">Registers <b>{REG_CLES.map(k=>(regData[k]||[]).length).join(" · ")}</b></span>
            <div className="sy-sp"/>
            <div className="sy-tabs">
              <button data-on={vue==="build"?"1":"0"}
                onClick={()=>{setVue("build");setPop(null);}}>Build
                <i className="tbn" data-fait={nEtapesOk===BUILD_ET.length?"1":"0"}>
                  {String(nEtapesOk).padStart(2,"0")}/{BUILD_ET.length}</i></button>
              <button data-on={vue==="schema"?"1":"0"} onClick={()=>setVue("schema")}>Model</button>
              <button data-on={vue==="organes"?"1":"0"}
                onClick={()=>{setVue("organes");setPop(null);}}>Organs</button>
              <button data-on={vue==="pilotage"?"1":"0"}
                onClick={()=>{setVue("pilotage");setPop(null);}}>Control</button>
            </div>
          </div>

          {vue==="build" ? (
            <Assistant sys={sys} M={M} maj={maj} etape={etape} setEtape={setEtape}
              restaurer={restaurer} setType={setType} regData={regData} majReg={majReg}
              systemes={systemes} onControl={()=>setVue("pilotage")}/>
          ) : vue==="schema" ? (
            <div className="sy-schema">
              <div className="sy-bar" data-plie={barPliee?"1":"0"}>
                <div className="sy-bart">OUTSIDE THE MODEL — THEY FRAME, CONDITION OR ANNOTATE THE MECHANISM
                  <button className="sy-plier" onClick={()=>setBarPliee(v=>!v)}>
                    {barPliee?"show":"hide"}</button></div>
                <div className="sy-db">
                  {ORGANES.filter(x=>x.zone==="barre").map(x=>{const k=kpi(x.id,M);
                    const col=k.etat==="vide"?"var(--line-2)"
                            :k.etat==="alerte"?"var(--wine-600)":"var(--ink)";
                    return (
                      <div key={x.id} className="sy-dbt" data-etat={k.etat}
                        style={{"--fc":k.etat==="vide"?"var(--line-2)":couleurOrgane(x.id)}}
                        onClick={()=>setPop(x.id)}>
                        <span className="dp"/>
                        <div className="dl">{x.id} · {x.nom.toUpperCase()}</div>
                        <div className={"dv"+(k.txt?" txt":"")} style={{color:col}}>{k.v}</div>
                        <div className="ds">{k.sub}</div>
                      </div>);})}
                </div>
                <div className="sy-leg">
                  {Object.values(FAMT).map(f=>(
                    <span key={f.n}><i style={{background:f.c,height:8,width:8,borderRadius:2}}/>{f.n}</span>))}
                  <span style={{opacity:.4}}>│</span>
                  <span><i style={{background:"#9C8A84"}}/>matter flow</span>
                  <span><i style={{background:"#9C8A84",borderTop:"2px dashed #9C8A84",height:0}}/>return flow</span>
                  <span><i style={{background:"#9578A6",borderTop:"2px dashed #9578A6",height:0}}/>measurement</span>
                  <span><i style={{background:"#C39B4E",borderTop:"2px dashed #C39B4E",height:0}}/>command</span>
                  <span><i style={{background:"#B0572E",borderTop:"2px dotted #B0572E",height:0}}/>rule governing a flow</span>
                </div>
              </div>
              <div className="sy-cv">
                <Schema M={M} reg={regData} sysNom={sys.nom} restaurer={restaurer}
                  pop={estOrganeId(pop)?null:pop}
                  onPick={id=>setPop(p=>p===id?null:id)}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane} maj={maj}/>
              </div>
              {estOrganeId(pop) && (
                <PopEdit organId={pop} rowIdx={null} titre={OM[pop].nom} soustitre={OM[pop].ty}
                  couleur={couleurOrgane(pop)} M={M} maj={maj} reg={regData} sysNom={sys.nom}
                  restaurer={restaurer}
                  style={{top:14,right:18}}
                  onFermer={()=>setPop(null)} onOuvrir={ouvrirOrgane}/>)}
            </div>
          ) : vue==="pilotage" ? (
            <Pilotage notifs={notifs} ign={ign} filtre={filtre} setFiltre={setFiltre}
              onOuvrir={ouvrirOrgane}/>
          ) : (
            <div className="sy-view">
              <div className="sy-rail">
                <div className="sy-fam">THE FIVE FUNCTIONS</div>
                {FONCTIONS.map(([cle,nom,verbe])=>{
                  const liste=ORGANES.filter(o=>FN_KEY[o.fam]===cle);
                  const n=liste.filter(o=>estRempli(o,M)).length;
                  const ouvert=fnOuv===cle || liste.some(o=>o.id===sel);
                  return (
                    <div key={cle} className="sy-fnb" data-ouv={ouvert?"1":"0"}
                      style={{"--fc":FAMT[cle].c}}>
                      <button className="fnh" onClick={()=>setFnOuv(v=>v===cle?null:cle)}>
                        <b>{nom}</b><span>{verbe}</span>
                        <i data-ok={n>0?"1":"0"}>{n}/{liste.length}</i>
                        <em>{ouvert?"−":"+"}</em>
                      </button>
                      {ouvert && liste.map(x=>(
                        <button key={x.id} className="sy-o fnx" data-on={sel===x.id?"1":"0"}
                          onClick={()=>setSel(x.id)}>
                          <span className="no">{x.id}</span>
                          <span className="nm">{x.nom}</span>
                          <span className="dot" data-on={estRempli(x,M)?"1":"0"}/>
                        </button>))}
                    </div>);})}
                <div className="sy-railft">
                  Every organ serves exactly one of the five functions. A mechanism that leaves
                  one function unserved cannot be steered, whatever else is filled in.
                </div>
              </div>
              <Fiche o={OM[sel]} M={M} voirExpl={voirExpl} setVoirExpl={setVoirExpl}
                voirRegles={voirRegles} setVoirRegles={setVoirRegles} maj={maj} restaurer={restaurer}/>
            </div>
          )}
    </div>
  </div>);
}

const SKL_PAGES = {"s-preappel":"MechPrecall.dc.html","s-vente":"MechSales.dc.html","s-os-exec":"MechOS.dc.html","s-os-res":"MechOS.dc.html"};
function SklMap(){
  const [systemes,setSys]=useState(SKL_STORE.systemes);
  const [inline,setInline]=useState(SKL_STORE.ui.__mapInline||null);
  useSklSync(()=>setSys(SKL_STORE.systemes));
  const show=id=>{SKL_STORE.ui.__mapInline=id;setInline(id);};
  const aller=id=>{
    const href=SKL_PAGES[id];
    if(OS_IDS.indexOf(id)>=0) SKL_STORE.ui.__osActive=id;
    const a=href&&document.querySelector('a[href="'+href+'"]');
    if(a){a.click();return;}
    show(id);
  };
  const ui=id=>SKL_STORE.ui[id]||(SKL_STORE.ui[id]={});
  if(inline && SKL_STORE.systemes.some(s=>s.id===inline))
    return <SklMech sysId={inline} onBack={()=>{show(null);setSys(SKL_STORE.systemes);}}/>;
  return (
  <div className="sy sy-embed">
    <style>{CSS+SKL_CSS}</style>
    <div className="sy-col">
      <div className="sy-hud">
        <span className="sy-rd">Map <b>{CATALOG.length} mechanisms</b></span>
        <span className="sy-rd">Modelled <b>{systemes.length}</b></span>
        <span className="sy-rd">Domains <b>4</b></span>
        <span className="sy-live"><i className="sy-dot"/>
          <span className="sy-rd">tech tree</span></span>
      </div>
      <CarteMecanismes systemes={systemes} decisions={[]}
        onCreer={nom=>{const id=uid();
          SKL_STORE.systemes=[...SKL_STORE.systemes,{id,nom,type:"chain",modele:{}}];
          Object.assign(ui(id),{vue:"organes",sel:"16",pop:null});
          setSys(SKL_STORE.systemes);sklDbPush();show(id);}}
        onOuvrir={id=>{Object.assign(ui(id),{vue:"schema",pop:null});aller(id);}}
        onCycle={id=>{Object.assign(ui(id),{vue:"pilotage",pop:null});aller(id);}}/>
    </div>
  </div>);
}

/* One page, two mechanisms: a switch sits on the tabs row, the mechanism below keeps its own state. */
function SklMechSwitch({ids}){
  const [cur,setCur]=useState(SKL_STORE.ui.__osActive&&ids.indexOf(SKL_STORE.ui.__osActive)>=0?SKL_STORE.ui.__osActive:ids[0]);
  useEffect(()=>{const t=setInterval(()=>{const a=SKL_STORE.ui.__osActive;if(a&&a!==cur&&ids.indexOf(a)>=0)setCur(a);},300);return ()=>clearInterval(t);},[cur]);
  const pick=id=>{SKL_STORE.ui.__osActive=id;setCur(id);};
  const nom=id=>(SKL_STORE.systemes.find(s=>s.id===id)||{}).nom||id;
  return (<div style={{display:"flex",flexDirection:"column",width:"100%",height:"100%"}}>
    <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 24px",borderBottom:"1px solid #E4DFD4",background:"#F7F5F0",flexShrink:0}}>
      <span style={{fontSize:12,letterSpacing:".06em",textTransform:"uppercase",color:"#5E5B53"}}>Two mechanisms, one per clock</span>
      <div role="group" aria-label="Mechanism" style={{display:"flex",gap:4,padding:4,background:"#ECE8DF",borderRadius:10}}>
      {ids.map(id=>(<button key={id} onClick={()=>pick(id)} style={{border:0,borderRadius:7,padding:"7px 14px",font:"inherit",fontSize:13,cursor:"pointer",whiteSpace:"nowrap",
        background:cur===id?"#1B1B18":"transparent",color:cur===id?"#FFFFFF":"#3D3A33",fontWeight:cur===id?600:500}}>{nom(id)}</button>))}
      </div></div>
    <div style={{flex:1,minHeight:0,position:"relative"}}><SklMech key={cur} sysId={cur}/></div>
    </div>);
}

window.SKLMech = {
  mount(scope){
    (scope||document).querySelectorAll("[data-mech]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      const ids=el.getAttribute("data-mech").split("|");
      el.__sklRoot.render(ids.length>1?<SklMechSwitch ids={ids}/>:<SklMech sysId={ids[0]}/>);
    });
    (scope||document).querySelectorAll("[data-mechmap]").forEach(el=>{
      if(el.__sklRoot) return;
      el.__sklRoot = createRoot(el);
      el.__sklRoot.render(<SklMap/>);
    });
  }
};
