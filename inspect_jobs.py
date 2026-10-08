import sqlite3
import json

conn = sqlite3.connect("backend/shopvision.db")
c = conn.cursor()

for jid in ["job_cdd236eb52", "job_ddee64d2b0", "job_1a9c2ff9f8"]:
    c.execute("SELECT product_id, data FROM products WHERE job_id = ?", (jid,))
    rows = c.fetchall()
    print(f"=== {jid} === Total products: {len(rows)}")
    for r in rows[:15]:
        p = json.loads(r[1])
        print(f"  ID: {p.get('id')} | Track: {p.get('track_id')} | Category: {p.get('category')} | Title: {p.get('title')} | Crop: {p.get('crop_image')} | CatalogImg: {p.get('catalog_image')}")
