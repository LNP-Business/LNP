from playwright.sync_api import sync_playwright
import pathlib
url = pathlib.Path("test.html").resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(400)
    print("cockpit h1:", pg.locator("h1").first.inner_text())
    pg.get_by_role("button", name="Marketing").first.click(); print("marketing view:", pg.locator("#minit").count())
    pg.get_by_role("button", name="Global").first.click()
    for name, label in [("Mon jour","Mon jour"),("Décisions","Décisions"),("Bibliothèque","Bibliothèque")]:
        pg.locator("nav a", has_text=name).first.click(); pg.wait_for_timeout(100)
        print(name, "->", pg.locator("h1").first.inner_text(), "| hash", pg.evaluate("location.hash"))
    pg.locator("nav a", has_text="Mon jour").first.click()
    pg.get_by_role("button", name="Monteur", exact=True).click(); print("monteur tasks:", pg.locator("#taches").count())
    pg.get_by_role("button", name="Explorer").first.click(); print("explorer form:", pg.get_by_text("Lancer l'exploration").count())
    pg.get_by_role("button", name="Méthodologie de cette page").click()
    print("dialog:", pg.get_by_role("dialog").locator("h2").inner_text())
    pg.screenshot(path="shot.png")
    pg.keyboard.press("Escape"); print("dialog after esc:", pg.get_by_role("dialog").count())
    print("errors:", [e for e in errs if "fonts" not in e][:5])
    b.close()
