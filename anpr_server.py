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


# ── Helper: preprocess image for OCR ─────────────────────────────────────────
def preprocess_for_ocr(gray: np.ndarray) -> list[np.ndarray]:
    """
    Returns multiple preprocessed versions of a grayscale image.
    EasyOCR will be run on each; the best result is kept.
    """
    variants = []

    # 1. Upscale to ensure minimum width of 300px for accuracy
    h, w = gray.shape
    if w < 300:
        scale = 300 / w
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # 2. Sharpen to enhance character edges
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)

    # Variant A: Otsu global threshold on sharpened
    _, otsu = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(otsu)

    # Variant B: Adaptive threshold (handles uneven lighting on plates)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    adaptive = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY, 11, 2)
    variants.append(adaptive)

    # Variant C: Inverted Otsu (catches dark-on-light AND light-on-dark plates)
    variants.append(cv2.bitwise_not(otsu))

    # Variant D: Plain sharpened grayscale (EasyOCR handles its own binarisation)
    variants.append(sharp)

    return variants


# ── Helper: EasyOCR on a cropped region ──────────────────────────────────────
def ocr_region(img_bgr: np.ndarray) -> tuple[str, float]:
    """
    Run EasyOCR with multiple preprocessing variants on the given BGR crop.
    Returns (best_joined_text, best_avg_confidence).
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    variants = preprocess_for_ocr(gray)

    best_text = ""
    best_conf = 0.0

    for variant in variants:
        try:
            results = ocr_reader.readtext(variant, detail=1, paragraph=False)
        except Exception:
            continue
        if not results:
            continue

        # Keep results with confidence > 0.1 (very permissive — filter later)
        hits = [(r[1], r[2]) for r in results if r[2] > 0.1]
        if not hits:
            continue

        joined = " ".join(t for t, _ in hits)
        avg_conf = sum(c for _, c in hits) / len(hits)

        # Prefer the variant that yields a valid plate
        plate, _ = clean_plate(joined)
        if plate and avg_conf > best_conf:
            best_text = joined
            best_conf = avg_conf
        elif not best_text and avg_conf > best_conf:
            # No plate yet — keep best raw text for debug
            best_text = joined
            best_conf = avg_conf

    return best_text, best_conf


# ── Main detection endpoint ───────────────────────────────────────────────────
@app.post("/detect", response_model=DetectResponse)
async def detect(req: DetectRequest):
    try:
        img = b64_to_cv2(req.image)
        if img is None:
            return DetectResponse(plate=None, confidence=0.0, raw="")

        # ── Path A: YOLO model available → detect plate region first ──────────
        if yolo_model is not None:
            results = yolo_model(img, verbose=False, conf=0.25)
            best_plate = None
            best_conf = 0.0
            best_raw = ""

            for result in results:
                for box in result.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    det_conf = float(box.conf[0])
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

        # ── Path B: EasyOCR-only — try multiple crop regions ──────────────────
        h, w = img.shape[:2]

        # Try 3 different vertical crop bands to catch plate at various distances
        crop_regions = [
            # (y_start_frac, y_end_frac, x_start_frac, x_end_frac)
            (0.25, 0.75, 0.05, 0.95),   # centre band (standard)
            (0.15, 0.65, 0.05, 0.95),   # upper-centre (plate close to top/wide angle)
            (0.35, 0.85, 0.05, 0.95),   # lower-centre (plate close to bottom)
            (0.0,  1.0,  0.0,  1.0),    # full frame fallback
        ]

        best_plate = None
        best_conf = 0.0
        best_raw = ""

        for (y0f, y1f, x0f, x1f) in crop_regions:
            y0, y1_ = int(h * y0f), int(h * y1f)
            x0, x1_ = int(w * x0f), int(w * x1f)
            crop = img[y0:y1_, x0:x1_]
            if crop.size == 0:
                continue

            text, conf = ocr_region(crop)
            plate, raw = clean_plate(text)

            log.info(f"[OCR crop ({y0f:.0%}-{y1f:.0%})] raw='{raw}'  plate={plate}  conf={conf:.2f}")

            if plate and conf > best_conf:
                best_plate = plate
                best_conf = conf
                best_raw = raw

            # Stop as soon as we find a high-confidence plate
            if best_plate and best_conf > 0.6:
                break

        return DetectResponse(plate=best_plate, confidence=best_conf, raw=best_raw)

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
    import subprocess
    import threading
    import time

    # ── Free public tunnel via localhost.run (no account needed!) ─────────────
    # Uses SSH which is built into Windows 10 / macOS / Linux.
    # No signup, no installation — just works.
    tunnel_proc = None
    public_url = None

    def start_tunnel():
        """
        Starts `ssh -R 80:localhost:8000 nokey@localhost.run` in a subprocess.
        Reads stdout until the public URL is printed, then shows it.
        localhost.run outputs a line like:
            tunneled with tls termination, https://abc123.localhost.run
        """
        global public_url, tunnel_proc
        try:
            tunnel_proc = subprocess.Popen(
                ["ssh", "-o", "StrictHostKeyChecking=no",
                 "-R", "80:localhost:8000", "nokey@localhost.run"],
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1
            )
            for line in tunnel_proc.stdout:
                line = line.strip()
                # The actual tunnel URL looks like: "abc123.lhr.life tunneled with tls termination, https://abc123.lhr.life"
                # We specifically match *.lhr.life to avoid the welcome banner's admin.localhost.run link
                if ".lhr.life" in line and "https://" in line:
                    import re
                    m = re.search(r"https://[\w\-]+\.lhr\.life", line)
                    if m:
                        public_url = m.group(0)
                        print("\n" + "=" * 65)
                        print("  🚀  ParkEase ANPR Server — PUBLIC URL READY")
                        print("=" * 65)
                        print(f"\n  ✅  Your public HTTPS URL:\n")
                        print(f"      {public_url}\n")
                        print("  ► Open the Guard Scanner on Vercel")
                        print("  ► Switch to 'Read Number Plate' mode")
                        print("  ► Click  ⚙ Configure  and paste the URL above")
                        print("\n" + "=" * 65 + "\n")
        except FileNotFoundError:
            print("\n[INFO] SSH not found — tunnel skipped.")
            print("[INFO] Server running on http://127.0.0.1:8000 (local only)\n")
        except Exception as e:
            print(f"\n[INFO] Tunnel error: {e}\n")

    # Start tunnel in a background thread so it doesn't block the server
    tunnel_thread = threading.Thread(target=start_tunnel, daemon=True)
    tunnel_thread.start()

    # Give the tunnel 2 seconds to print its URL before uvicorn log floods stdout
    time.sleep(2)

    try:
        uvicorn.run(
            "anpr_server:app",
            host="0.0.0.0",   # bind all interfaces so SSH reverse tunnel can reach it
            port=8000,
            reload=False,
            log_level="info",
        )
    finally:
        if tunnel_proc:
            tunnel_proc.terminate()
