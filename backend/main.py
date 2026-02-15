from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import os
import jwt
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from backend import db

load_dotenv()

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

@app.post("/api/claims")
def submit_claim(req: ClaimRequest, authorization: str = Header(None)):
    user = get_user_from_header(authorization)
    if not user: raise HTTPException(401, "Unauthorized")
    
    
    # Check for duplicate receipt
    if db.find_one("claims", "receiptNumber", req.receiptNumber):
        raise HTTPException(status_code=400, detail="Duplicate receipt number. Claim rejected.")

    # Credits logic: 1 credit per $1 spent
    points = req.amount
    
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5001, reload=True)
