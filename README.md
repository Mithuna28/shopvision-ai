# 🛍️ SHOPVISION AI

### AI-Powered Shoppable Video & Product Detection Platform

SHOPVISION AI is an AI-powered video intelligence platform that transforms ordinary videos into **interactive shoppable experiences**.

The system analyzes uploaded videos, detects visible products, tracks them across frames, identifies product information when visually supported, and displays interactive shopping cards directly alongside the detected objects.

Users can explore detected products, view product information, and access available shopping links without leaving the video experience.

---

## ✨ Key Features

### 🎥 AI Video Analysis
- Upload videos for automated analysis.
- Extract and process video frames.
- Detect products and objects appearing in the video.
- Generate synchronized product information.

### 🔍 AI Product Detection
- Detects product categories from real video frames.
- Uses customizable detection vocabulary.
- Supports multiple products within the same video.
- Avoids unrelated product recommendations.

### 🎯 Object Tracking
- Tracks detected objects across video frames.
- Maintains object identity throughout the video.
- Generates stable bounding boxes and trajectories.
- Supports multiple independent product tracks.

### 🧠 Product Intelligence
- Analyzes detected product crops.
- Determines product category and brand when visually supported.
- Uses `Unknown` when reliable identification is not possible.
- Prevents unsupported product information from being fabricated.

### 🛒 Interactive Shopping Cards
- Displays product cards directly over the video.
- Product cards follow the detected object.
- Supports product images and shopping information.
- Provides a `SHOP NOW` action for available product links.

### 👑 Dominant Product Selection

SHOPVISION AI uses a **Weighted Multi-Factor Dominance Scoring Algorithm** to determine which product should receive the primary shopping card.

The system considers:

- Bounding-box area
- Detection confidence
- Track stability
- Visibility
- Distance from the video center

The dominant product receives the single active shopping card.

This prevents multiple cards from overlapping and keeps the video experience clean.

### ⏱️ Temporal Card Holding

The active product card is held for approximately **3 seconds**.

During the hold:

- The card follows the selected object.
- The system does not continuously switch products.
- After the hold period, dominance is recalculated.
- If another product becomes more dominant, the card switches.

### 🖼️ Product Crops

Each detected track can generate its own crop image.

Example:

```text
job_id_track_1.jpg
job_id_track_2.jpg
job_id_track_3.jpg
