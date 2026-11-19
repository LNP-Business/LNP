ÉTAPE S1 · LES QUESTIONS DE DÉCOUVERTE (SPIN §2 à §4, annexe SB-5 à SB-35)
{fenetre}
Liste CHAQUE sollicitation du commercial (SALES) posée dans ces tours : toute proposition qui demande une réponse au
prospect (un point d'interrogation, une forme interrogative, ou « dis-moi », « raconte-moi », « explique-moi »,
« décris-moi », « aide-moi à comprendre », « parle-moi de » ; en anglais "tell me", "walk me through", "help me
understand", "describe"). Une proposition interrogative est un item : trois questions dans un tour font trois items
(SEG-1). Une queue (« ..., non ? », « ..., c'est ça ? », "..., right?") appartient à la proposition qu'elle termine
(SEG-4). Une relance orale par-dessus le prospect (« ah oui ? », « c'est vrai ? », "really?") n'est pas une sollicitation
(SEG-7). Seul le commercial pose les questions (SEG-8). Une demande de confirmer une restitution de l'écart (« est-ce que
j'ai bien compris ? ») ou une demande de décision d'achat n'est pas listée.

Pour chaque sollicitation :
- "turn", "quote" : les mots exacts de la question elle-même.
- "letter", lue dans la question seulement, jamais dans la réponse ; dans cet ordre, la première qui s'applique gagne :
  OUT si la réponse attendue n'est qu'un accord avec ce que le commercial vient d'affirmer (out_reason "agreement" ; une
  question de valeur (need-payoff) dont le commercial fournit le contenu, « donc ton objectif, c'est environ 10 000 €,
  c'est ça ? », reçoit aussi "closed_need_payoff": true), un choix dans une liste que donne le commercial
  ("sales_list"), une information ou un avis sur l'offre du commercial ("offer_info"), la charge d'une solution ou la
  façon dont le prospect la paierait ou la financerait ("solution_load"), ou rien de fond : échange social, logistique,
  cadrage, « est-ce que ça te parle ? » ("nothing") ;
  S si la réponse attendue est un fait neutre que le prospect peut vérifier aujourd'hui (un nombre, une durée, un nom, un
  statut, ce qu'il fait aujourd'hui) ;
  N si elle demande un état souhaité qui n'existe pas encore, ou la valeur de la résolution du problème (pas si la
  question contient déjà cet état, nomme une charge, porte sur l'offre, ou si son antécédent est la poursuite du
  problème) ;
  I si elle demande ce que fait le problème : une conséquence dans un autre domaine que celui du problème ;
  P si elle demande la difficulté elle-même, dans les mots du prospect (pas si le commercial l'a déjà nommée avec ses
  propres mots).
- "out_reason" pour OUT seulement.
- "object" : 3 à 6 mots qui nomment le problème sur lequel portent la question et sa réponse ; les mêmes mots pour le
  même problème.
- "stopping_question" : true si elle demande ce qui arrête le prospect, ce qui l'a retenu, ce qui le gêne, ou pourquoi il
  ne l'a pas encore fait.
- Pour S, P, I et N seulement, le registre (SB-26 à SB-35) : "register_domain" est l'une de ces valeurs : money
  (revenus, chiffre d'affaires, prix, dettes, économies), clients (clients, projets, contacts, réservations), time
  (heures, emploi du temps, charge de travail), family (conjoint, enfants, parents), future (là où il veut être, qui il
  veut devenir, sa carrière ou son statut à venir ; un montant cible d'argent ou de clients est money ou clients),
  self_belief (confiance, motivation, peur, doute, sentiments), health (stress, épuisement, sommeil, énergie), other,
  none. "register_basis", dans cet ordre :
  1 "named" : la question nomme un domaine comme ce dont le prospect doit parler (le domaine demandé l'emporte sur une
    prémisse ; quand deux sont demandés, le premier demandé), ou nomme un sujet d'un domaine (« est-ce que cette peur
    t'a coûté quelque chose ? ») ; "register_quote" = ces mots de la question.
  2 "answer" : une question ouverte, qui ne nomme aucun des sept domaines, prend le domaine dont parle la réponse du
    prospect (le premier dans la réponse ; "other" s'il n'y en a aucun) ; "register_turn" = ce tour de réponse (l'un
    des trois premiers tours de la réponse), "register_quote" = les mots du prospect qui le montrent.
  3 seulement quand la question n'a pas eu de réponse : "reference" quand elle renvoie (« ça », « cela », "that", "it")
    à ce que le prospect a dit dans ses deux derniers tours avant elle ("register_turn", "register_quote"), sinon
    "none".
  Les mots qui ne font que dater la question (« aujourd'hui », « dans 12 mois ») ne sont pas le domaine time ;
  « personnellement », « ta vie », « tu » ne nomment aucun domaine.
- "answer" : {"turn", "quote"} : la réponse du prospect (ce qu'il dit après la question, jusqu'à la question suivante du
  commercial), ses mots clés ; à omettre quand la question n'a pas eu de réponse.
- "atoms" : ce que le PROSPECT énonce dans la réponse (SB-9 à SB-24), chacun avec "type", "turn", "quote" :
  SITUATION un fait neutre sur aujourd'hui ; PAIN quelque chose qui ne marche pas ; BLOCKER ce qui empêche d'atteindre
  l'objectif ; IMPACT une conséquence du problème dans un autre domaine ; DESIRE un état futur souhaité ; VALUE pourquoi
  le résoudre compte, ce que ça changerait. Un atome = un passage continu de 2 à 40 mots d'un seul tour du prospect ; la
  même chose dite deux fois est un seul atome ; deux conséquences différentes sont deux atomes ; une phrase avec un état
  et la raison pour laquelle il compte donne un DESIRE et une VALUE. Une réponse qui ne fait qu'approuver n'a pas
  d'atome. Donne aussi :
  "quantified" (un montant, un nombre ou une durée ; une fréquence seule ou « beaucoup » ne compte pas), avec "value" (un
  nombre) et "unit" ("month", "clients", "hours per week") ; pour IMPACT, "domain" et "problem_domain" (money, time,
  clients, family, health, self_belief, future, other) ; "figure_kind" pour un chiffre : "present" (sur aujourd'hui),
  "loss" (ce que le problème lui fait perdre), "past" (un état passé), "other" (des économies, un budget, une dette) ;
  "income_drop_attributed" (une baisse d'un revenu passé à un revenu actuel que le prospect attribue au problème) ;
  "prompted_by_sales" (le commercial l'a dit d'abord et le prospect ne fait qu'approuver ; quand il ajoute du contenu,
  ne citer que la partie ajoutée) ; "reported_speech" et "owned" (les mots de quelqu'un d'autre, repris à la première
  personne) ; "object" (3 à 6 mots, le problème auquel il se rapporte) ; "dimension" pour SITUATION et DESIRE (revenue,
  clients, time, career_status, other) ; "cause_quote" et "cause_turn" pour un PAIN ou un BLOCKER dont le prospect
  donne la cause dans un passage séparé.
JSON: {"questions": [{"turn": "T030", "quote": "...", "letter": "P", "object": "...", "stopping_question": true,
  "register_domain": "clients", "register_basis": "named", "register_quote": "...",
  "answer": {"turn": "T031", "quote": "..."},
  "atoms": [{"type": "BLOCKER", "turn": "T031", "quote": "...", "object": "..."}]}]}
