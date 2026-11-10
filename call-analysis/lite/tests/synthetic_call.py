"""A fictional sales call (no real person, no real data) and the answers a model could give to the five lite steps.

The recorded answers also carry the mistakes the code must catch: an invented quote, a quote given to the wrong
speaker, a question after the pitch start, objections raised before the pitch and before the first price (OB-27), the same objection listed twice.
"""
from lnp_callqa.core.foundation import parse_transcript
from lnp_callqa.core.models import CallContext

S, P = "Sam Rep", "Alex Lead"
LINES = [
    (S, "Hi Alex, can you hear me okay?"),
    (P, "Yes, I can hear you fine, thanks for having me today."),
    (S, "Great. So tell me, what made you book this call?"),
    (P, "I have been doing interior design on the side for two years and I only make about 1,500 a month from it."),
    (S, "How many clients do you have right now?"),
    (P, "Right now I have three clients, mostly friends of friends."),
    (S, "What's been stopping you from getting more clients?"),
    (P, "Honestly I don't know where clients will come from, I have no marketing at all."),
    (S, "And not knowing where clients come from, what does that do to you outside of work?"),
    (P, "It makes me feel like a fraud and I'm exhausted from working nights after my day job."),
    (S, "Being exhausted like that, how does that affect your family?"),
    (P, "I barely see my kids in the evening, I miss dinner three nights a week."),
    (S, "Where do you want to be in twelve months?"),
    (P, "I want to make 6,000 a month from design so I can quit my job by next summer."),
    (S, "And why does that matter to you?"),
    (P, "So I can be home when my kids get back from school."),
    (S, "So from what I'm hearing, you're at 1,500 a month, you want to make 6,000 a month, what's holding you back is "
        "you don't know where clients will come from, and you miss dinner three nights a week. Did I get that right?"),
    (P, "Yes, exactly, and honestly it has been eating at me for a long time."),
    (S, "Let me share my screen and show you the program. The program is a six-month mentorship with weekly calls and a "
        "client acquisition module."),
    (P, "Okay, I can see it."),
    (S, "What's blocking you today is you don't know where clients will come from. What makes that give way is a client "
        "acquisition system you run every week, and that's phase two of the mentorship."),
    (P, "That makes sense."),
    (S, "You go from 1,500 a month to 6,000 a month, and you're home when your kids get back from school."),
    (P, "So I would have a system to find clients every week, that's what I was missing."),
    (S, "Do you have any questions about how the weekly calls work?"),
    (P, "No, it all sounds clear to me so far, thank you."),
    (S, "The investment is 5,800, or six payments of 1,050."),
    (P, "That's a lot of money for me right now."),
    (S, "I hear you. Apart from the money, is there anything else stopping you?"),
    (P, "No, it's really just the money."),
    (S, "When you say it's a lot, a lot compared to what?"),
    (P, "Compared to what I make from design, it's almost four months of income."),
    (S, "With the six payments of 1,050 you would only need one extra client a month to cover it."),
    (P, "Okay, at 1,050 a month I can make that work."),
    (S, "I also want to ask, do you need to talk to anyone before deciding?"),
    (P, "I need to talk to my husband first, we decide together."),
    (S, "Totally fair. What would he want to know?"),
    (P, "He would want to know it pays for itself, and honestly the money is still a lot."),
    (S, "Are you ready to get started today?"),
    (P, "Let me talk to him tonight and I will let you know tomorrow."),
]
SPEAKERS = {S: "SALES", P: "PROSPECT"}


def transcript() -> str:
    out = []
    for i, (who, text) in enumerate(LINES):
        m, s = divmod(30 + i * 45, 60)
        out.append(f"[{m:02d}:{s:02d}] {who}: {text}")
    return "\n".join(out)


def context() -> CallContext:
    return CallContext("c-lite", "sales-1", "2026-11-02T15:00:00+00:00", "Europe/Paris",
                       parse_transcript(transcript(), SPEAKERS))


S0 = {"turns": [
    {"turn": "T019", "quote": "Let me share my screen and show you the program", "screen_share": True,
     "offer_description": True},
    {"turn": "T027", "quote": "The investment is 5,800, or six payments of 1,050", "price_for_offer": True,
     "amount": 5800, "lnp_offer_price": True,
     "offer_explained": {"turn": "T019", "quote": "The program is a six-month mentorship with weekly calls"}},
    {"turn": "T039", "quote": "Are you ready to get started today?", "decision_request": True},
    {"turn": "T020", "quote": "Okay, I can see it", "offer_description": True},            # a prospect turn: dropped
]}

