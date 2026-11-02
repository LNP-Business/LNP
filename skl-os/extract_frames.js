const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const js=src.split('data-dc-script')[1].split('>').slice(1).join('>').split('</script>')[0];
global.DCLogic=class{constructor(p){this.props=p;this.state={};}setState(){}};
const C=eval('('+js.trim().replace(/^class Component extends DCLogic/,'class extends DCLogic')+')');
const c=new C({});
fs.writeFileSync(process.argv[3], JSON.stringify({frames:c.frameSeed(), decisions:c.decisions().map(d=>({id:d.id,col:d.col,title:d.title,question:d.question,owner:d.owner,expected:d.expected||'',actual:d.actual||'',chosen:d.chosen,decided:d.decided||'',review:d.review||'',meta:d.meta,deadline:d.deadline,action:d.action}))},null,1));
