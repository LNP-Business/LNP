from playwright.sync_api import sync_playwright
import pathlib
url = 'file://' + str(pathlib.Path('skl-os-en.html').resolve())
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1440,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type=='error' and errs.append(m.text))
    for h in ['cockpit','monjour','decisions','bibliotheque','mechanisms','mechprecall','mechsales','settings','registers']:
        pg.goto(url+'#'+h); pg.reload(); pg.wait_for_timeout(400)
        print(h, len(pg.inner_text('body')))
    pg.goto(url+'#monjour'); pg.reload(); pg.wait_for_timeout(400); print(pg.inner_text('body')[:600])
    pg.screenshot(path='mj_full.png', full_page=True)
    t = pg.inner_text('body')
    print('Operational alerts' in t, 'Where the week goes' in t)
    acks = pg.locator('button:has-text("Acknowledge")'); print('acks', acks.count())
    acks.first.click(); pg.wait_for_timeout(200); print('after ack', pg.locator('button:has-text("Acknowledge")').count())
    pg.get_by_role('button', name='Critical', exact=False).first.click(); pg.wait_for_timeout(200)
    print('crit rows', pg.locator('button:has-text("Acknowledge")').count())
    pg.screenshot(path='mj_crit.png', full_page=True)
    print('errors', errs)
    b.close()
