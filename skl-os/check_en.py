from playwright.sync_api import sync_playwright
import pathlib
url = pathlib.Path("test-en.html").resolve().as_uri()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(400)
    print("cockpit h1:", pg.locator("h1").first.inner_text())
    for v in ["Marketing","Sales","Finance","Overview"]:
        pg.get_by_role("button", name=v, exact=True).first.click()
    for name in ["My Day","Decisions","Library"]:
        pg.locator("nav a", has_text=name).first.click(); pg.wait_for_timeout(100)
        print(name, "->", pg.locator("h1").first.inner_text())
    pg.locator("nav a", has_text="My Day").first.click()
    pg.get_by_role("button", name="Video Editor", exact=True).click()
    pg.get_by_role("button", name="Explore").first.click(); print("explore form:", pg.get_by_text("Start exploration").count())
    pg.locator("nav a", has_text="Cockpit").first.click()
    pg.get_by_role("button", name="How this page works").click()
    print("dialog:", pg.get_by_role("dialog").locator("h2").inner_text())
    pg.screenshot(path="shot-en.png")
    print("page errors:", errs)
    b.close()
