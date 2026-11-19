# Objections · ce tour du commercial change-t-il de sujet ? (OB-8, OB-22)

Tu reçois une résistance, la réponse du commercial jusqu'ici (RÉPONSE DU COMMERCIAL JUSQU'ICI), et UN tour cible du
commercial (TOUR CIBLE, rôle SALES).

"new_subject" : true si le tour cible introduit un nouveau sujet sans lien avec la résistance : une nouvelle question de
découverte, une nouvelle partie de l'offre, la logistique (partage d'écran, prise de rendez-vous, traitement du paiement)
ou la conclusion de la vente.
Continuer sur la résistance (« donc », « et », « aussi », « l'autre chose à ce sujet »), y répondre, l'explorer ou
rassurer à son sujet n'est PAS un nouveau sujet.

"receive_and_leave" (seulement quand le tour cible est marqué PREMIÈRE RÉPONSE) : true si le tour accueille la résistance
(« je comprends tout à fait ») puis passe à un nouveau sujet dans le même tour, sans répondre à la résistance ni
l'explorer (OB-22). Sinon false.

Quand "new_subject" ou "receive_and_leave" vaut true, "quote" contient les mots exacts du tour cible où commence le
nouveau sujet.

JSON: {"new_subject": bool, "receive_and_leave": bool, "quote": "..." | null}
