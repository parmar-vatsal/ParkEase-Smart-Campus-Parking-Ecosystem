"""
ParkEase ANPR Server
====================
FastAPI microserver wrapping YOLOv9 + EasyOCR for automatic number plate recognition.

Usage
-----
1. Install dependencies:
   pip install fastapi uvicorn easyocr torch ultralytics pillow numpy opencv-python

2. Place your trained YOLOv9 plate-detection weights at:
   ./yolo.pt   (in the same folder as this file)

3. Start the server:
   python anpr_server.py

   The server listens on http://localhost:8000

API
---
POST /detect
  Body (JSON): { "image": "<base64-encoded JPEG/PNG>" }
  Response:    { "plate": "GJ05AB1234", "confidence": 0.91, "raw": "GJ 05 AB 1234" }
               or
               { "plate": null, "confidence": 0.0, "raw": "" }

GET /health
  Returns:     { "status": "ok", "model": "loaded" }
"""

import base64
import io
import logging
import os
import re
import sys
from pathlib import Path

import cv2
import easyocr
import numpy as np
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("anpr")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="ParkEase ANPR Server", version="1.0.0")

# Allow the React dev server (and any Vercel deploy) to call this local server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # allow all origins — the server is localhost-only anyway
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# ── Global model handles (loaded once at startup) ─────────────────────────────
yolo_model = None
ocr_reader = None

MODEL_PATH = Path(__file__).parent / "yolo.pt"

# Indian number-plate regex – handles both single-line and two-line plates
# Examples: GJ05AB1234  GJ05AB1234  GJ 05 AB 1234
PLATE_RE = re.compile(r"([A-Z]{2})\s*([0-9]{2})\s*([A-Z]{1,2})\s*([0-9]{4})")


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def load_models():
    global yolo_model, ocr_reader

    log.info("Loading EasyOCR (English) …")
    # gpu=False for broad compatibility; set to True if CUDA is available
    ocr_reader = easyocr.Reader(["en"], gpu=False)
    log.info("EasyOCR ready.")

    if MODEL_PATH.exists():
        try:
            from ultralytics import YOLO
            log.info(f"Loading YOLOv9 weights from {MODEL_PATH} …")
            yolo_model = YOLO(str(MODEL_PATH))
            log.info("YOLOv9 model ready.")
        except Exception as exc:
            log.warning(f"Failed to load YOLO model: {exc}. Will run EasyOCR-only mode.")
    else:
        log.warning(
            f"Model file not found at {MODEL_PATH}. Running EasyOCR-only mode. "
            "Plate detection accuracy will be lower."
        )


# ── Request / Response schemas ────────────────────────────────────────────────
class DetectRequest(BaseModel):
    image: str   # base64-encoded image (JPEG or PNG)


class DetectResponse(BaseModel):
    plate: str | None
    confidence: float
    raw: str


# ── Helper: base64 → OpenCV image ────────────────────────────────────────────
def b64_to_cv2(b64_string: str) -> np.ndarray:
    # Strip data-URL prefix when present, e.g. "data:image/jpeg;base64,/9j/..."
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    raw = base64.b64decode(b64_string)
    img_array = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    return img


# ── Helper: clean and validate plate text ─────────────────────────────────────
def clean_plate(text: str) -> tuple[str | None, str]:
    """
    Normalise OCR output and extract a valid Indian plate number.
    Returns (canonical_plate_or_None, raw_joined_text).
    """
    # Join multiple OCR chunks (handles two-line plates)
    cleaned = text.strip().upper()
    # Remove anything that's not A-Z, 0-9 or space
    cleaned = re.sub(r"[^A-Z0-9 ]", "", cleaned)
    # Remove extra spaces
    raw = re.sub(r"\s+", " ", cleaned).strip()

    m = PLATE_RE.search(raw.replace(" ", ""))
    if m:
        canonical = "".join(m.groups())   # e.g. "GJ05AB1234"
        return canonical, raw
    return None, raw


# ── Helper: EasyOCR on a cropped region ──────────────────────────────────────
def ocr_region(img_bgr: np.ndarray) -> tuple[str, float]:
    """
    Run EasyOCR on the given BGR image crop.
    Returns (joined_text, avg_confidence).
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # Upscale small plates for better OCR accuracy
    h, w = gray.shape
    if w < 200:
        scale = 200 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Light threshold to improve contrast
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    results = ocr_reader.readtext(thresh)
    if not results:
        return "", 0.0

    # Concatenate all text chunks (handles two-line plates)
    texts = [r[1] for r in results if r[2] > 0.15]
    confs = [r[2] for r in results if r[2] > 0.15]
    joined = " ".join(texts)
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return joined, avg_conf


# ── Main detection endpoint ───────────────────────────────────────────────────
@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest):
    try:
        img = b64_to_cv2(req.image)
        if img is None:
            return DetectResponse(plate=None, confidence=0.0, raw="")

        # ── Path A: YOLO model available → detect plate region first ──────────
        if yolo_model is not None:
            results = yolo_model(img, verbose=False, conf=0.3)
            best_plate = None
            best_conf = 0.0
            best_raw = ""

            for result in results:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    det_conf = float(box.conf[0])
                    # Crop to detected plate region
                    crop = img[max(0, y1):y2, max(0, x1):x2]
                    if crop.size == 0:
                        continue
                    text, ocr_conf = ocr_region(crop)
                    plate, raw = clean_plate(text)
                    combined_conf = det_conf * 0.5 + ocr_conf * 0.5
                    if plate and combined_conf > best_conf:
                        best_plate = plate
                        best_conf = combined_conf
                        best_raw = raw

            if best_plate:
                log.info(f"[YOLO] Detected: {best_plate}  conf={best_conf:.2f}")
                return DetectResponse(plate=best_plate, confidence=best_conf, raw=best_raw)

        # ── Path B: No YOLO (or YOLO found nothing) → OCR full frame ─────────
        # Crop the centre 80%×40% of the frame (where plates typically appear)
        h, w = img.shape[:2]
        x1 = int(w * 0.10)
        x2 = int(w * 0.90)
        y1 = int(h * 0.30)
        y2 = int(h * 0.70)
        crop = img[y1:y2, x1:x2]

        text, conf = ocr_region(crop)
        plate, raw = clean_plate(text)

        if plate:
            log.info(f"[OCR-only] Detected: {plate}  conf={conf:.2f}")
        else:
            log.debug(f"[OCR-only] No plate found. Raw='{raw}'")

        return DetectResponse(plate=plate, confidence=conf, raw=raw)

    except Exception as exc:
        log.error(f"Detection error: {exc}", exc_info=True)
        return DetectResponse(plate=None, confidence=0.0, raw="")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": "yolo+easyocr" if yolo_model is not None else "easyocr-only",
    }


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "anpr_server:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
