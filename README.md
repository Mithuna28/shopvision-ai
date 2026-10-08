# SHOPVISION AI — AI Shoppable Video Product Detection & Tracking Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.10+-EE4C2C.svg?style=flat&logo=pytorch)](https://pytorch.org)
[![YOLO11](https://img.shields.io/badge/YOLO11-Ultralytics-00FFFF.svg?style=flat)](https://github.com/ultralytics/ultralytics)
[![SAM 2](https://img.shields.io/badge/SAM%202-Segmentation%20&%20Tracking-blueviolet.svg?style=flat)](https://github.com/facebookresearch/segment-anything-2)
[![CLIP](https://img.shields.io/badge/CLIP-ViT--B/32-orange.svg?style=flat)](https://openai.com/research/clip)

> **"Turn every moving product inside a video into an interactive, clickable shopping experience."**

**SHOPVISION AI** is a complete, production-quality AI Shoppable Video Platform. It ingests video footage, detects appearing products with **YOLO11**, segments and tracks them seamlessly across motion vectors with **SAM 2 spatio-temporal tracking**, analyzes brand and visual attributes without hallucination, performs **CLIP visual embedding matching** against verified product catalogs, and renders **dynamic interactive shopping cards attached directly to the moving objects inside the HTML5 video player**.

---

## 🌟 Key Capabilities & Features

1. **YOLO11 Candidate Object Detection**:
   - High-confidence bounding box detection across fashion, tech accessories, footwear, bags, electronics, and lifestyle goods.
   - Saliency proposal heuristics and Non-Maximum Suppression (NMS) box deduplication.

2. **SAM 2 Spatio-Temporal Tracking & Segmentation**:
   - Sub-pixel tracking across video frames with identity persistence.
   - Exponential Moving Average (EMA) coordinate trajectory smoothing to eliminate jitter.
   - Adaptive polygon segmentation masks and GrabCut refinement.

3. **Anti-Hallucination Vision-Language Analysis**:
   - Visual attribute extraction (colorways, categories, silhouette, patterns).
   - Strict brand authenticity verification: brands marked as `unknown` when not visibly supported by logos/typography.

4. **CLIP Visual Product Matching**:
   - `sentence-transformers/clip-ViT-B-32` visual embeddings with cosine similarity metric.
   - Transparent similarity scoring (e.g. *88% Visual Similarity*) without deceptive certainty claims.

5. **Verified Multi-Store Shopping Engine**:
   - Multi-retailer price aggregation (Amazon, Myntra, Flipkart, Nike Official, Croma, Tata CLiQ).
   - Real authentic URLs and verifiable pricing with badges (*Official Store*, *Lowest Price*, *Trending*).

6. **Dynamic In-Video Interactive Overlays**:
   - **Letterbox/Pillarbox Aspect-Ratio Math**: Overlay anchors stay attached during viewport resizing and fullscreen.
   - **4-Way Collision Avoidance**: Automatically repositions cards (*Right → Left → Top → Bottom*) when multiple objects are near each other.
   - **Pulsing Target Dot & Bezier Connector**: Glowing animated connector line linking bounding boxes to floating cards.
   - **Compact Mobile Pill Mode**: Collapses cards to micro-pills on small viewports with quick drawer access.

7. **Product Comparison Drawer**:
   - Side-by-side detected video crop vs catalog reference image.
   - One-click store checkout with `target="_blank"` and `rel="noopener noreferrer"`.

8. **Dual-Mode Experience**:
   - **Primary Interactive Mode**: Real-time HTML5 video overlay with responsive SVG vector layer.
   - **Optional Rendered MP4 Export**: High-definition burned-in shopping overlay video with OpenCV vector graphics.

---

## 🏗️ System Architecture

```text
               ┌───────────────────────────────┐
               │         User Upload           │
               └───────────────┬───────────────┘
                               │
                               ▼
               ┌───────────────────────────────┐
               │    7-Stage Async Pipeline     │
               ├───────────────────────────────┤
               │ 1. Frame Extraction           │
               │ 2. YOLO11 Detection           │
               │ 3. SAM 2 Tracking & Smooth    │
               │ 4. Best-Frame Selection       │
               │ 5. Vision-Language Analysis   │
               │ 6. CLIP Visual Matching       │
               │ 7. Dynamic Overlay Generation │
               └───────────────┬───────────────┘
                               │
                               ▼
        ┌───────────────────────────────────────────────┐
        │        Synchronized Interactive Video Player  │
        ├───────────────────────────────────────────────┤
        │  [HTML5 Video] + [SVG Dynamic Layer]          │
        │  ┌──────────────────────────────────────────┐ │
        │  │ 👟  ──────▶  ┌─────────────────────────┐ │ │
        │  │             │ 🛒 Nike Air Force '07    │ │ │
        │  │             │ ₹8,195  [SHOP NOW ↗]     │ │ │
        │  │             └─────────────────────────┘ │ │
        │  └──────────────────────────────────────────┘ │
        └───────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+** (Python 3.10 – 3.14 supported)
- **Node.js 18+** & `npm`
- **NVIDIA GPU** with CUDA (Optional, automatically falls back to CPU)

---

### 1. Backend Setup

```bash
# Navigate to project root
cd "c:/Users/Louie Andrew/Desktop/mithuna pep/SHOPVISION AI"

# Install Python dependencies
pip install -r backend/requirements.txt

# Start the FastAPI Backend (Port 8000)
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be active at: `http://localhost:8000`
Interactive API Docs (Swagger): `http://localhost:8000/docs`

---

### 2. Frontend Setup

```bash
# Open a second terminal window
cd "c:/Users/Louie Andrew/Desktop/mithuna pep/SHOPVISION AI/frontend"

# Install Node dependencies
npm install

# Start the Vite development server (Port 5173)
npm run dev
```

Frontend will be active at: `http://localhost:5173`

---

## 🧪 Running Automated Multi-Scenario Test Suite

Run the end-to-end test suite verifying the 3 core video scenarios:
1. **Single Product Tracking (Nike Sneaker Walk)**
2. **Dual Moving Products (Apple Watch Series 9 + Sony WH-1000XM5)**
3. **Streetwear Outfit (Urban Fit + Crossbody Sling + Shades)**

```bash
python backend/test_all_scenarios.py
```

---

## 📁 Project Directory Structure

```text
SHOPVISION AI/
├── backend/
│   ├── ai/
│   │   ├── yolo_detector.py      # YOLO11 object detection + saliency proposals
│   │   ├── sam_tracker.py        # SAM 2 tracking + trajectory smoothing
│   │   ├── clip_matcher.py       # CLIP visual embeddings & similarity scoring
│   │   └── product_analyzer.py   # Multi-attribute & anti-hallucination analysis
│   ├── video/
│   │   ├── processor.py          # 7-stage asynchronous pipeline orchestrator
│   │   ├── frame_extractor.py    # OpenCV / FFmpeg frame decoding
│   │   ├── overlay_data.py       # Dynamic overlay calculator with collision logic
│   │   ├── exporter.py           # Burned-in MP4 video renderer
│   │   └── demo_generator.py     # Built-in synthetic test scenarios
│   ├── search/
│   │   ├── catalog.py            # Verified multi-store product repository
│   │   └── product_search.py     # Multi-retailer price aggregator
│   ├── db/
│   │   ├── database.py           # Supabase PostgreSQL persistence manager
│   │   └── supabase_schema.sql   # Supabase PostgreSQL schema migration
│   ├── api/
│   │   ├── upload.py             # Video upload & demo loader endpoints
│   │   ├── analysis.py           # Analysis trigger & SSE progress stream
│   │   └── products.py           # Products, overlays, partial video stream, export
│   ├── app.py                    # FastAPI server entrypoint
│   ├── config.py                 # Hardware acceleration & path configuration
│   ├── requirements.txt          # Python package requirements
│   ├── test_pipeline.py          # Single scenario validation test
│   └── test_all_scenarios.py     # Multi-scenario automated test suite
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoPlayer.tsx       # HTML5 player with timeline markers
│   │   │   ├── ShoppingOverlay.tsx   # Real-time SVG dynamic tracking layer
│   │   │   ├── ProductCard.tsx       # Floating glassmorphic card & pill mode
│   │   │   ├── ProductDrawer.tsx     # Multi-store price comparison drawer
│   │   │   ├── UploadBox.tsx         # Drag & drop upload component
│   │   │   ├── DemoSelector.tsx      # One-click demo scenario loader
│   │   │   ├── ProcessingStatus.tsx  # 7-stage real-time progress monitor
│   │   │   ├── ProductSidebar.tsx    # Detected products list & timeline jump
│   │   │   └── ExportModal.tsx       # Burned-in MP4 export modal
│   │   ├── services/
│   │   │   └── api.ts                # REST & SSE API client
│   │   ├── App.tsx                   # Main application layout
│   │   ├── index.css                 # Dark theme glassmorphism tokens
│   │   └── main.tsx                  # React entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── .env.example                      # Configuration template
└── README.md                         # Documentation
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Hardware acceleration status, CUDA GPU device check |
| `POST` | `/api/upload` | Upload MP4 / WebM / MOV / AVI video file |
| `GET` | `/api/demos` | List available pre-generated test scenarios |
| `POST` | `/api/demos/{demo_id}/load` | Load a demo video instantly into the pipeline |
| `POST` | `/api/analyze` | Trigger asynchronous 7-stage video analysis |
| `GET` | `/api/status/{job_id}` | Query real-time processing status and stage |
| `GET` | `/api/status/{job_id}/stream` | Server-Sent Events (SSE) live progress stream |
| `GET` | `/api/video/{job_id}` | HTTP 206 Partial Content video streaming |
| `GET` | `/api/products/{job_id}` | Retrieve detected products with multi-store prices |
| `GET` | `/api/overlays/{job_id}` | Retrieve normalized coordinates and collision-resolved overlays |
| `POST` | `/api/export/{job_id}` | Render burned-in MP4 export with overlay graphics |
| `GET` | `/api/export/{job_id}/download`| Download rendered export MP4 |

---

## 🛡️ Anti-Hallucination & Security Standard

- **No Fabricated URLs**: All outbound links direct to authentic verified store domains.
- **No Hallucinated Brands**: If a brand mark is not detected or visually ambiguous, `brand_status` is strictly assigned to `"unknown"`.
- **Accurate Confidence Disclosures**: Visual matching explicitly distinguishes between *Exact Visual Match*, *Likely Match*, and *Visual Similarity %*.
- **CORS & Safe File Handling**: Secure random UUID identifiers, file extension and size validation, sanitization of uploaded filenames.

---

## ⚖️ License
MIT License. Built for **SHOPVISION AI**.
