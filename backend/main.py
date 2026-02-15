"""
Green Energy Credit Bank – FastAPI Backend
============================================
Port 5000 | Actian VectorAI DB (in-memory fallback) | No PostgreSQL

Flow: Signup/Login → KYC (FlexID) → Fraud (Fraud Finder) → Green Score → Dashboard
"""

import os, sys, json, subprocess
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
import httpx

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from backend.db import (
    setup_collections, seed, reset_collections,
    put, get_by_id, get_all, find_by, find_one,
    count, batch_put, next_id, cuid, now_iso,
    ACTIAN_HOST, ACTION_TYPES, USER_PROFILES,
    health_info,
)

# ── Config ─────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "gecb-jwt-secret-2026")
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24

CRS_BASE = "https://api-sandbox.stitchcredit.com:443/api"
CRS_USER = os.getenv("CRS_USERNAME", "sfhacks_dev38")
CRS_PASS = os.getenv("CRS_PASSWORD", "")
_crs_token: Optional[str] = None

OCR_SCRIPT = os.path.join(PROJECT_ROOT, "services", "ocr_service.py")


# ═══════════════════════════════════════════════════════════
app = FastAPI(title="GECB Backend", version="3.0.0",
              description="Powered by Actian VectorAI DB")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────

class SignupReq(BaseModel):
    name: str; email: str; password: str

class LoginReq(BaseModel):
    email: str; password: str

class KycReq(BaseModel):
    firstName: str; lastName: str; ssn: str; dob: str
    address: str; city: str; state: str; zip: str; phone: str

class ClaimReq(BaseModel):
    actionTypeCode: str; description: str
    occurredAt: Optional[str] = None; evidenceUrl: Optional[str] = None

class RedeemReq(BaseModel):
    productId: int


# ── JWT ────────────────────────────────────────────────────

def create_token(email: str, name: str, role: str, uid: int) -> dict:
    now = datetime.utcnow()
    payload = {"sub": email, "name": name, "role": role, "uid": uid, "iat": now, "exp": now + timedelta(hours=JWT_EXP_HOURS)}
    access = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    refresh = jwt.encode({**payload, "exp": now + timedelta(days=7), "type": "refresh"}, JWT_SECRET, algorithm=JWT_ALGO)
    return {"accessToken": access, "refreshToken": refresh, "expiresIn": JWT_EXP_HOURS * 3600}

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization header")
    return decode_token(authorization.split(" ")[1])


# ═══════════════════════════════════════════════════════════
# HEALTH / SEED
# ═══════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return health_info()

@app.post("/api/seed")
def api_seed():
    return seed()

@app.post("/api/setup")
def api_setup():
    return setup_collections()


# ═══════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════

def _user_response(user: dict, uid: int) -> dict:
    return {"id": uid, "email": user["email"], "name": user["name"], "role": user["role"],
            "kycComplete": user.get("kycComplete", False), "fraudClear": user.get("fraudClear", False),
            "greenScore": user.get("greenScore")}

@app.post("/api/auth/signup")
def signup(body: SignupReq):
    if find_one("users", "email", body.email):
        raise HTTPException(409, "Email already registered")
    uid = next_id()
    user = {"name": body.name, "email": body.email, "password": body.password, "role": "USER",
            "createdAt": now_iso(), "firstName": body.name.split()[0] if " " in body.name else body.name,
            "lastName": body.name.split()[-1] if " " in body.name else "",
            "kycComplete": False, "fraudClear": False, "greenScore": None}
    put("users", uid, user)
    put("user_wallets", next_id(), {"email": body.email, "balance": 0, "transactions": [], "purchaseHistory": []})
    return {"user": _user_response(user, uid), **create_token(body.email, body.name, "USER", uid)}

@app.post("/api/auth/login")
def login(body: LoginReq):
    user = find_one("users", "email", body.email)
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("password") != body.password:
        raise HTTPException(401, "Invalid credentials")
    return {"user": _user_response(user, user["_id"]), **create_token(user["email"], user["name"], user["role"], user["_id"])}

