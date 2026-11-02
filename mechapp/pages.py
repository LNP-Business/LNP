"""Turn the Pre-call and Sales screens into hosts for the editor's own mechanism workspace."""
import re, pathlib
P = pathlib.Path(__file__).resolve().parent.parent / "skl-en" / "project"
HOW = ['<li>Build: follow the steps to construct the mechanism, one organ at a time.</li>',
       '<li>Model: read the graph left to right. Click a node to edit it; the bar on top holds what frames the mechanism.</li>',
       '<li>Organs: the 21 organs by function, each with its explanation and filling rules.</li>',
       '<li>Control: the gates, the ignorance map and the notifications. Fix what blocks first, then open a decision.</li>',
       '<li>After each test, update the organs it changed: the model improves with every cycle.</li>']
for f, sid in [("MechPrecall.dc.html", "s-preappel"), ("MechSales.dc.html", "s-vente")]:
    p = P / f; s = p.read_text(encoding="utf-8")
    s = re.sub(r'<main .*?</main>', f'<main style="flex-grow: 1; min-width: 0; display: flex"><div data-mech="{sid}" style="flex-grow: 1; min-width: 0"></div></main>', s, count=1, flags=re.S)
    s = re.sub(r'<sc-if value="\{\{hasOrgan\}\}".*?(?=<sc-if value="\{\{info\}\}")', '', s, count=1, flags=re.S)
    s = re.sub(r'(How to use it</h3><ol[^>]*>).*?(</ol>)', lambda m: m.group(1) + '\n' + '\n'.join(HOW) + m.group(2), s, count=1, flags=re.S)
    s = re.sub(r'class Component extends DCLogic \{.*?\n\}\n(?=</script>)', '''class Component extends DCLogic {
  constructor(props) { super(props); this.state = {}; }
  renderVals() {
    return {
      info: !!this.state.info,
      openInfo: () => this.setState({ info: true }),
      closeInfo: () => this.setState({ info: false })
    };
  }
}
''', s, count=1, flags=re.S)
    p.write_text(s, encoding="utf-8"); print("host", f, len(s))
