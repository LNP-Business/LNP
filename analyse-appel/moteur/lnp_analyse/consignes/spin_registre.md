Règles : SPIN, annexe A, SB-26 à SB-35 (registre d'une question). Réponds à une seule question fermée sur UNE question du
commercial pendant la découverte : de quel domaine cette question fait-elle parler le prospect ? Tu nommes seulement le
domaine et tu cites les mots qui le montrent ; le code change le domaine en registre.

Domaines (en choisir exactement un) :
- money : revenus, chiffre d'affaires, gains, prix, dettes, factures, économies, ce que quelque chose coûte en argent.
- clients : clients, élèves, projets, prospects, réservations, ventes faites, le carnet de commandes (pipeline).
- time : le temps, les heures, la semaine, les week-ends, l'emploi du temps, la charge de travail.
- family : la famille, les enfants, le conjoint, ses parents, les personnes à la maison.
- future : où le prospect veut en être, qui il ou elle veut devenir, sa carrière ou son statut à venir, l'écart entre où il
  ou elle en est et où il ou elle veut en être (pas un montant d'argent ou un nombre de clients visé : c'est money ou clients).
- self_belief : la confiance, la croyance en soi, la motivation, l'état d'esprit, la peur, le doute, les sentiments, les
  émotions.
- health : la santé, le stress, l'anxiété, l'épuisement professionnel (burn-out), l'épuisement, le sommeil, l'énergie.
- other : un sujet qui n'est aucun des sept ci-dessus (un outil, un lieu, une méthode, un loisir).
- none : rien de nommé et rien de désigné.

Comment lire la question (ordre fixe, la première règle qui s'applique décide) :
1. SB-28 · Ce qui est demandé passe avant la prémisse. Si la question nomme l'un des sept domaines comme ce dont le prospect
   doit parler, ce domaine décide, même si un autre domaine est nommé comme prémisse. « Avec des élèves qui vont et viennent
   comme ça, quel impact ça a sur tes revenus ? » demande les revenus : money (les élèves sont la prémisse). Si deux domaines
   sont demandés tous les deux, le premier demandé, dans l'ordre de lecture, décide ; dans une série de questions dans un même
   tour, la première question posée décide. basis = "named" ; quote = les mots de la SOLLICITATION (ou de son préambule) qui
   nomment le domaine demandé, 1 à 12 mots.
2. SB-29 · Sujet nommé dans la question. Si la question porte sur un sujet qu'elle nomme elle-même, et que ce sujet est dans
   l'un des sept domaines (« cette peur de l'échec, elle t'a coûté quelque chose ? », « d'où elle vient, cette croyance ? »,
   « ça fait combien de temps que tu as ces douleurs ? »), le domaine de ce sujet décide. basis = "named" ;
   quote = les mots qui nomment le sujet.
3. SB-35 · Question ouverte : son effet décide. Toute autre question (elle ne nomme aucun des sept domaines : « est-ce que
   c'est envisageable pour toi en ce moment ? », « qu'est-ce qui est le plus risqué pour toi ? », « qu'est-ce qui t'a donné
   envie de réserver cet appel ? », « en quoi ça t'a touché ? ») prend le domaine dont parle la
   RÉPONSE DU PROSPECT À CETTE QUESTION, l'effet que la question a eu. basis = "answer" ;
   reference_turn = l'identifiant du tour de réponse ; quote = les mots exacts du prospect dans ce tour qui montrent le
   domaine, 1 à 12 mots. Si la réponse parle de plusieurs domaines, le premier dans la réponse décide. Si la réponse ne parle
   d'aucun des sept : asked_domain = "other", basis = "answer", avec la citation de ce dont elle parle.
4. Seulement quand il n'y a PAS de réponse (« (pas de réponse) » ci-dessous) : SB-29 · Référence. Une question qui renvoie en
   arrière avec « ça », « cela », « ce » (ou un pronom : « tu le vis comment ? ») prend le domaine de ce qu'elle désigne,
   lu dans les DERNIERS TOURS DU PROSPECT donnés. basis = "reference" ; reference_turn = l'identifiant de ce tour ;
   quote = les mots exacts du prospect, 1 à 12 mots. Des mots comme « personnellement », « ta vie », « toi », « vous » ne
   nomment pas de domaine. Rien de nommé et rien de désigné : asked_domain = "none", basis = "none", quote = null (ou
   asked_domain = "other", basis = "none", pour un sujet hors des sept).

Bornes :
- « ressentir », « émotionnellement », « frustré », « fier » sont des sentiments : self_belief. « stressé », « fatigué »,
  « épuisé », « en burn-out » : health. Les deux donnent le même registre ; choisis celui que les mots nomment.
- Une cible en argent ou en clients (« combien tu veux gagner ? », « combien d'élèves tu veux avoir ? ») est money ou
  clients, pas future. « Où est-ce que tu veux en être dans un an ? » sans montant est future.
- Les mots de temps qui ne font que dater la question (« aujourd'hui », « en ce moment », « l'année dernière », « dans
  12 mois ») ne sont pas le domaine time ; le domaine time porte sur les heures, l'emploi du temps ou la charge du prospect.
- Ne devine pas à partir de la lettre de la question (S, P, I, N) : la lettre ne décide jamais le domaine.
- Les règles 1 et 2 lisent la question seulement ; la règle 3 lit la réponse seulement. N'utilise jamais la règle 3 quand
  la règle 1 ou 2 s'applique, et n'utilise jamais "named" avec "other" : une question sur un sujet hors des sept domaines est
  une question ouverte (règle 3).

JSON : {"asked_domain": "money", "basis": "named", "quote": "tes revenus", "reference_turn": null}
