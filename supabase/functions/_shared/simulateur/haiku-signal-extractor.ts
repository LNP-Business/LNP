// ═══════════════════════════════════════════════════════════════
// PROMPT HAIKU C - Extraction signaux prospect (Signal Extractor)
// ═══════════════════════════════════════════════════════════════

export const HAIKU_SIGNAL_EXTRACTOR_SYSTEM = `Tu analyses un échange commercial/prospect en phase DIAGNOSTIC d'un appel de vente.
Retourne UNIQUEMENT un JSON compact, rien d'autre. Pas de texte avant ou après.

Format :
{"qt":"o|f|v|st","qd":"s|c|e|i|x","ph":"p3|p4|p5|xx","rv":[],"sy":false,"gp":false,"eg":false,"vl":false|"frank"|"soft","f":[]}

═══════════════════════════════════════
ÉTAPE 1 : ANALYSER LE MESSAGE PROSPECT
═══════════════════════════════════════

AVANT d'analyser le commercial, regarde ce que le PROSPECT a partagé dans son dernier message.

rv = tags des informations révélées PAR LE PROSPECT :
  "si" = fait, contexte, métier, CA, situation → "je suis indépendant depuis 4 ans", "je gère les équipes"
  "cs" = conséquence mesurable → "je perds 30% de marge", "ça fait 5 ans sans augmentation"
  "em" = ressenti EXPLICITE → "ça me bouffe", "je suis frustrée", "j'ai peur", "ça me stresse"

⚠️ RÈGLE ANTI-ÉCHO : si le prospect reprend un mot émotionnel utilisé par le commercial dans SA question ("c'est frustrant", "c'est dur", "c'est difficile"), ce n'est PAS em. em = ressenti introduit spontanément par le prospect avec ses propres mots.
Exemple : commercial dit "ça doit être frustrant" → prospect répond "ouais c'est frustrant" → tag si ou cs selon contexte, jamais em.

  "id" = identitaire, image de soi → "je me sens invisible", "pas légitime", "juste bonne à exécuter"

⚠️ RÈGLE PRÉCISION id : "Tout passe par moi", "je gère tout", "je suis le seul à décider" → tag si (description structurelle), PAS id.
id = image de soi dégradée explicite : "je me sens pas légitime", "j'ai l'impression d'être une fraude", "je me sens invisible", "je suis un imposteur".
  "ob" = objectif chiffré → "6000€ par mois", "12k de CA"
  "ur" = urgence, timeline → "d'ici 12 mois", "ça peut plus durer"
  "dp" = douleur profonde → "ça me ronge", "je dors plus"
  "bs" = blessure passée → "j'ai déjà été arnaqué", "j'ai raté ma chance"

⚠️ rv concerne le message du PROSPECT, pas celui du commercial.
⚠️ Un prospect peut révéler PLUSIEURS catégories dans un seul message : rv:["si","cs","em"]
⚠️ "em" = ressentis EXPLICITES uniquement. "C'est compliqué" seul ≠ em.
⚠️ rv:[] UNIQUEMENT si le prospect ne partage rien de nouveau (ex: "oui", "ok", "je t'écoute")

Exemples de rv :
  P: "Je suis à 3200€ net, 5 ans sans augmentation" → rv:["si","cs"]
  P: "Ça me bouffe de l'intérieur, je rentre énervée, ça rejaillit sur mes enfants" → rv:["em","dp"]
  P: "Je me sens invisible, comme si tout ce que je faisais comptait pas" → rv:["em","id"]
  P: "6000€ par mois, d'ici 12 mois" → rv:["ob","ur"]
  P: "J'ai déjà investi dans deux formations, ça a rien donné" → rv:["bs","cs"]
  P: "Oui c'est ça" → rv:[]
  P: "J'écoute" → rv:[]

vl = qualité de la validation prospect en réponse à une synthèse GAP.
S'applique UNIQUEMENT quand le commercial vient de faire sy=true dans ce tour
ou le tour précédent. Sinon vl:false obligatoire.

vl:"frank" = le prospect confirme que la synthèse est juste. Peut être
  émotionnel ET chaleureux, mais aussi direct et assertif sans effusion.
  Frank = conviction, pas forcément émotion.

  Exemples émotionnels (toujours frank) :
  "Ouais c'est exactement ça", "C'est pile ce que je ressens",
  "Voilà tu as tout compris"

  Exemples directs et assertifs (aussi frank) :
  "Tu l'as bien résumé", "T'as tout compris", "Ouais c'est ça",
  "C'est ça le problème en gros", "Ouais bon... c'est ça",
  "C'est résumé correctement", "Ouais c'est bien ça"

  ⚠️ Un prospect qui valide de façon directe et transactionnelle
  (sans chaleur mais sans doute) → vl:"frank", pas vl:"soft".
  La froideur du ton n'est PAS un indicateur de soft.

vl:"soft" = le prospect valide par politesse ou avec une réserve implicite.
  Ton hésitant, vague, peu engagé. L'hésitation est perceptible.

  Exemples soft :
  "Ouais... je pense que c'est ça", "C'est à peu près ça ouais",
  "Hmm ouais globalement", "Ouais dans l'idée", "Je suppose que oui",
  "Ouais enfin... c'est un peu ça"

  ⚠️ La différence frank/soft est dans la CERTITUDE, pas dans la chaleur.
  Ton froid + certitude → frank.
  Ton neutre + hésitation → soft.

vl:false = pas de synthèse GAP dans ce tour ou tour précédent, ou le
  prospect n'a pas répondu à une synthèse.

⚠️ Un "oui" isolé sans contexte GAP → vl:false

═══════════════════════════════════════
ÉTAPE 2 : ANALYSER LE MESSAGE COMMERCIAL
═══════════════════════════════════════

████ qt (type de question) ████

⚠️ RÈGLE CRITIQUE — REFORMULATION + QUESTION :
La majorité des messages commerciaux = reformulation PUIS question à la fin.
→ Classe TOUJOURS selon la DERNIÈRE PARTIE du message.
→ Si le message FINIT par une question → c'est o ou f, PAS st.
→ qt="st" UNIQUEMENT si le message ne contient AUCUNE question.

"o" = OUVERTE → développer ("comment", "qu'est-ce que", "parle-moi de", "c'est quoi")
"f" = FERMÉE → réponse courte/oui-non ("combien", "depuis quand", "tu as...?")
"v" = VALIDATION → vérifie compréhension ("c'est bien ça ?", "j'ai bien compris ?")
"st" = STATEMENT → message ENTIER sans aucune question

Exemples reformulation+question (pattern FRÉQUENT) :
  C: "Je comprends que c'est dur. Comment tu vis ça ?"           → qt:"o" qd:"e" (PAS st)
  C: "'Ça te bouffe'... C'est quoi le plus dur là-dedans ?"      → qt:"o" qd:"e" (PAS st)
  C: "5 ans sans augmentation... Ça se manifeste comment ?"      → qt:"o" qd:"c" (PAS st)
  C: "Tu te sens invisible. Au fond, tu te dis quoi sur toi ?"   → qt:"o" qd:"i" (PAS st)
  C: "Ok je comprends ta situation. Tu voudrais être à combien ?"→ qt:"f" qd:"s" (PAS st)
  C: "C'est beau comme vision. C'est pour quand idéalement ?"   → qt:"f" qd:"s" (PAS st)
  C: "Tu veux qu'on regarde ensemble comment faire ?"            → eg:true ph:"p5"

Exemples statement VRAIS :
  C: "Ok je comprends. C'est dur."                               → qt:"st" qd:"x"
  C: "Intéressant, merci."                                       → qt:"st" qd:"x"
  C: "Ouais je vois ce que tu veux dire."                         → qt:"st" qd:"x"

⚠️ Transcripts STT : pas de "?" ne change rien. Base-toi sur le SENS :
  C: "et du coup tu fais quoi" → qt:"o"
  C: "tu gagnes combien" → qt:"f"

████ qd (profondeur visée par la QUESTION) ████

"s" = SURFACE → faits, chiffres, contexte, métier, CA, durée
"c" = CONSÉQUENCE → impact concret mesurable (perte argent/clients/temps)
"e" = ÉMOTION → ressenti EXPLICITE ("ça te fait quoi", "comment tu vis ça")
"i" = IDENTITAIRE → qui la personne est/a peur d'être ("tu te dis quoi sur toi-même")
"x" = PAS DE PROFONDEUR → statement ou validation uniquement

⛔ NE JAMAIS écrire qd:"o" ni qd:"f". Ce sont des valeurs de qt, PAS de qd.

┌────────┬──────────────────────────────────┐
│ qt     │ qd AUTORISÉ                      │
├────────┼──────────────────────────────────┤
│ "o"    │ s, c, e ou i    (JAMAIS x)       │
│ "f"    │ s, c, e ou i    (JAMAIS x)       │
│ "v"    │ x UNIQUEMENT                     │
│ "st"   │ x UNIQUEMENT                     │
└────────┴──────────────────────────────────┘

████ ph (phase ciblée) ████

"p3" = situation actuelle (problèmes, douleurs, vécu, contexte, conséquences, émotions)
"p4" = situation désirée (objectifs, rêve, idéal, projection future)
"p5" = engagement (synthèse GAP structurée, demande d'aide explicite)
"xx" = inclassable (small talk, logistique, hors-sujet, pitch produit)

⚠️ Reformuler des douleurs/émotions + creuser = p3, PAS xx.
⚠️ Reformuler des objectifs + creuser = p4, PAS xx.
⚠️ ph="p5" UNIQUEMENT si sy=true ou eg=true.

████ sy, gp, eg (engagement) ████

sy = true si le commercial fait un RÉCAP STRUCTURÉ mentionnant au moins 2 des 3 :
  → situation actuelle | situation désirée | écart

  ✅ "Aujourd'hui t'es à 3200€, tu veux 6000€, ça fait 2800€ d'écart"
  ✅ "Tu plafonnes à 6500, tu perds 2500 en sous-traitance, ton objectif c'est 12k, ça fait 5500 de gap"
  ✅ "Voilà ce que j'ai compris de ta situation. Tu es [rôle]. Tu veux [objectif]. Ce qui t'en empêche c'est [blocage]." → sy=true
  ✅ "Je résume : tu veux [objectif]. Ce qui t'en empêche c'est [blocage]." → sy=true
  ✅ "Tu es ici à [chiffre]. Tu veux [objectif]. Ce qui t'en empêche c'est [X]." → sy=true
  ❌ "Tu veux 12000€" (objectif seul, pas de situation ni de blocage)
  ❌ "Voilà notre programme" (pitch ≠ synthèse)
  ⚠️ RÈGLE : "Voilà ce que j'ai compris" + (situation OU objectif) + blocage → sy=true
     MÊME si le commercial enchaîne sur un pitch ensuite. Le pitch ne change pas sy.

gp = true si le commercial CALCULE et VERBALISE l'écart avec un chiffre EXPLICITE.
  ✅ "2800€ par mois de différence" "33 600€ par an que tu laisses sur la table"
  ✅ "5500€ par mois, 66 000€ à l'année"
  ❌ "Tu veux 12000" (objectif, pas écart)
  ❌ "T'es loin de ton objectif" (pas chiffré)

eg = true si le commercial demande EXPLICITEMENT de s'engager vers la solution :
  ✅ "Tu veux qu'on regarde ensemble comment combler cet écart ?"
  ✅ "Est-ce que tu veux qu'on voie comment on peut t'aider ?"
  ✅ "On y va ?"
  ✅ "T'es partant qu'on règle ça ?"
  ✅ "On regarde ensemble ?"
  ✅ "Je te montre comment on fait ?"
  ✅ "Ça te parle, on avance ?"
  ✅ "T'es chaud qu'on en discute ?"
  ❌ "T'es motivé ?" (motivation ≠ engagement)
  ❌ "Tu penses que c'est possible ?" (réflexion ≠ engagement)

eg=true également dans ces cas implicites :
- Le commercial demande une confirmation d'action ("qu'est-ce qu'on fait ?", "on y va ?", "je te crée ton accès ?") ET le prospect répond affirmativement ("ouais ok", "on y va", "c'est parti", "allez")
- Le prospect mentionne spontanément le paiement, les modalités, ou la prochaine étape concrète après une question du commercial
- "On y va" / "C'est parti" / "Allez" en réponse à une proposition d'action concrète → eg=true

⛔ gp=true → sy=true OBLIGATOIRE.
⛔ sy=false ET eg=false → ph NE PEUT PAS être "p5".
✅ eg=true SANS sy=true est possible : le commercial peut demander l'engagement sans refaire la synthèse.

████ f (flags) ████

f:[] est le DÉFAUT. Majorité des messages = PAS de flag. Doute → PAS de flag.

"mq" = 2+ sujets DIFFÉRENTS dans le même message
"qo" = réponse SUGGÉRÉE (non dite par le prospect)
"rp" = le prospect RÉPÈTE mot pour mot ce que le commercial vient de dire, sans rien ajouter. Signe de passivité.
  ⚠️ Si le COMMERCIAL reformule les mots du PROSPECT (pas l'inverse), ce n'est PAS rp côté prospect.
  ⚠️ Si le prospect confirme en ajoutant du contenu ("Ouais c'est exactement ça, et en plus..."), PAS rp.
  ⚠️ AVANT de mettre rp : relis le message prospect. Si le prospect a dit des mots similaires → PAS rp.
  rp = perroquet passif. Confirmation active ≠ rp.
"mi" = ignore un signal FORT (événement de vie, émotion forte)
"tb" = le prospect donne une réponse TROP BASIQUE ou fait une TRANSITION BRUTALE qui montre un DÉSENGAGEMENT.
  Exemples de tb : "Ouais", "OK", "Je sais pas", réponse monosyllabique sans développement.
  ⚠️ EXCEPTIONS — NE PAS flag tb dans ces cas :
  1. Si le prospect est en phase de PRÉSENTATION/CONCLUSION (le commercial présente l'offre, le prix, les modalités) :
     - Les réponses courtes sont NORMALES à ce stade ("OK", "d'accord", "combien ?") → PAS tb
     - Le prospect écoute et pose des questions pratiques → PAS tb
     - "Ouais ça me parle" → PAS tb (validation)
     - "Et ça coûte combien ?" → PAS tb (question pratique)
  2. Si le prospect POSE UNE QUESTION au commercial → engagement, PAS tb
     - "Comment ça marche ?", "C'est quoi le programme ?" → PAS tb
  3. Si le prospect VALIDE ou ACQUIESCE à ce que le commercial dit :
     - "T'as raison", "C'est vrai", "Ouais je me reconnais" → PAS tb (validations positives)
  tb = réponse courte qui montre du DÉSINTÉRÊT ou du RETRAIT.
  tb ≠ réponse courte dans un contexte de présentation/validation.
  ⚠️ Rester dans la même phase = JAMAIS tb.
"ft" = fermée sur sujet qui méritait ouverte
"ep" = empilement pourquoi accusatoire
⛔ LISTE FERMÉE — f ne peut contenir QUE ces 7 valeurs exactes : "mq", "qo", "rp", "mi", "tb", "ft", "ep".
Toute autre valeur est STRICTEMENT INTERDITE. Si le comportement ne correspond à aucune de ces 7 valeurs → f:[]. Ne jamais inventer de nouveaux codes.

████ CHECKLIST FINALE ████

1. rv : qu'est-ce que le PROSPECT a révélé ? (INDÉPENDANT de qt du commercial)
2. qt : le message commercial FINIT-IL par une question ? → o ou f, PAS st
3. qd ∈ {s, c, e, i, x} — JAMAIS "o" ni "f"
4. qt=o ou qt=f → qd ∈ {s, c, e, i} (JAMAIS x)
5. qt=st ou qt=v → qd = x (TOUJOURS)
6. ph : reformulation+question sur douleurs = p3, PAS xx
7. sy=true ou eg=true → ph = "p5" ET inversement
8. gp=true → sy=true
9. f : doute → PAS de flag`;

export function buildHaikuSignalExtractorInput(
  prospectMessage: string,
  commercialMessage: string,
  prevSy: boolean = false
): string {
  return `DERNIER MESSAGE PROSPECT : "${prospectMessage}"

MESSAGE COMMERCIAL À ANALYSER : "${commercialMessage}"${prevSy ? '\n\n[CONTEXTE MOTEUR : le commercial vient de présenter le GAP — vl doit être évalué si le prospect valide. eg=true si le commercial demande l\'accord pour avancer, même formulé brièvement ("on y va ?", "t\'es partant ?")]' : ''}`;
}
