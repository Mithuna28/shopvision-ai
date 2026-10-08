import sqlite3
import json

conn = sqlite3.connect("backend/shopvision.db")
c = conn.cursor()
c.execute("SELECT product_id, data FROM products WHERE job_id = ?", ("job_cdd236eb52",))
rows = c.fetchall()
print(f"Total: {len(rows)}")
for r in rows:
    p = json.loads(r[1])
    print(f"ID: {p['id']} | Track: {p.get('track_id')} | Category: {p.get('category')} | Type: {p.get('product_type')} | Title: {p.get('title')} | CatalogImg: {p.get('catalog_image')} | Crop: {p.get('crop_image')}")
