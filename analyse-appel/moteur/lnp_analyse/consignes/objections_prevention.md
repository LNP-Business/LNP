# Objections · faits de prévention avant le premier prix (OB-18, OB-19)

L'extrait s'arrête juste avant le premier prix. Pour chaque fait, donne la citation exacte et le tour, ou null.
Les faits du prospect doivent être dits par le PROSPECT (ou par un codécideur étiqueté OTHER), avec du contenu. Une
supposition du commercial (rôle SALES) seulement approuvée (« Je suppose que c'est vous qui décidez ? » → « mm-hmm » /
« Oui. ») n'établit pas le fait : cite les propres mots du prospect, jamais une simple approbation.
- "decision_maker" : le prospect dit qui décide (« c'est moi qui prends la décision finale »).
- "influencers" : le prospect dit si quelqu'un d'autre pèse sur la décision (conjoint, partenaire, famille, conseiller),
  y compris « personne d'autre, c'est juste moi ».
- "budget" : le prospect dit son budget ou sa capacité financière (une somme épargnée, disponible, ce qui lui reste
  chaque mois).
- "deadline" : le prospect dit une échéance contraignante (un événement externe et daté : un déménagement, une fin de
  contrat) ou un horizon souhaité (« j'aimerais commencer avant l'été ») ; "binding" : true pour le premier cas.
- "past_attempt" : le prospect parle d'une tentative passée qui a échoué (une formation ou un programme payé et pas
  terminé, ou qui n'a pas marché).
- "past_attempt_explored" : une question du commercial (SALES) qui explore ce qui n'a pas marché dans cette tentative.
- "difference_stated" : un passage du commercial (SALES) qui dit ce qui est différent cette fois.

JSON: {"decision_maker": {"turn": "T074", "quote": "..."} | null, "influencers": {...} | null, "budget": {...} | null,
 "deadline": {"turn": "...", "quote": "...", "binding": bool} | null, "past_attempt": {...} | null,
 "past_attempt_explored": {...} | null, "difference_stated": {...} | null}
