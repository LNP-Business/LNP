Rules: Pitch annex PB-35 (claims, version PITCH-2.0).
A claim is a figure, a client case, a price or a guarantee stated by the SALES in the extract below.
List EVERY claim, each with its exact sales quote. Do not decide whether it is allowed: the code looks each one up in
the prospect's quotes, the offer reference and the case library.
- kind "figure": any number about results, income, students, the market, durations, prices per project...
- kind "case": a named or described client / student story. "library_id": the id from the CASE LIBRARY below, or
  "not_in_library".
- kind "price": an amount for the offer (full price, instalment, deposit, discount, range).
- kind "guarantee": a guarantee or refund promise. "guarantee_ref": the name of the matching guarantee of the OFFER
  REFERENCE below, or null.
- "calculation": true only if the sales presents the figure as a calculation on other figures ("at 1,000 per project
  and 3 projects a month...").
JSON: {"claims": [{"kind": "figure|case|price|guarantee", "quote": "...", "turn": "T201", "library_id": null,
                   "guarantee_ref": null, "calculation": false}]}