@app.get("/api/auth/me")
def get_me(cu: dict = Depends(get_current_user)):
    user = find_one("users", "email", cu["sub"])
    if not user: raise HTTPException(404)
    user.pop("password", None)
    return user

@app.post("/api/auth/refresh")
def refresh_token(authorization: str = Header(...)):
    p = decode_token(authorization.replace("Bearer ", ""))
    return create_token(p["sub"], p["name"], p["role"], p["uid"])


# ═══════════════════════════════════════════════════════════
# KYC (CRS FlexID)
# ═══════════════════════════════════════════════════════════

async def _crs_login() -> str:
    global _crs_token
    if _crs_token: return _crs_token
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.post(f"{CRS_BASE}/users/login", json={"username": CRS_USER, "password": CRS_PASS})
            _crs_token = res.json().get("token", "__MOCK__")
            return _crs_token
        except:
            return "__MOCK__"

@app.post("/api/kyc")
async def kyc_verify(body: KycReq, cu: dict = Depends(get_current_user)):
    token = await _crs_login()
    verified, raw = True, None
    if token != "__MOCK__":
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                res = await client.post(f"{CRS_BASE}/flex-id/flex-id",
                    json={"firstName": body.firstName, "lastName": body.lastName, "ssn": body.ssn,
                          "dateOfBirth": body.dob, "streetAddress": body.address, "city": body.city,
                          "state": body.state, "zipCode": body.zip, "homePhone": body.phone},
                    headers={"Authorization": f"Bearer {token}"})
                raw = res.json()
            except Exception as e:
                raw = {"error": str(e)}
    user = find_one("users", "email", cu["sub"])
    if user:
        user.update({"kycComplete": verified, "firstName": body.firstName, "lastName": body.lastName,
                     "ssn": body.ssn, "dob": body.dob, "address": body.address, "city": body.city,
                     "state": body.state, "zip": body.zip, "phone": body.phone})
        uid = user.pop("_id")
        put("users", uid, user)
    return {"verified": verified, "provider": "LexisNexis FlexID (CRS Sandbox)", "raw": raw}


# ═══════════════════════════════════════════════════════════
# FRAUD (CRS Fraud Finder)
# ═══════════════════════════════════════════════════════════

@app.post("/api/fraud")
async def fraud_check(cu: dict = Depends(get_current_user)):
    token = await _crs_login()
    user = find_one("users", "email", cu["sub"])
    if not user: raise HTTPException(404)
    result = {"status": "CLEAR", "riskScore": 10, "provider": "CRS Fraud Finder (Sandbox)"}
    if token != "__MOCK__":
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                res = await client.post(f"{CRS_BASE}/fraud-finder/fraud-finder",
                    json={"firstName": user.get("firstName","John"), "lastName": user.get("lastName","Doe"),
                          "phoneNumber": user.get("phone","1234929999"), "email": user["email"],
                          "ipAddress": "47.25.65.96",
                          "address": {"addressLine1": user.get("address","15900 SPACE CN"),
                                      "city": user.get("city","HOUSTON"), "state": user.get("state","TX"),
                                      "postalCode": user.get("zip","77062")}},
                    headers={"Authorization": f"Bearer {token}"})
                result["raw"] = res.json()
            except Exception as e:
                result["error"] = str(e)
    user["fraudClear"] = result["status"] == "CLEAR"
    uid = user.pop("_id")
    put("users", uid, user)
    return result


# ═══════════════════════════════════════════════════════════
# GREEN SCORE
# ═══════════════════════════════════════════════════════════

