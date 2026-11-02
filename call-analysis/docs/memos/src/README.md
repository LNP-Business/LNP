# Memo sources

`memo_1_spin.py` writes the HTML of the SPIN Discovery memo (Memo 1.1, methodology SPIN v1.3, 29 October 2026);
`print_pdf.js` prints it to A4 with Chromium (Playwright), the same way Memo 1.0 was made.

```
python3 call-analysis/docs/memos/src/memo_1_spin.py /tmp/memo.html
node call-analysis/docs/memos/src/print_pdf.js /tmp/memo.html call-analysis/docs/memos/SKL_Memo_1_SPIN_Discovery.pdf
```

Memos 2 to 4 are still the PDFs of the 25 October 2026 package (no source).
