Rules: Pitch methodology §2.1 and annex PB-27 (version PITCH-2.0).
Question: into which category does the VALIDATED P (the prospect's blocker, exact quote given) fall?
Ask what the prospect doubts. Boundary tests, in this order:
1. The doubt is about his ability to do the design work ("can I actually do this?", "I'm not good enough") -> Skill.
2. The doubt is about being chosen without experience or credentials ("who will hire me?", "I have no portfolio",
   "I'm not certified") -> Legitimacy.
3. What to charge -> Pricing. Where clients come from (marketing, visibility, leads, "getting the clients") -> Acquisition.
   Turning a conversation into a client (sales calls, proposals, closing a deal) -> Selling.
   Running a project end to end (process, contracts, suppliers, client management) -> Delivery.
4. Hours available -> Time. An earlier course or attempt that produced nothing -> Past failure.
   The risk that the investment does not pay off ("what if it doesn't work?") -> Financial risk.
- A lack of money to pay for the program is not a blocker of the pitch: answer "not_a_pitch_blocker".
- A P that fits none of the nine (a fear, overthinking, "not treating it as a need", "change is scary") is
  "P_category_unknown"; say why in "uncovered".
- When a P fits two categories, the category of the words the prospect used wins.
JSON: {"category": "Skill|Legitimacy|Pricing|Acquisition|Selling|Delivery|Time|Past failure|Financial risk|P_category_unknown|not_a_pitch_blocker",
       "quote": "the exact prospect words that decide the category (from the validated P turn)", "turn": "T028",
       "uncovered": null}
