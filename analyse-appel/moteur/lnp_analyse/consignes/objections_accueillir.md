# Objections · la première réponse accueille-t-elle la résistance ? (OB-13, OB-20)

Lis SEULEMENT la première phrase (PREMIÈRE PHRASE) du tour de PREMIÈRE RÉPONSE du commercial (rôle SALES).
- "receiving_marker" : elle contient un marqueur d'accueil sans contradiction (« je t'entends », « je vous entends »,
  « ça a tout son sens », « c'est tout à fait légitime », « je comprends », « c'est normal », « bonne question »,
  « merci de me le dire », « bien sûr », « ce n'est pas un problème »).
- "neutral_reformulation" : elle reformule la résistance de façon neutre (« Donc c'est le montant qui vous retient. »).
- "elliptical_open_question" : c'est une question ouverte qui renvoie à la résistance par ellipse
  (« Par rapport à quoi ? », « Pourquoi ça ? », « Dans quel sens ? »).
- "contradiction" : elle commence par une contradiction ou en contient une (« mais », « en fait », « non, »,
  « c'est pas vrai », « le truc, c'est que », « je ne suis pas d'accord », « sauf que », « par contre »), ou un
  contre-argument, ou une défense.
"quote" : la première phrase exacte (ou ses 40 premiers mots).

JSON: {"receiving_marker": bool, "neutral_reformulation": bool, "elliptical_open_question": bool,
 "contradiction": bool, "quote": "..."}