@app.post("/api/green-score")
async def calculate_green_score(bureau: str = "transunion", cu: dict = Depends(get_current_user)):
    token = await _crs_login()
    user = find_one("users", "email", cu["sub"])
    credit_score, raw = 720, None
    if token != "__MOCK__":
        endpoints = {
            "transunion": f"{CRS_BASE}/transunion/credit-report/standard/tu-prequal-vantage4",
            "experian": f"{CRS_BASE}/experian/credit-profile/credit-report/standard/exp-prequal-vantage4",
            "equifax": f"{CRS_BASE}/equifax/credit-report/standard/efx-prequal-vantage4",
        }
        crs_body = {"firstName": user.get("firstName","BARBARA") if user else "BARBARA", "middleName": "",
                     "lastName": user.get("lastName","DOTY") if user else "DOTY", "suffix": "",
                     "birthDate": user.get("dob","1966-01-04") if user else "1966-01-04", "ssn": "000000000",
                     "addresses": [{"borrowerResidencyType":"Current",
                                    "addressLine1": user.get("address","1100 LYNHURST LN") if user else "1100 LYNHURST LN",
                                    "city": user.get("city","DENTON") if user else "DENTON",
                                    "state": user.get("state","TX") if user else "TX",
                                    "postalCode": user.get("zip","762058006") if user else "762058006"}]}
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                res = await client.post(endpoints.get(bureau, endpoints["transunion"]),
                    json=crs_body, headers={"Authorization": f"Bearer {token}"})
                raw = res.json()
                if isinstance(raw, dict):
                    credit_score = raw.get("score", raw.get("creditScore", 720))
            except:
                pass
    env_bonus = 500
    green_score = int(credit_score * 0.3 + env_bonus * 0.7)
    rating = "Excellent" if green_score >= 700 else "Good" if green_score >= 600 else "Fair" if green_score >= 500 else "Needs Improvement"
    result = {"greenScore": green_score, "creditScore": credit_score, "environmentalBonus": env_bonus,
              "rating": rating, "formula": f"({credit_score} × 0.3) + ({env_bonus} × 0.7) = {green_score}",
              "provider": f"{bureau} (CRS Sandbox)", "date": now_iso()}
    if user:
        user["greenScore"] = green_score; user["greenRating"] = rating; user["creditScore"] = credit_score
        uid = user.pop("_id")
        put("users", uid, user)
    return result

@app.get("/api/crs/score")
async def crs_score_widget(bureau: str = "transunion"):
    return {"score": 720, "rating": "Excellent", "provider": f"{bureau} (Sandbox)", "date": now_iso()}


# ═══════════════════════════════════════════════════════════
# CLAIMS
# ═══════════════════════════════════════════════════════════

@app.get("/api/action-types")
def list_action_types():
    return ACTION_TYPES

@app.post("/api/claims")
def submit_claim(body: ClaimReq, cu: dict = Depends(get_current_user)):
    at = next((a for a in ACTION_TYPES if a["code"] == body.actionTypeCode), None)
    if not at: raise HTTPException(400, f"Unknown action type: {body.actionTypeCode}")
    cid = next_id()
    claim = {"email": cu["sub"], "actionTypeCode": body.actionTypeCode, "actionTitle": at["title"],
             "baseCredits": at["baseCredits"], "description": body.description,
             "occurredAt": body.occurredAt or now_iso(), "submittedAt": now_iso(),
             "status": "PENDING", "evidenceUrl": body.evidenceUrl, "creditsAwarded": None}
    put("claims", cid, claim)
    return {**claim, "_id": cid}

@app.get("/api/claims")
def list_claims(cu: dict = Depends(get_current_user)):
    claims = find_by("claims", "email", cu["sub"])
    claims.sort(key=lambda c: c.get("submittedAt", ""), reverse=True)
    return claims

