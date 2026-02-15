from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import asyncio
import os
import jwt
import json
import re
import sys
import tempfile
import subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv
import httpx

from backend import db

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
load_dotenv(os.path.join(PROJECT_ROOT, ".env.example"))

app = FastAPI()

# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Next.js proxy handles this, but good for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── JWT ────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "secret")
ALGORITHM = "HS256"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
POINTS_PER_USD = float(os.getenv("POINTS_PER_USD", "0.5"))
CRS_BASE_URL = os.getenv("CRS_BASE_URL", "https://api-sandbox.stitchcredit.com:443/api").rstrip("/")
CRS_USERNAME = os.getenv("CRS_USERNAME", "")
CRS_PASSWORD = os.getenv("CRS_PASSWORD", "")
CRS_TIMEOUT_SECONDS = float(os.getenv("CRS_TIMEOUT_SECONDS", "25"))
CRS_STRICT_MODE = os.getenv("CRS_STRICT_MODE", "false").lower() in {"1", "true", "yes", "on"}

_crs_token: Optional[str] = None
_crs_refresh_token: Optional[str] = None
_crs_token_expiry: float = 0.0
OCR_SCRIPT_PATH = os.path.join(PROJECT_ROOT, "services", "ocr_service.py")

def create_token(email: str, role: str, user_id: int) -> str:
    payload = {
        "sub": email,
        "uid": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

# ── Models ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class KYCRequest(BaseModel):
    firstName: str
    lastName: str
    ssn: str
    dob: str
    address: str
    city: str
    state: str
    zip: str
    phone: str
    # FlexID response simulated
    flexIdScore: Optional[int] = None

class FraudCheckRequest(BaseModel):
    # Simulated browser data
    deviceId: str
    ip: str

class ClaimRequest(BaseModel):
    category: str  # "Bart", "CalTrain", "MUNI", "Bike charging", "EV charging"
    date: str
    description: Optional[str] = None
class ClaimRequest(BaseModel):
    category: str  # "Bart", "CalTrain", "MUNI", "Bike charging", "EV charging"
    date: str
    description: Optional[str] = None
    receiptNumber: str
    amount: float

class AiChatRequest(BaseModel):
    message: str

# ── CRS helpers ────────────────────────────────────────────

def _has_crs_credentials() -> bool:
    return bool(CRS_USERNAME and CRS_PASSWORD and not CRS_USERNAME.startswith("your-"))

def _normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    return digits or "5031234567"

def _safe_float(value) -> Optional[float]:
    try:
        return float(value)
    except Exception:
        return None

def _walk_values(node):
    if isinstance(node, dict):
        for key, value in node.items():
            yield key, value
            yield from _walk_values(value)
    elif isinstance(node, list):
        for entry in node:
            yield from _walk_values(entry)

def _extract_risk_score(payload: dict) -> Optional[float]:
    keys = {"riskscore", "risk_score", "fraudscore", "score"}
    for key, value in _walk_values(payload):
        k = str(key).lower().replace(" ", "").replace("-", "_")
        if k in keys:
            parsed = _safe_float(value)
            if parsed is not None:
                return max(0.0, min(parsed, 100.0))
    return None

def _extract_fraud_signal(payload: dict) -> Optional[bool]:
    for key, value in _walk_values(payload):
        k = str(key).lower()
        if "fraud" in k or "suspicious" in k:
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return float(value) > 0
            text = str(value).lower()
            if any(token in text for token in ["clear", "pass", "low", "safe", "no fraud"]):
                return False
            if any(token in text for token in ["fraud", "high", "fail", "review", "flag"]):
                return True
    return None

def _is_retryable_crs_error(detail: str) -> bool:
    text = (detail or "").upper()
    retryable_codes = {"CRS779", "CRS778", "CRS601", "CRS109", "CRS100", "500 INTERNAL_SERVER_ERROR"}
    if any(code in text for code in retryable_codes):
        return True
    return any(
        token in text
        for token in [
            "SERVICE ERROR",
            "SERVICE UNAVAILABLE",
            "EMPTY RESPONSE",
            "TIMEOUT",
            "INTERNAL_SERVER_ERROR",
            "CANNOT DESERIALIZE",
        ]
    )

def _extract_amount_from_lines(lines: List[str], detected_total: float) -> float:
    amounts: List[float] = []
    prioritized: List[float] = []
    money_regex = re.compile(r"\$?\s*([0-9]+(?:\.[0-9]{2}))")
    priority_words = ("total", "amount", "paid", "balance", "due")

    for line in lines:
        lower = line.lower()
        line_amounts: List[float] = []
        for raw in money_regex.findall(line):
            try:
                value = float(raw)
                if value > 0:
                    line_amounts.append(value)
            except Exception:
                continue
        amounts.extend(line_amounts)
        if line_amounts and any(word in lower for word in priority_words):
            prioritized.extend(line_amounts)

    if detected_total and detected_total > 0:
        amounts.append(float(detected_total))
        prioritized.append(float(detected_total))

    if prioritized:
        return round(max(prioritized), 2)

    if amounts:
        return round(max(amounts), 2)

    # Fallback: parse integer amount only if explicitly marked with '$'
    for line in lines:
        for raw in re.findall(r"\$\s*([0-9]+)", line):
            try:
                value = float(raw)
                if value > 0:
                    amounts.append(value)
            except Exception:
                continue

    if amounts:
        return round(max(amounts), 2)

    # Final fallback
    if detected_total and detected_total > 0:
        return round(float(detected_total), 2)

    if not detected_total:
        return 0.0

    return round(float(detected_total), 2)

def _extract_receipt_number(lines: List[str]) -> str:
    keyword = re.compile(
        r"(?:receipt|invoice|order|txn|transaction|reference|ref|id|number|no\.?)\s*[:#-]?\s*([A-Z0-9-]{4,})",
        re.IGNORECASE,
    )
    for line in lines:
        match = keyword.search(line)
        if match:
            return match.group(1).upper()

    generic = re.compile(r"\b[A-Z0-9-]{6,}\b")
    for idx, line in enumerate(lines):
        if re.search(r"(receipt|invoice|order|txn|transaction|reference|ref|id|number|no\.?)", line, re.IGNORECASE):
            if idx + 1 < len(lines):
                next_line = lines[idx + 1].upper()
                match = generic.search(next_line)
                if match:
                    return match.group(0)

    for line in lines:
        match = generic.search(line.upper())
        if match:
            return match.group(0)

    return f"OCR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

def _extract_receipt_date(lines: List[str]) -> str:
    merged = " ".join(lines)
    candidates = [
        (r"\b(\d{4}-\d{2}-\d{2})\b", ["%Y-%m-%d"]),
        (r"\b(\d{2}/\d{2}/\d{4})\b", ["%m/%d/%Y"]),
        (r"\b(\d{2}/\d{2}/\d{2})\b", ["%m/%d/%y"]),
        (r"\b(\d{2}-\d{2}-\d{4})\b", ["%m-%d-%Y"]),
    ]

    for pattern, formats in candidates:
        match = re.search(pattern, merged)
        if not match:
            continue
        raw = match.group(1)
        for fmt in formats:
            try:
                return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
            except Exception:
                continue

    return datetime.utcnow().strftime("%Y-%m-%d")

def _suggest_category(lines: List[str]) -> str:
    text = " ".join(lines).lower()
    mapping = [
        ("EV charging", ["ev", "charger", "charging", "kwh", "supercharger", "chargepoint"]),
        ("Bart", ["bart"]),
        ("CalTrain", ["caltrain"]),
        ("MUNI", ["muni"]),
        ("Bike charging", ["bike", "bicycle"]),
    ]
    for category, keywords in mapping:
        if any(keyword in text for keyword in keywords):
            return category
    return "EV charging"

async def _crs_login(client: httpx.AsyncClient) -> str:
    global _crs_token, _crs_refresh_token, _crs_token_expiry
    if _crs_token and datetime.utcnow().timestamp() < _crs_token_expiry:
        return _crs_token

    if not _has_crs_credentials():
        raise HTTPException(500, "CRS credentials are not configured.")

    response = await client.post(
        f"{CRS_BASE_URL}/users/login",
        json={"username": CRS_USERNAME, "password": CRS_PASSWORD},
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    if response.status_code >= 400:
        raise HTTPException(502, f"CRS login failed: {response.text}")

    data = response.json()
    token = data.get("token")
    if not token:
        raise HTTPException(502, "CRS login did not return a token.")

    expires = int(data.get("expires", 3600))
    _crs_token = token
    _crs_refresh_token = data.get("refreshToken")
    _crs_token_expiry = datetime.utcnow().timestamp() + max(30, expires - 60)
    return token

async def _crs_post(path: str, payload: dict) -> tuple[dict, Optional[str]]:
    async with httpx.AsyncClient(timeout=CRS_TIMEOUT_SECONDS) as client:
        token = await _crs_login(client)
        response = await client.post(
            f"{CRS_BASE_URL}{path}",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        if response.status_code >= 400:
            raise HTTPException(502, f"CRS {path} failed: {response.text}")
        request_id = response.headers.get("RequestID") or response.headers.get("requestid")
        return response.json(), request_id

# ── Endpoints ──────────────────────────────────────────────

@app.get("/api/health")
def health():
    return db.health_info()

@app.post("/api/seed")
def seed_db():
    return db.seed()

# ── Auth ───────────────────────────────────────────────────

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    # Strict Fraud Check
    if db.find_one("fraud_users", "email", req.email):
        raise HTTPException(status_code=403, detail="Registration denied: Email flagged for fraud.")
    
    # Check if exists in verified
    if db.find_one("verified_users", "email", req.email):
        raise HTTPException(status_code=409, detail="Email already exists")
    
    uid = db.next_id()
    new_user = {
        "name": req.name,
        "email": req.email,
        "password": req.password, # Plaintext for hackathon
        "role": "USER",
        "kycComplete": False,
        "fraudClear": False,
        "createdAt": db.now_iso()
    }
    db.put("verified_users", uid, new_user)
    
    # Create empty wallet with 100 free credits
    db.put("user_wallets", uid, {"email": req.email, "balance": 100})
    
    token = create_token(req.email, "USER", uid)
    return {"token": token, "user": {**new_user, "_id": uid}, "flow": "kyc"}

@app.post("/api/auth/login")
def login(req: LoginRequest):
    # Retry logic for eventual consistency
    user = None
    print(f"[auth] Login attempt for {req.email}")
    for i in range(5):
        user = db.find_one("verified_users", "email", req.email)
        if user: 
            print(f"[auth] Found user on attempt {i+1}")
            break
        print(f"[auth] User not found, retrying {i+1}/5...")
        if i < 4:
            import time
            time.sleep(1)
            
    if not user:
        # Check fraud users
        if db.find_one("fraud_users", "email", req.email):
            raise HTTPException(status_code=403, detail="Account suspended due to fraud activity")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user["password"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["email"], user.get("role", "USER"), user["_id"])
    
    # Determine flow
    if not user.get("kycComplete"):
        return {"token": token, "user": user, "flow": "kyc"}
    if not user.get("fraudClear"):
        return {"token": token, "user": user, "flow": "fraud"}
    
    return {"token": token, "user": user, "flow": "dashboard"}

# Helper to get user from token
def get_user_from_header(authorization: str):
    if not authorization: return None
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer': return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        
        # Try ID lookup first (Immediate consistency)
        if "uid" in payload:
            u = db.get_by_id("verified_users", payload["uid"])
            if u: return u

        # Fallback to email lookup
        return db.find_one("verified_users", "email", payload["sub"])
    except:
        return None

@app.get("/api/auth/me")
def me(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    return user

@app.get("/api/profile")
def get_profile(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    # Get wallet
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet: wallet = {"balance": 0}
    
    # Get transactions (history)
    txs = db.find_by("transactions", "email", user["email"], limit=50)
    # Sort by timestamp desc
    txs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    
    return {
        "user": user,
        "balance": wallet.get("balance", 0),
        "transactions": txs
    }

@app.post("/api/kyc")
async def submit_kyc(req: KYCRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")

    crs_body = {
        "firstName": req.firstName,
        "lastName": req.lastName,
        "ssn": req.ssn,
        "dateOfBirth": req.dob,
        "streetAddress": req.address,
        "city": req.city,
        "state": req.state,
        "zipCode": req.zip,
        "homePhone": _normalize_phone(req.phone),
    }

    crs_response: dict = {}
    request_id: Optional[str] = None
    kyc_source = "CRS FlexID"
    kyc_fallback = False
    kyc_fallback_reason = None

    for attempt in range(2):
        try:
            crs_response, request_id = await _crs_post("/flex-id/flex-id", crs_body)
            break
        except HTTPException as exc:
            detail = str(exc.detail)
            if attempt == 0 and _is_retryable_crs_error(detail):
                await asyncio.sleep(0.4)
                continue
            if not CRS_STRICT_MODE and _is_retryable_crs_error(detail):
                kyc_fallback = True
                kyc_fallback_reason = detail
                kyc_source = "CRS FlexID (fallback)"
                break
            raise

    codes = crs_response.get("codes") if isinstance(crs_response, dict) else None
    if isinstance(codes, list) and len(codes) > 0:
        raise HTTPException(400, f"KYC verification failed: {codes}")

    updated_user = {
        **user,
        **req.dict(),
        "kycComplete": True,
        "kycSource": kyc_source,
        "kycRequestId": request_id,
        "kycVerifiedAt": db.now_iso(),
        "kycFallback": kyc_fallback,
        "kycFallbackReason": kyc_fallback_reason,
    }
    db.put("verified_users", user["_id"], updated_user)

    return {
        "status": "success",
        "flow": "fraud",
        "source": "crs",
        "requestId": request_id,
        "fallback": kyc_fallback,
    }

@app.post("/api/fraud")
async def check_fraud(req: FraudCheckRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")

    fraud_body = {
        "firstName": user.get("firstName") or user.get("name", "User").split(" ")[0],
        "lastName": user.get("lastName") or "Unknown",
        "phoneNumber": _normalize_phone(user.get("phone", "")),
        "email": user.get("email", ""),
        "ipAddress": req.ip,
        "address": {
            "addressLine1": user.get("address", "Unknown"),
            "city": user.get("city", "Unknown"),
            "state": user.get("state", "NA"),
            "postalCode": user.get("zip", "00000"),
        },
    }

    crs_response: dict = {}
    request_id: Optional[str] = None
    fraud_source = "CRS Fraud Finder"
    fraud_fallback = False
    fraud_fallback_reason = None

    for attempt in range(2):
        try:
            crs_response, request_id = await _crs_post("/fraud-finder/fraud-finder", fraud_body)
            break
        except HTTPException as exc:
            detail = str(exc.detail)
            if attempt == 0 and _is_retryable_crs_error(detail):
                await asyncio.sleep(0.4)
                continue
            if not CRS_STRICT_MODE and _is_retryable_crs_error(detail):
                fraud_fallback = True
                fraud_fallback_reason = detail
                fraud_source = "CRS Fraud Finder (fallback)"
                break
            raise

    risk_score = _extract_risk_score(crs_response)
    fraud_signal = _extract_fraud_signal(crs_response)
    clear = not fraud_signal if fraud_signal is not None else True
    if risk_score is not None:
        clear = clear and risk_score < 60

    if not clear:
        db.delete_record("verified_users", user["_id"])
        db.put(
            "fraud_users",
            user["_id"],
            {
                **user,
                "fraudClear": False,
                "fraudReason": "CRS Fraud Finder review required",
                "fraudScore": risk_score,
                "fraudRequestId": request_id,
                "fraudSource": fraud_source,
                "fraudCheckedAt": db.now_iso(),
                "fraudFallback": fraud_fallback,
                "fraudFallbackReason": fraud_fallback_reason,
            },
        )
        raise HTTPException(403, "Fraud check failed. Account moved to review.")

    updated_user = {
        **user,
        "fraudClear": True,
        "fraudScore": risk_score if risk_score is not None else 10,
        "fraudRequestId": request_id,
        "fraudSource": fraud_source,
        "fraudCheckedAt": db.now_iso(),
        "fraudFallback": fraud_fallback,
        "fraudFallbackReason": fraud_fallback_reason,
    }
    db.put("verified_users", user["_id"], updated_user)

    return {
        "status": "safe",
        "flow": "green-score",
        "source": "crs",
        "riskScore": updated_user["fraudScore"],
        "requestId": request_id,
        "fallback": fraud_fallback,
    }

@app.post("/api/green-score")
def calc_green_score(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    # Simulate score calculation
    score = 650 # Base
    if user.get("kycComplete"): score += 50
    if user.get("fraudClear"): score += 50
    
    # Save current score to user profile
    updated_user = {**user, "greenScore": score}
    db.put("verified_users", user["_id"], updated_user)
    
    # Save history to green_scores collection
    score_history = {
        "email": user["email"],
        "score": score,
        "timestamp": db.now_iso()
    }
    db.put("green_scores", db.next_id(), score_history)
    
    return {"score": score, "flow": "dashboard"}

# ── Claims ─────────────────────────────────────────────────

@app.post("/api/claims/analyze-image")
async def analyze_claim_image(file: UploadFile = File(...), authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user:
        raise HTTPException(401, "Unauthorized")

    if not file:
        raise HTTPException(400, "Image file is required")

    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
    if len(suffix) > 10:
        suffix = ".jpg"

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            content = await file.read()
            if not content:
                raise HTTPException(400, "Uploaded image is empty")
            temp.write(content)
            temp_path = temp.name

        result = subprocess.run(
            [sys.executable, OCR_SCRIPT_PATH, temp_path],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )
        output = (result.stdout or "").strip()
        if not output:
            raise HTTPException(502, f"OCR process failed: {(result.stderr or '').strip()[:200]}")

        try:
            parsed = json.loads(output)
        except Exception:
            raise HTTPException(502, "OCR returned invalid output")

        if parsed.get("error"):
            raise HTTPException(502, f"OCR failed: {parsed.get('error')}")

        lines_raw = parsed.get("lines", [])
        lines = [str(line.get("text", "")).strip() for line in lines_raw if str(line.get("text", "")).strip()]
        detected_total = float(parsed.get("detected_total") or 0.0)
        amount = _extract_amount_from_lines(lines, detected_total)
        receipt_number = _extract_receipt_number(lines)
        receipt_date = _extract_receipt_date(lines)
        category = _suggest_category(lines)
        points = round(amount * POINTS_PER_USD, 2)
        description = " ".join(lines[:5]).strip()
        if len(description) > 180:
            description = description[:180]

        return {
            "status": "ok",
            "category": category,
            "date": receipt_date,
            "receiptNumber": receipt_number,
            "amount": amount,
            "estimatedPoints": points,
            "description": description,
            "linesPreview": lines[:12],
            "lineCount": len(lines),
            "model": "easyocr",
            "warning": "Could not detect a total amount confidently." if amount <= 0 else None,
        }
    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Image analysis timed out")
    except Exception as e:
        raise HTTPException(502, f"Image analysis failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/api/claims")
def submit_claim(req: ClaimRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    
    # Check for duplicate receipt
    if db.find_one("claims", "receiptNumber", req.receiptNumber):
        raise HTTPException(status_code=400, detail="Duplicate receipt number. Claim rejected.")

    # Credits logic: configurable conversion
    points = round(req.amount * POINTS_PER_USD, 2)
    
    # Save claim
    claim = {
        "email": user["email"],
        "category": req.category,
        "date": req.date,
        "description": req.description,
        "receiptNumber": req.receiptNumber,
        "amount": req.amount,
        "pointsAwarded": points,
        "status": "APPROVED",
        "timestamp": db.now_iso()
    }
    db.put("claims", db.next_id(), claim)
    
    # Update wallet
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet:
        wallet = {"email": user["email"], "balance": 0}
        
    new_balance = wallet.get("balance", 0) + points
    db.put("user_wallets", int(wallet.get("_id", db.next_id())), {**wallet, "balance": new_balance})
    
    # Record transaction
    tx = {
        "email": user["email"],
        "type": "EARN",
        "description": f"Claim: {req.category} (#{req.receiptNumber})",
        "amount": points,
        "timestamp": db.now_iso()
    }
    db.put("transactions", db.next_id(), tx)
    
    return {"status": "approved", "points": points, "balance": new_balance}



# ── Marketplace ────────────────────────────────────────────

@app.get("/api/marketplace")
def get_marketplace(type: Optional[str] = None):
    items = db.get_all("marketplace")
    if type:
        items = [i for i in items if i.get("type") == type]
    return items

@app.post("/api/marketplace/redeem")
def redeem_item(item_id: int, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    item = db.get_by_id("marketplace", item_id)
    if not item: raise HTTPException(404, "Item not found")
    
    cost = item.get("cost", 0)
    
    # Check balance
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet or wallet.get("balance", 0) < cost:
        raise HTTPException(400, "Insufficient balance")
        
    # Deduct
    new_balance = wallet["balance"] - cost
    db.put("user_wallets", wallet["_id"], {**wallet, "balance": new_balance})
    
    # Record transaction
    tx = {
        "email": user["email"],
        "type": "SPEND",
        "description": f"Redeemed: {item['title']}",
        "amount": -cost,
        "timestamp": db.now_iso()
    }
    db.put("transactions", db.next_id(), tx)
    
    return {"status": "success", "new_balance": new_balance}

@app.get("/api/wallet")
def get_wallet_info(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet: return {"balance": 0}
    return wallet


def _extract_conversion_reply(message: str) -> Optional[str]:
    text = message.lower().replace(",", "").strip()
    points_rate = 1.0 / POINTS_PER_USD
    dollars_rate = POINTS_PER_USD

    point_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:points?|pts?)", text)
    dollar_match = re.search(r"(?:\$|usd|dollars?)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:usd|dollars?)", text)

    if point_match and ("to $" in text or "to dollars" in text or "to usd" in text or "points to" in text):
        pts = float(point_match.group(1))
        usd = pts * points_rate
        return f"{pts:g} points is approximately ${usd:,.2f} (using 1 point ≈ ${points_rate:.2f})."

    if dollar_match and ("to points" in text or "usd to points" in text or "dollars to points" in text):
        usd_raw = dollar_match.group(1) or dollar_match.group(2)
        usd = float(usd_raw)
        pts = usd * dollars_rate
        return f"${usd:,.2f} is approximately {pts:g} points (using $1.00 ≈ {dollars_rate:g} points)."

    return None


@app.post("/api/ai/chat")
async def ai_chat(req: AiChatRequest):
    message = (req.message or "").strip()
    if not message:
        raise HTTPException(400, "Message is required")

    quick_conversion = _extract_conversion_reply(message)
    if quick_conversion:
        return {"reply": quick_conversion, "source": "conversion"}

    if not GEMINI_API_KEY:
        return {"reply": "GEMINI_API_KEY is not configured.", "source": "config"}

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "You are GreenBot for a green rewards app. "
                            "Reply in 2-4 concise sentences with practical advice.\n\n"
                            f"User: {message}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 280},
    }

    preferred_models = [GEMINI_MODEL, "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"]
    tried = []

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            for model in preferred_models:
                if model in tried:
                    continue
                tried.append(model)
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                res = await client.post(url, json=payload)
                if res.status_code == 404:
                    continue
                res.raise_for_status()
                data = res.json()
                reply = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )
                if not reply:
                    reply = "I could not generate a response right now."
                return {"reply": reply, "source": "gemini", "model": model}
    except Exception as e:
        raise HTTPException(502, f"Gemini request failed: {str(e)}")

    raise HTTPException(502, f"No compatible Gemini model found from: {', '.join(tried)}")


@app.post("/api/ai/speech-to-text")
async def ai_speech_to_text(file: UploadFile = File(...)):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(400, "ELEVENLABS_API_KEY is not configured")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Audio file is empty")

    files = {
        "file": (
            file.filename or "speech.webm",
            audio_bytes,
            file.content_type or "audio/webm",
        )
    }
    data = {"model_id": ELEVENLABS_STT_MODEL}
    headers = {"xi-api-key": ELEVENLABS_API_KEY}

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers=headers,
                data=data,
                files=files,
            )
        if res.status_code >= 400:
            raise HTTPException(502, f"ElevenLabs STT failed: {res.status_code} {res.text[:240]}")
        payload = res.json()
        transcript = (payload.get("text") or payload.get("transcript") or "").strip()
        if not transcript:
            raise HTTPException(502, "ElevenLabs STT returned no transcript text")
        return {"text": transcript, "provider": "elevenlabs", "model": ELEVENLABS_STT_MODEL}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Speech-to-text failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5001, reload=True)
