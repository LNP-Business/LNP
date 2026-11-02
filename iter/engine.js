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
  "This is what separates a frozen parameter from a constraint (organ 04). A constraint is imposed on you and has no condition under which it lifts by itself — sixty closer-hours never becomes eighty on its own. A frozen parameter is a decision with an expiry trigger: « slots on a ten-day rolling window, unless median latency exceeds five days ».",
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
 "04":[{nom:"Closer capacity",nature:"throughput",unite:"calls/week",borne:60,charge:58,seuil:48,preuve:"hunch"},
       {nom:"Cash",nature:"depleting stock",unite:"€",borne:120000,charge:38000,seuil:4,preuve:"measured"},
       {nom:"Senior closer",nature:"presence",unite:"person",borne:1,charge:1,seuil:90,preuve:"measured"}],
 "05":{nom:"Head of sales",autorite:"Script, qualification grid, confirmation sequence",refus:"yes"},
 "06":[{nom:"Booked calls",volume:90,unite:"per week",varia:"depends on the live creative",source:"VSL mechanism"}],
 "07":[{nom:"Change of ad creative",gravite:"high",obs:"yes"},
       {nom:"Closer absence",gravite:"medium",obs:"yes"}],
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
       {nom:"Calls per closer per week",agit:"Close rate drops beyond 48 calls/week/closer",acteur:"Head of sales"}],
 "12":[{nom:"Price",raison:"Consistency with positioning",degel:"If deferred closes exceed direct closes for two quarters"}],
 "13":[{nom:"Close rate drops beyond 48 calls/week/closer",porte:"Closed on call",nonlin:"yes",usage:"intervene"},
       {nom:"Show rate depends on the confirmation sequence",porte:"No-show and unconfirmed",nonlin:"no",usage:"intervene"}],
 "14":{processus:4,capteur:3},
 "15":[{nom:"CRM",mesure:"Closed",latence:3,bruit:9,unite:"show pts",saisie:"The closer themselves"}],
 "16":{mesure:8,fenetre:1},
 "17":{cadence:1,bande:3,gain:1,inaction:""},
 "18":[{nom:"Closer saturation",type:"balancing",delai:7},
       {nom:"Close ↑ → acceptable CAC ↑ → ad budget ↑ → volume ↑",type:"reinforcing",delai:60}],
 "19":[{valeur:"Show rate",niveau:"measured",date:"12 weeks"},
       {valeur:"48-call threshold",niveau:"hunch",date:"—"}],
 "20":[{nom:"The steps are independent of one another",test:"Correlate qualification and close rate per closer"}],
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
       {nom:"Personal video message from the closer",
        agit:"A personal video message adds 6 to 9 points, no effect beyond 48 h from the slot",
        acteur:"Pre-call lead"},
       {nom:"One-click rescheduling offered",
        agit:"Actively offering a reschedule recovers about 70 % of declared cancellations",
        acteur:"Pre-call lead"}],
 "12":[{nom:"No deposit at booking",raison:"Protect booked appointment volume",
        degel:"If show rate stays below 60 % for 6 consecutive weeks"},
       {nom:"Slots open on a 10-day rolling window",raison:"Consistency with downstream closer load",
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
        saisie:"Automatic at booking, attendance confirmed by the closer"},
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

const fix = s => typeof s === "string" ? s.replace(/\bclosers\b/g,"sales reps").replace(/\bClosers\b/g,"Sales reps").replace(/\bcloser\b/g,"sales rep").replace(/\bCloser\b/g,"Sales rep") : s;
const deep = v => Array.isArray(v) ? v.map(deep) : (v && typeof v === "object") ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)])) : fix(v);
const models = { precall: normModele(PREAPPEL), sales: normModele(DEFAUT) };
const out = { functions: FONCTIONS, organs: ORGANES.map(o=>({id:o.id,name:o.nom,ty:o.ty,fam:o.fam,list:!!o.liste,cols:(o.cols||o.ch||[]).map(c=>({k:c.k,l:c.l,t:c.t})),rules:o.rg,why:EXPL[o.id][0],how:EXPL[o.id][1]})), mech:{} };
for (const [k,M] of Object.entries(models)) {
  out.mech[k] = {
    model: M,
    summary: Object.fromEntries(ORGANES.map(o=>[o.id, resume(o,M)])),
    filled: Object.fromEntries(ORGANES.map(o=>[o.id, estRempli(o,M)])),
    functionsCovered: fonctionsCouvertes(M),
    gates: PORTES.map(p=>{let r=null; try{r=p.f(M);}catch(e){} return {id:p.id,name:p.nom,org:p.org,res:r};}),
    frictions: calcFrictions(M).map(f=>({id:f.id,name:f.nom,cases:f.cases,law:!!f.loi,c:f.c,t:f.t})),
    notifs: calcNotifs(M),
    ignorance: carteIgnorance(M)
  };
}
require('fs').writeFileSync('engine.json', JSON.stringify(deep(out), null, 1));
for (const k of Object.keys(out.mech)) { const m=out.mech[k]; console.log(k, "fn", m.functionsCovered, "gates", m.gates.map(g=>g.name+":"+(g.res?(g.res.ok?"ok":g.res.ko?"KO":"ind"):"-")).join(", "), "| frictions", m.frictions.map(f=>f.name).join(" / "), "| notifs", m.notifs.length); }
