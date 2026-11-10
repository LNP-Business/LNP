Rules: Pitch annex PB-14, PB-15, PB-16, PB-23, PB-24 (adhesion, version PITCH-2.0).
Adhesion = a PROSPECT passage that shows one of:
- appropriation: he restates a component as applied to himself ("so I'd have someone checking my designs every week");
- projection: first person, future or conditional, with a concrete element (a date, a number, a first action, a named
  client or project) ("if I start now I could have my portfolio ready before March");
- new_link: he connects a component to his situation on his own ("that's exactly what I was missing with the last course").
Not adhesion (do not list): plain approvals and compliments ("okay", "sounds good", "that's great", "wow", "I love
that"); price, payment or logistics questions without a projection; content first stated by the sales and only approved.
Flags the code needs, for each passage you list:
- "concrete": true if it contains a date, a number, a named first action, client or project;
- "comprehension_echo": true if it answers a comprehension question and only echoes the sales' words without an
  element of his own situation (PB-23);
- "postpone": true if the projection is used to justify a delay ("I'd rather start in January", PB-24);
- "gesture": the exact SALES quote immediately before the passage (PB-16).
JSON: {"passages": [{"quote": "...", "turn": "T214", "kind": "appropriation|projection|new_link", "concrete": false,
                     "comprehension_echo": false, "postpone": false, "gesture": {"quote": "...", "turn": "T213"} | null}]}
