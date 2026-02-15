from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Response
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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_STT_MODEL = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")
POINTS_PER_USD = float(os.getenv("POINTS_PER_USD", "0.5"))
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

class CheckoutItem(BaseModel):
    id: int
    quantity: int = 1

class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None

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
    print(f"[debug] Signup request: {req.email}, name={req.name}")
    try:
        if db.find_one("fraud_users", "email", req.email):
            print("[debug] Email flagged for fraud")
            raise HTTPException(status_code=403, detail="Registration denied: Email flagged for fraud.")
        
        # Check if exists in verified
        if db.find_one("verified_users", "email", req.email):
            print("[debug] Email already exists")
            raise HTTPException(status_code=409, detail="Email already exists")
    except Exception as e:
        print(f"[debug] Error in signup checks: {e}")
        raise
    
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
    
    # Record initial transaction (Welcome Bonus)
    db.put("transactions", db.next_id(), {
        "email": req.email,
        "type": "BONUS",
        "description": "Account Created (Welcome Bonus)",
        "amount": 100.0,
        "timestamp": db.now_iso()
    })
    
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

@app.get("/api/profile/statement")
def download_statement(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    from backend.statement import generate_statement_pdf
    
    # Get wallet
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet: wallet = {"balance": 0}
    
    # Get all transactions using the optimized lookup (same as UI)
    txs = db.get_transactions_by_email(user["email"])
    print(f"[debug] Download Statement: Found {len(txs)} transactions for {user['email']}")
    
    # Synthesize "Account Created" event if not present
    has_bonus = any(t.get("type") == "BONUS" for t in txs)
    if not has_bonus:
        created_at = user.get("createdAt", db.now_iso())
        txs.append({
            "timestamp": created_at,
            "description": "Account Created (Welcome Bonus)",
            "type": "BONUS",
            "amount": 100.0,
            "_id": "init"
        })
    
    # Sort chronological (Oldest first -> Newest last)
    txs.sort(key=lambda x: x.get("timestamp", ""))
    
    pdf_bytes = generate_statement_pdf(user, wallet, txs)
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Greenify_Statement.pdf"}
    )

@app.get("/api/marketplace/invoice/{order_id}")
def download_invoice(order_id: str, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    from backend.statement import generate_invoice_pdf
    
    # Get transaction by order_id using cache for immediate consistency
    user_txs = db.get_transactions_by_email(user["email"])
    txs = [t for t in user_txs if t.get("order_id") == order_id]
    
    if not txs: raise HTTPException(404, "Order not found")
    tx = txs[0]
    
    # Verify ownership
    if tx["email"] != user["email"]:
        raise HTTPException(403, "Forbidden")
        
    pdf_bytes = generate_invoice_pdf(user, tx)
    
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Greenify_Invoice_{order_id.split('-')[-1]}.pdf"}
    )

