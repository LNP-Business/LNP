import re, pathlib
src = (pathlib.Path(__file__).resolve().parent.parent / 'uploads' / 'editeur-systeme.jsx').read_text(encoding='utf-8')
for a,b in [("Closers","Sales reps"),("closers","sales reps"),("Closer","Sales rep"),("closer","sales rep")]:
    src = src.replace(a,b)
src = re.sub(r"@import url\([^)]*\);\n", "", src, count=1)
src = src.replace('import React, { useState, useEffect, useMemo, useRef } from "react";',
                  'import React, { useState, useEffect, useMemo, useRef } from "react";\nimport { createRoot } from "react-dom/client";')
src = src.replace("export default function App(){", "function App(){")
i=src.index("const CSS = `"); j=src.index("`;", i)
css=src[i:j]
for a,b in [("#FBEFF1","#F4F1EA"),("#F3DFE3","#EFECE4"),("#F9EDEF","#F6F4EF"),("#FDFBF9","#FFFFFF"),("#FFFDFC","#FFFFFF"),
            ("#231317","#1B1B18"),("#5D4A50","#5E5B53"),("#8E7C81","#8E8A80"),("#1C0F13","#1B1B18"),("#3A0A17","#1B1B18"),
            ("#A08E93","#8E8A80"),("#CFC2BB","#D8D3C7"),("rgba(58,10,23","rgba(27,27,24"),("rgba(35,19,23","rgba(27,27,24"),
            ("rgba(168,29,58","rgba(180,35,24"),("rgba(142,23,48","rgba(180,35,24")]:
    css=css.replace(a,b)
src=src[:i]+css+src[j:]
# every delete button asks first (window.sklConfirm, from the OS page)
for a, b in [
    ('<button className="sy-x" onClick={()=>maj.del(d.id)}>×</button>',
     '<button className="sy-x" aria-label="Delete this decision" onClick={()=>window.sklConfirm({title:"Delete this decision?",body:"It will be removed from the decision list. This cannot be undone.",ok:"Delete",onOk:()=>maj.del(d.id)})}>×</button>'),
    ('<button className="sy-x" onClick={()=>maj.delOpt(d.id,i)}>×</button>',
     '<button className="sy-x" aria-label="Delete this option" onClick={()=>window.sklConfirm({title:"Delete this option?",body:"The option will be removed from the decision.",ok:"Delete",onOk:()=>maj.delOpt(d.id,i)})}>×</button>'),
    ('<td><button className="sy-x" onClick={()=>maj.delLi(o.id,i)}>×</button></td>',
     '<td><button className="sy-x" aria-label="Delete this line" onClick={()=>window.sklConfirm({title:"Delete this line?",body:"The line will be removed from the register.",ok:"Delete",onOk:()=>maj.delLi(o.id,i)})}>×</button></td>')]:
    assert src.count(a) == 1, a[:50]
    src = src.replace(a, b)
src += "\n" + pathlib.Path('embed.jsx').read_text(encoding='utf-8')
pathlib.Path('app.jsx').write_text(src, encoding='utf-8')
