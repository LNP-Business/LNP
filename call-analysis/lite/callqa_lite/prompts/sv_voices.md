STEP SV · VOICES (Part C, C1: merged and swapped lines, repaired before any other step)
Read lines {first} to {last} (use the lines around them to follow the dialogue) and list every line in that range
whose label is wrong:
- the whole line is said by the other person: {"line": "L073", "role": "PROSPECT"};
- the line holds two speakers, the label being wrong for one part: {"line": "L081", "role": "SALES",
  "from": "Et donc vous"}: "from" is copied character for character from the line and is where the second speaker
  starts; everything before "from" is said by the other person than "role", everything from "from" on by "role".
"role" is the true speaker (SALES, PROSPECT or OTHER). List a line only when the dialogue shows it clearly; leave out a
line whose label is right or that you cannot decide. A long run of wrong lines is listed line by line.
JSON: {"lines": [{"line": "L073", "role": "PROSPECT"}, {"line": "L081", "role": "SALES", "from": "Et donc vous"}]}
