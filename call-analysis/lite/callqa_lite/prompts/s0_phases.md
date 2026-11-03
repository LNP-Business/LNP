STEP S0 · PHASE MAP (Pitch annex PB-1 to PB-4, PB-17 to PB-19)
List every SALES turn of the whole call that does at least one of these:
- "offer_description": describes the offer: its content (modules, pillars, steps), format (mentorship, coaching,
  community, calls), duration, support, guarantee or outcome promise;
- "screen_share": announces or starts a screen share of the program;
- "price_for_offer": states an amount FOR THE OFFER (full price, instalment, deposit, discount, or a range for the
  offer). Never a price: a student's income, a price per project the prospect could charge, an ad budget, a software
  cost, an amount said by the prospect;
- "decision_request": asks the prospect to decide ("are you ready to get started?", "what would you like to do?").
For each such turn also give:
- "followed_by_discovery": within the next 2 sales turns the sales goes back to discovery questions about the
  prospect (the turn is then only a mention of the offer, PB-2, PB-17);
- "next_discovery_question" (offer_description or screen_share turns): {"turn", "quote"}, the exact words of the first
  later SALES question about the prospect's situation, goals, problems or blockers asked before the sales goes on
  presenting the offer; null if the sales goes on presenting. An introduction of the call ("if we work together it
  will be over four months", "first I'll ask you some questions") is always followed by discovery questions;
- "lnp_offer_price" (price_for_offer turns): true only if the amount is what THIS prospect would pay the sales'
  company for the offer the sales is presenting. False for an example of what the prospect could charge her own
  students ("a 10-week programme at 500 euros"), a market price, an ad budget, an income;
- "offer_explained" (price_for_offer turns): {"turn", "quote"}, the exact words of the SALES turn (this one or an
  earlier one) that explains the offer this amount is the price of;
- "hypothetical": the amount is explicitly hypothetical or disowned ("let's say it was 10K, this is not the price");
- "amount" (a number, 5800 for "5,800") and "range" ([min, max]) when an amount is stated;
- "quote": the exact words of that turn that show it.
JSON: {"turns": [{"turn": "T085", "quote": "...", "offer_description": true, "screen_share": true,
                  "followed_by_discovery": false, "next_discovery_question": null, "price_for_offer": false,
                  "lnp_offer_price": null, "offer_explained": null, "amount": null, "range": null,
                  "hypothetical": false, "decision_request": false}]}
