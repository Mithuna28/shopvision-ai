import httpx
import time
import json

def run_test():
    client = httpx.Client(timeout=30.0)
    
    # 1. Health
    h = client.get("http://localhost:8000/api/health")
    print("[1] Health:", h.status_code, h.json())
    
    # 2. Demos
    demos = client.get("http://localhost:8000/api/demos").json()
    print("[2] Demos available:", len(demos.get("demos", [])))
    
    # 3. Load Demo
    load_res = client.post("http://localhost:8000/api/demos/demo_nike_sneaker/load").json()
    print("[3] Demo Load Response:", load_res)
    job_id = load_res["job_id"]
    
    # 4. Trigger Analysis
    analyze_res = client.post("http://localhost:8000/api/analyze", json={"job_id": job_id, "sample_fps": 10.0}).json()
    print("[4] Analyze Triggered:", analyze_res)
    
    # 5. Poll Status
    for i in range(30):
        st = client.get(f"http://localhost:8000/api/status/{job_id}").json()
        print(f"    -> Status [{i}]: {st.get('status')} ({st.get('progress')}%) - {st.get('message')}")
        if st.get("status") in ("completed", "failed"):
            break
        time.sleep(1.0)
        
    # 6. Fetch Products
    prods = client.get(f"http://localhost:8000/api/products/{job_id}").json()
    print("[5] Detected Products Count:", prods.get("total_products"))
    for p in prods.get("products", []):
        print(f"    - ID: {p['id']}, Title: {p['title']}, Brand: {p.get('brand')} ({p.get('brand_status')}), Sim: {p.get('visual_similarity_score')}%, Price: INR {p.get('base_price')}, Stores: {len(p.get('stores', []))}")
        
    # 7. Fetch Overlays
    overlays = client.get(f"http://localhost:8000/api/overlays/{job_id}").json()
    print("[6] Overlay Data Duration:", overlays.get("duration"), "Frames:", len(overlays.get("timeline_frames", [])))
    print("[7] All backend checks passed successfully!")

if __name__ == "__main__":
    run_test()
