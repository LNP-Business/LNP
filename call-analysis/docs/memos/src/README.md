# Sources des mémos

Les mémos LNP de l'analyse d'appel (en français, la méthode du dépôt fait foi) : un fichier `memo_*.body.html` par mémo,
mis en page par `build_memos.py` (`memo.css`, en-tête) et imprimé en PDF A4 par `print_pdf.js` (Chromium, Playwright).

```
python3 call-analysis/docs/memos/src/build_memos.py          # tous les mémos
python3 call-analysis/docs/memos/src/build_memos.py memo_1   # un seul
```

Les exemples des mémos sont inventés : jamais une phrase ni un nom tirés d'un vrai appel.
