from playwright.sync_api import sync_playwright
import pathlib
url = 'file://' + str(pathlib.Path('skl-os-en.html').resolve())
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1440,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and 'ERR_TUNNEL' not in m.text and errs.append(m.text))
    for h in ['mechprecall','mechsales']:
        pg.goto(url+'#'+h); pg.reload(); pg.wait_for_timeout(800)
        for tab in ['Model','Build','Organs','Control']:
            pg.locator('.sy-tabs button', has_text=tab).click(); pg.wait_for_timeout(400)
            pg.screenshot(path=f'{h}_{tab}.png')
            print(h, tab, len(pg.locator('.sy-col').inner_text()))
    print(errs[:5])