S1 = {"questions": [
    {"turn": "T001", "quote": "can you hear me okay?", "letter": "OUT", "out_reason": "nothing"},
    {"turn": "T003", "quote": "what made you book this call?", "letter": "S", "object": "design income",
     "register_domain": "money", "register_basis": "answer", "register_turn": "T004",
     "register_quote": "I only make about 1,500 a month from it",
     "answer": {"turn": "T004", "quote": "I only make about 1,500 a month from it"},
     "atoms": [{"type": "SITUATION", "turn": "T004", "quote": "I only make about 1,500 a month from it",
                "quantified": True, "value": 1500, "unit": "month", "figure_kind": "present", "dimension": "revenue",
                "object": "design income"},
               {"type": "SITUATION", "turn": "T004", "quote": "I make about 20,000 a month from it",   # invented
                "quantified": True, "value": 20000, "unit": "month"}]},
    {"turn": "T005", "quote": "How many clients do you have right now?", "letter": "S", "object": "finding clients",
     "register_domain": "clients", "register_basis": "named", "register_quote": "How many clients",
     "atoms": [{"type": "SITUATION", "turn": "T006", "quote": "Right now I have three clients", "quantified": True,
                "value": 3, "unit": "clients", "figure_kind": "present", "dimension": "clients",
                "object": "finding clients"}]},
    {"turn": "T007", "quote": "What's been stopping you from getting more clients?", "letter": "P",
     "object": "finding clients", "stopping_question": True, "register_domain": "clients", "register_basis": "named",
     "register_quote": "getting more clients",
     "atoms": [{"type": "BLOCKER", "turn": "T008", "quote": "I don't know where clients will come from",
                "object": "finding clients"},
               {"type": "PAIN", "turn": "T007", "quote": "What's been stopping you from getting more clients?",  # sales
                "object": "finding clients"}]},
    {"turn": "T009", "quote": "what does that do to you outside of work?", "letter": "I", "object": "finding clients",
     "register_domain": "self_belief", "register_basis": "answer", "register_turn": "T010",
     "register_quote": "feel like a fraud",
     "atoms": [{"type": "IMPACT", "turn": "T010", "quote": "It makes me feel like a fraud", "domain": "self_belief",
                "problem_domain": "clients", "object": "finding clients"},
               {"type": "IMPACT", "turn": "T010", "quote": "I'm exhausted from working nights after my day job",
                "domain": "health", "problem_domain": "clients", "object": "finding clients"}]},
    {"turn": "T011", "quote": "how does that affect your family?", "letter": "I", "object": "finding clients",
     "register_domain": "family", "register_basis": "named", "register_quote": "your family",
     "atoms": [{"type": "IMPACT", "turn": "T012", "quote": "I miss dinner three nights a week", "domain": "family",
                "problem_domain": "clients", "quantified": True, "value": 3, "unit": "nights a week",
                "object": "finding clients"}]},
    {"turn": "T013", "quote": "Where do you want to be in twelve months?", "letter": "N", "object": "design income",
     "register_domain": "money", "register_basis": "answer", "register_turn": "T014",
     "register_quote": "make 6,000 a month",
     "atoms": [{"type": "DESIRE", "turn": "T014", "quote": "I want to make 6,000 a month from design",
                "quantified": True, "value": 6000, "unit": "month", "dimension": "revenue", "object": "design income"}]},
    {"turn": "T015", "quote": "And why does that matter to you?", "letter": "N", "object": "design income",
     "register_domain": "family", "register_basis": "answer", "register_turn": "T016",
     "register_quote": "home when my kids get back from school",
     "atoms": [{"type": "VALUE", "turn": "T016", "quote": "So I can be home when my kids get back from school",
                "object": "design income"}]},
    {"turn": "T014", "quote": "I want to make 6,000 a month", "letter": "N"},                 # a prospect turn: dropped
    {"turn": "T025", "quote": "Do you have any questions about how the weekly calls work?", "letter": "OUT",
     "out_reason": "offer_info"},                                                             # after the pitch: dropped
]}

S2 = {"passages": [{
    "turns": ["T017"],
    "clauses": [
        {"component": "A", "sales_turn": "T017", "sales_quote": "you're at 1,500 a month", "source_turn": "T004",
         "key_expression": "1,500 a month"},
        {"component": "B", "sales_turn": "T017", "sales_quote": "you want to make 6,000 a month", "source_turn": "T014",
         "key_expression": "make 6,000 a month"},
        {"component": "PROBLEM", "sales_turn": "T017",
         "sales_quote": "what's holding you back is you don't know where clients will come from", "source_turn": "T008",
         "key_expression": "don't know where clients will come from", "as_holding_back": True},
        {"component": "COST", "sales_turn": "T017", "sales_quote": "you miss dinner three nights a week",
         "source_turn": "T012", "key_expression": "miss dinner three nights a week"}],
    "validation": {"turn": "T018", "outcome": "confirmed_with_content", "agreement_quote": "Yes, exactly",
                   "content_quote": "honestly it has been eating at me for a long time"}}],
    "deadlines": [{"turn": "T014", "quote": "so I can quit my job by next summer", "horizon": "by next summer",
                   "binding": False}]}

