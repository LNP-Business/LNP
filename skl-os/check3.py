from playwright.sync_api import sync_playwright
import pathlib
url = pathlib.Path("test-en.html").resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh in [(1280, 800), (1920, 1080), (2560, 1400)]:
        pg = b.new_page(viewport={"width": vw, "height": vh})
        for h in ["cockpit","monjour","decisions","bibliotheque","mechanisms"]:
            pg.goto("about:blank"); pg.goto(url + "#" + h); pg.wait_for_timeout(150)
            g = pg.evaluate("""() => { const z=parseFloat(getComputedStyle(document.getElementById('app')).zoom)||1; const n=document.querySelector('nav').getBoundingClientRect();
              return {h1: document.querySelector('h1').innerText.slice(0,18), navBottom: Math.round(n.bottom), docH: document.documentElement.scrollHeight, vh: innerHeight, hScroll: document.documentElement.scrollWidth-document.documentElement.clientWidth, zoom: z}; }""")
            ok = g["navBottom"] >= g["vh"] - 1 and abs(g["navBottom"] - g["docH"]) <= 2 and g["hScroll"] == 0
            print(vw, h.ljust(12), "OK " if ok else "BAD", g)
        pg.close()
    b.close()
