from playwright.sync_api import sync_playwright
import pathlib
url = pathlib.Path("test-en.html").resolve().as_uri()
def geo(pg):
    return pg.evaluate("""() => { const n=document.querySelector('nav'); const r=n.getBoundingClientRect();
      return {navBottom: Math.round(r.bottom), vh: innerHeight, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, rootW: Math.round(document.querySelector('[data-root]').getBoundingClientRect().width), vw: document.documentElement.clientWidth}; }""")
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh in [(1280, 800), (1920, 1080)]:
        pg = b.new_page(viewport={"width": vw, "height": vh})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        for h in ["cockpit","monjour","decisions","bibliotheque","mechanisms"]:
            pg.goto(url + "#" + h); pg.wait_for_timeout(150)
            print(vw, h, geo(pg))
        print("errors", errs)
        pg.close()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(200)
    pg.get_by_role("link", name="Knowledge System").click(); print("switch ->", pg.locator("h1").first.inner_text(), [a.inner_text() for a in pg.locator("nav a[aria-current=page]").all()])
    pg.locator("nav a", has_text="Mechanisms").click(); print("mech ->", pg.locator("#mech").inner_text())
    pg.get_by_role("button", name="Masterclass production").click(); print("mech sel ->", pg.locator("#mech").inner_text(), "| bottlenecks:", pg.get_by_text("Bottleneck", exact=True).count())
    pg.get_by_role("button", name="Decision loop").click(); print("loop note:", pg.get_by_text("The loop restarts").count())
    pg.screenshot(path="s-mech.png", full_page=True)
    pg.get_by_role("link", name="Operating System").click(); print("switch back ->", pg.locator("h1").first.inner_text())
    pg.locator("nav a", has_text="Decisions").click()
    print("links line:", pg.locator("#links").locator("xpath=..").locator("span").first.inner_text())
    pg.get_by_role("button", name="+ Link a task").click()
    pg.get_by_role("button", name="Follow up with the 3 partners").click()
    print("after add:", pg.locator("#links").locator("xpath=..").locator("span").first.inner_text())
    pg.get_by_role("button", name="Unlink Sign-up email sequence").click()
    print("after unlink:", pg.locator("#links").locator("xpath=..").locator("span").first.inner_text())
    pg.get_by_role("button", name="60-minute live format").click(); print("sel:", pg.locator("#rec").inner_text(), "| actual:", pg.get_by_text("Actual outcome").count())
    pg.screenshot(path="s-dec.png", full_page=True)
    print("errors", errs)
    b.close()