S3 = {
    "category": {"category": "Acquisition", "quote": "I don't know where clients will come from", "turn": "T008"},
    "step1": {"step": {"start_turn": "T021", "start_quote": "What's blocking you today",
                       "end_turn": "T021", "end_quote": "where clients will come from."}, "other_blockers": []},
    "step2": {"step": {"start_turn": "T021", "start_quote": "What makes that give way",
                       "end_turn": "T021", "end_quote": "that's phase two of the mentorship."},
              "mechanisms_stated": [
                  {"mechanism": "Acquisition", "kind": "principle", "turn": "T021",
                   "quote": "a client acquisition system you run every week"},
                  {"mechanism": "Acquisition", "kind": "phase", "turn": "T021",
                   "quote": "that's phase two of the mentorship"}],
              "recitation": None},
    "step3": {"step": {"start_turn": "T023", "start_quote": "You go from 1,500 a month",
                       "end_turn": "T023", "end_quote": "when your kids get back from school."},
              "A": {"value": 1500, "unit": "a month", "quote": "from 1,500 a month", "turn": "T023"},
              "B": {"value": 6000, "unit": "a month", "quote": "to 6,000 a month", "turn": "T023"},
              "image": {"quote": "you're home when your kids get back from school", "turn": "T023"},
              "image_key_expression": "home when my kids get back from school",
              "image_source": {"quote": "So I can be home when my kids get back from school", "turn": "T016"}},
    "step4": {"cases": []},
    "roadmap": {"roadmap": None, "steps": []},
    "claims": [{"kind": "price", "quote": "The investment is 5,800, or six payments of 1,050", "turn": "T027"},
               {"kind": "figure", "quote": "Our students make 20K a month", "turn": "T027"}],        # invented
    "promises": [],
    "adhesion": [{"quote": "So I would have a system to find clients every week", "turn": "T024",
                  "kind": "appropriation", "gesture": {"quote": "You go from 1,500 a month to 6,000 a month",
                                                       "turn": "T023"}}],
}

S4 = {"objections": [
    {"subjects": ["self_capability"], "quotes": [{"turn": "T010", "quote": "It makes me feel like a fraud"}]},  # before pitch
    {"subjects": ["price"], "quotes": [{"turn": "T028", "quote": "That's a lot of money for me right now"}],
     "topic_change": {"turn": "T035", "quote": "do you need to talk to anyone before deciding?"},
     "acknowledge": {"turn": "T029", "quote": "I hear you.", "receiving_marker": True},
     "isolate": {"turn": "T029", "quote": "Apart from the money, is there anything else stopping you?"},
     "explore": {"turn": "T031", "quote": "When you say it's a lot, a lot compared to what?", "open_question": True,
                 "answered_with_content": True, "answer_turn": "T032",
                 "answer_quote": "it's almost four months of income"},
     "gesture": {"answer_given": True, "answer_tied_to_prospect": True, "answer_turn": "T033",
                 "answer_quote": "you would only need one extra client a month to cover it",
                 "gesture_turn": "T033", "gesture_quote": "With the six payments of 1,050"},
     "reaction": {"reaction_kind": "states_no_longer_holds", "turn": "T034",
                  "quote": "at 1,050 a month I can make that work"}},
    {"subjects": ["co_decider"], "quotes": [{"turn": "T036", "quote": "I need to talk to my husband first"}],
     "topic_change": {"turn": "T039", "quote": "Are you ready to get started today?"},
     "acknowledge": {"turn": "T037", "quote": "Totally fair.", "receiving_marker": True},
     "explore": {"turn": "T037", "quote": "What would he want to know?", "open_question": True,
                 "answered_with_content": True, "answer_turn": "T038", "answer_quote": "He would want to know it pays for itself"},
     "gesture": {"answer_given": False},
     "reaction": {"reaction_kind": "agreement_only", "turn": "T038", "quote": "He would want to know it pays for itself"}},
    {"subjects": ["price"], "quotes": [{"turn": "T038", "quote": "the money is still a lot"}]},  # the same objection again
    {"subjects": ["price"], "quotes": [{"turn": "T037", "quote": "Totally fair"}]},              # a sales turn: dropped
    {"subjects": ["offer_trust"], "quotes": [{"turn": "T024", "quote": "So I would have a system"}]},  # pitch, before price
], "prevention": {"influencers": {"turn": "T036", "quote": "we decide together"}}}

ANSWERS = {"lite.s0_phases": S0, "lite.s1_discovery": S1, "lite.s2_gap": S2, "lite.s3_pitch": S3,
           "lite.s4_objections": S4}
