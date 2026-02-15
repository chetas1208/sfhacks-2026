#!/usr/bin/env python3
"""
EasyOCR Receipt Scanner – run as subprocess from FastAPI.
Usage:  python ocr_service.py /path/to/image.png
Outputs JSON to stdout.
"""
import sys, json, re, os

def scan(path: str) -> dict:
    try:
        import easyocr
    except ImportError:
        return {"error": "easyocr not installed", "lines": [], "detected_total": 0}

    if not os.path.isfile(path):
        return {"error": f"File not found: {path}"}

    reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    results = reader.readtext(path, detail=1)

    lines = []
    totals = []
    for bbox, text, conf in results:
        lines.append({"text": text, "confidence": round(conf, 3)})
        # Try to find dollar amounts
        amounts = re.findall(r'\$?\d+\.\d{2}', text)
        for a in amounts:
            totals.append(float(a.replace("$", "")))

    detected_total = max(totals) if totals else 0.0

    return {
        "lines": lines,
        "lineCount": len(lines),
        "amounts": totals,
        "detected_total": detected_total,
        "file": os.path.basename(path),
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ocr_service.py <image_path>"}))
        sys.exit(1)
    result = scan(sys.argv[1])
    print(json.dumps(result))