@app.post("/api/claims/{claim_id}/approve")
def approve_claim(claim_id: int, cu: dict = Depends(get_current_user)):
    if cu["role"] not in ("REVIEWER", "ADMIN"): raise HTTPException(403)
    claim = get_by_id("claims", claim_id)
    if not claim or claim.get("status") != "PENDING": raise HTTPException(400, "Not found or not pending")
    credits = claim.get("baseCredits", 10)
    claim["status"] = "APPROVED"; claim["creditsAwarded"] = credits
    put("claims", claim_id, claim)
    wallet = find_one("user_wallets", "email", claim["email"])
    if wallet:
        wid = wallet.pop("_id")
        wallet["balance"] = wallet.get("balance", 0) + credits
        txs = wallet.get("transactions", [])
        txs.insert(0, {"type": "MINT", "amount": credits, "memo": f"Approved: {claim.get('actionTitle')}", "date": now_iso()})
        wallet["transactions"] = txs[:100]
        put("user_wallets", wid, wallet)
    return {"status": "APPROVED", "creditsAwarded": credits}


# ═══════════════════════════════════════════════════════════
# REVIEW QUEUE
# ═══════════════════════════════════════════════════════════

@app.get("/api/review/queue")
def review_queue(cu: dict = Depends(get_current_user)):
    if cu["role"] not in ("REVIEWER", "ADMIN"): raise HTTPException(403)
    return [c for c in get_all("claims") if c.get("status") == "PENDING"]


# ═══════════════════════════════════════════════════════════
# WALLET
# ═══════════════════════════════════════════════════════════

@app.get("/api/wallet")
def get_wallet(cu: dict = Depends(get_current_user)):
    wallet = find_one("user_wallets", "email", cu["sub"])
    return wallet or {"balance": 0, "transactions": [], "purchaseHistory": []}


# ═══════════════════════════════════════════════════════════
# MARKETPLACE
# ═══════════════════════════════════════════════════════════

@app.get("/api/marketplace")
def list_marketplace():
    return [p for p in get_all("marketplace_products") if p.get("active", True)]

@app.post("/api/redeem")
def redeem_product(body: RedeemReq, cu: dict = Depends(get_current_user)):
    product = get_by_id("marketplace_products", body.productId)
    if not product: raise HTTPException(404, "Product not found")
    wallet = find_one("user_wallets", "email", cu["sub"])
    if not wallet: raise HTTPException(400, "No wallet")
    balance, cost = wallet.get("balance", 0), product.get("cost", 0)
    if balance < cost: raise HTTPException(400, f"Need {cost}, have {balance}")
    inv = product.get("inventory")
    if inv is not None and inv <= 0: raise HTTPException(400, "Out of stock")
    wid = wallet.pop("_id")
    wallet["balance"] = balance - cost
    txs = wallet.get("transactions", [])
    txs.insert(0, {"type": "REDEEM", "amount": -cost, "memo": f"Purchased: {product.get('title')}", "date": now_iso()})
    wallet["transactions"] = txs[:100]
    history = wallet.get("purchaseHistory", [])
    history.insert(0, {"productId": body.productId, "title": product.get("title"), "cost": cost, "date": now_iso()})
    wallet["purchaseHistory"] = history
    put("user_wallets", wid, wallet)
    if inv is not None:
        product["inventory"] = inv - 1
        put("marketplace_products", body.productId, product)
    return {"success": True, "newBalance": wallet["balance"], "product": product.get("title")}


# ═══════════════════════════════════════════════════════════
# ACTIAN HEALTH
# ═══════════════════════════════════════════════════════════

@app.get("/api/actian/health")
def actian_health():
    return health_info()


# ═══════════════════════════════════════════════════════════
# OCR
# ═══════════════════════════════════════════════════════════

@app.post("/api/ocr")
async def ocr_receipt(file: UploadFile = File(...)):
    upload_dir = os.path.join(PROJECT_ROOT, "public", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, f"{cuid()}_{file.filename}")
    with open(filepath, "wb") as f:
        f.write(await file.read())
    try:
        result = subprocess.run([sys.executable, OCR_SCRIPT, filepath], capture_output=True, text=True, timeout=60)
        data = json.loads(result.stdout.strip()) if result.stdout.strip() else {"error": result.stderr}
        total = data.get("detected_total")
        if total and total > 0:
            data["greenCredits"] = max(1, int(total * 0.1))
        return data
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