@app.post("/api/kyc")
def submit_kyc(req: KYCRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    # Simulate CRS KYC check
    # In real world: call CRS API
    
    updated_user = {**user, **req.dict(), "kycComplete": True}
    db.put("verified_users", user["_id"], updated_user)
    
    return {"status": "success", "flow": "fraud"}

@app.post("/api/fraud")
def check_fraud(req: FraudCheckRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    # Simulate Fraud check
    # If IP starts with "666", flag as fraud
    if req.ip.startswith("666"):
        # Move to fraud_users
        db.delete_record("verified_users", user["_id"])
        db.put("fraud_users", user["_id"], {**user, "fraudClear": False, "fraudReason": "Suspicious IP"})
        raise HTTPException(403, "Fraud detected. Account locked.")
    
    updated_user = {**user, "fraudClear": True, "fraudScore": 10} # Low risk
    db.put("verified_users", user["_id"], updated_user)
    
    return {"status": "safe", "flow": "green-score"}

# ── Internal score recalculation ───────────────────────────
def _recalculate_green_score(user: dict) -> int:
    """Dynamic green score: 600 base + activity bonuses (0-1000 scale)"""
    score = 600  # Base for all users
    if user.get("kycComplete"): score += 50
    if user.get("fraudClear"): score += 50

    email = user["email"]
    # +5 per green action claim, capped at +150
    claims = db.find_by("claims", "email", email, limit=200)
    claim_bonus = min(len(claims) * 5, 150)
    score += claim_bonus

    # +3 per marketplace checkout transaction, capped at +100
    txs = db.find_by("transactions", "email", email, limit=200)
    spend_txs = [t for t in txs if t.get("type") == "SPEND"]
    spend_bonus = min(len(spend_txs) * 3, 100)
    score += spend_bonus

    score = min(score, 1000)  # Hard cap

    # Persist to user profile
    updated_user = {**user, "greenScore": score}
    db.put("verified_users", user["_id"], updated_user)

    # Save to history
    db.put("green_scores", db.next_id(), {
        "email": email, "score": score, "timestamp": db.now_iso()
    })
    return score

@app.post("/api/green-score")
def calc_green_score(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    score = _recalculate_green_score(user)
    return {"score": score, "flow": "dashboard"}

@app.get("/api/green-score/current")
def get_green_score(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    # Recalculate on read to ensure it's always fresh
    score = _recalculate_green_score(user)
    return {"score": score}

# ── Image Analysis Helpers ─────────────────────────────────
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
                if value > 0: line_amounts.append(value)
            except Exception: continue
        amounts.extend(line_amounts)
        if line_amounts and any(word in lower for word in priority_words):
            prioritized.extend(line_amounts)
    if detected_total and detected_total > 0:
        amounts.append(float(detected_total))
        prioritized.append(float(detected_total))
    if prioritized: return round(max(prioritized), 2)
    if amounts: return round(max(amounts), 2)
    for line in lines:
        for raw in re.findall(r"\$\s*([0-9]+)", line):
            try:
                value = float(raw)
                if value > 0: amounts.append(value)
            except Exception: continue
    if amounts: return round(max(amounts), 2)
    if detected_total and detected_total > 0: return round(float(detected_total), 2)
    return 0.0

def _extract_receipt_number(lines: List[str]) -> str:
    keyword = re.compile(
        r"(?:receipt|invoice|order|txn|transaction|reference|ref|id|number|no\.?)\s*[:#-]?\s*([A-Z0-9-]{4,})",
        re.IGNORECASE,
    )
    for line in lines:
        match = keyword.search(line)
        if match: return match.group(1).upper()
    generic = re.compile(r"\b[A-Z0-9-]{6,}\b")
    for idx, line in enumerate(lines):
        if re.search(r"(receipt|invoice|order|txn|transaction|reference|ref|id|number|no\.?)", line, re.IGNORECASE):
            if idx + 1 < len(lines):
                match = generic.search(lines[idx + 1].upper())
                if match: return match.group(0)
    for line in lines:
        match = generic.search(line.upper())
        if match: return match.group(0)
    from datetime import datetime as _dt
    return f"OCR-{_dt.utcnow().strftime('%Y%m%d%H%M%S')}"

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
        if not match: continue
        raw = match.group(1)
        for fmt in formats:
            try:
                from datetime import datetime as _dt
                return _dt.strptime(raw, fmt).strftime("%Y-%m-%d")
            except Exception: continue
    from datetime import datetime as _dt
    return _dt.utcnow().strftime("%Y-%m-%d")

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

# ── Claims ─────────────────────────────────────────────

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
        description = " ".join(lines[:5]).strip() or "Uploaded receipt"
        if len(description) > 180:
            description = description[:180]
        points = round(amount * POINTS_PER_USD, 2)

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

    # Recalculate green score after earning
    _recalculate_green_score(user)
    
    return {"status": "approved", "points": points, "balance": new_balance}



# ── Marketplace ────────────────────────────────────────────

@app.get("/api/marketplace")
def get_marketplace(type: Optional[str] = None):
    items = db.get_all("marketplace")
    if not items:
        try:
            db.seed()
            items = db.get_all("marketplace")
        except Exception:
            items = []
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

@app.post("/api/checkout")
def checkout(req: CheckoutRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    if not req.items: raise HTTPException(400, "Cart is empty")

    # Resolve items and compute total
    order_items = []
    total_cost = 0
    for ci in req.items:
        item = db.get_by_id("marketplace", ci.id)
        if not item:
            raise HTTPException(404, f"Item {ci.id} not found")
        cost = item.get("cost", 0) * ci.quantity
        total_cost += cost
        order_items.append({
            "title": item.get("title", "Unknown"),
            "quantity": ci.quantity,
            "cost": item.get("cost", 0),
        })

    # Check balance
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet or wallet.get("balance", 0) < total_cost:
        raise HTTPException(400, "Insufficient balance")

    # Deduct
    new_balance = wallet["balance"] - total_cost
    db.put("user_wallets", wallet["_id"], {**wallet, "balance": new_balance})

    # Create order transaction
    order_id = db.cuid()
    ts = db.now_iso()
    item_names = ", ".join(f"{oi['title']} x{oi['quantity']}" for oi in order_items)
    tx = {
        "email": user["email"],
        "type": "SPEND",
        "description": f"Order: {item_names}",
        "amount": -total_cost,
        "timestamp": ts,
        "order_id": order_id,
        "items": order_items,
    }
    db.put("transactions", db.next_id(), tx)

    # Recalculate green score after spending
    _recalculate_green_score(user)

    return {
        "order_id": order_id,
        "items_purchased": sum(ci.quantity for ci in req.items),
        "total_cost": total_cost,
        "new_balance": new_balance,
        "timestamp": ts,
    }

@app.get("/api/transactions")
def get_transactions(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    user_tx = db.get_transactions_by_email(user["email"])
    
    # Synthesize Welcome Bonus if missing (for older accounts)
    has_bonus = any(t.get("type") == "BONUS" for t in user_tx)
    if not has_bonus:
        created_at = user.get("createdAt", db.now_iso())
        user_tx.append({
            "timestamp": created_at,
            "description": "Account Created (Welcome Bonus)",
            "type": "BONUS",
            "amount": 100.0,
            "_id": "init-bonus"
        })

    user_tx.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return user_tx

@app.get("/api/wallet")
def get_wallet_info(authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    wallet = db.find_one("user_wallets", "email", user["email"])
    if not wallet: return {"balance": 0}
    return wallet

@app.put("/api/profile")
def update_profile(req: ProfileUpdateRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates: raise HTTPException(400, "No fields to update")
    updated_user = {**user, **updates}
    db.put("verified_users", user["_id"], updated_user)
    return {"status": "updated", "user": updated_user}


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
        return {
            "reply": f"Gemini is temporarily unavailable. {str(e)}",
            "source": "gemini-error",
        }

    return {
        "reply": f"No compatible Gemini model found. Tried: {', '.join(tried)}",
        "source": "gemini-error",
    }


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
    uvicorn.run("main:app", host="127.0.0.1", port=5002, reload=True)
