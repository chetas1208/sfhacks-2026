"""
Actian VectorAI DB Data Layer – GECB
=====================================
Strict Actian VectorAI usage for real-time data.
Collections: verified_users, fraud_users, transactions, claims, marketplace
"""

import os, copy, uuid, time, json
from typing import Optional, List
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

ACTIAN_HOST = os.getenv("ACTIAN_HOST", "localhost:50051")
DIM = 4

# ── Helpers ────────────────────────────────────────────────

_counter = int(time.time() * 1000) % 1_000_000_000

def next_id() -> int:
    global _counter
    _counter += 1
    return _counter

def cuid() -> str:
    return uuid.uuid4().hex[:25]

def dummy_vec() -> list:
    return [0.0] * DIM

def now_iso() -> str:
    return datetime.utcnow().isoformat()

# ── Actian connectivity ───────────────────────────────────

_USE_ACTIAN = False

def _try_actian():
    global _USE_ACTIAN
    try:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            c.health_check()
        _USE_ACTIAN = True
        print("[db] ✅ Actian VectorAI DB connected")
    except Exception as e:
        _USE_ACTIAN = False
        print(f"[db] ⚠️  Actian unavailable, accessing in-memory fallback (NOT REAL-TIME)")

_try_actian()

# ── In-memory store (Fallback only) ───────────────────────

_mem: dict[str, dict[int, dict]] = {}

# ── Write-Through Cache for Consistency (Email -> ID) ──────
# Solves Actian scroll eventual consistency
_email_id_cache: dict[str, int] = {}
_receipt_id_cache: dict[str, int] = {}

def _mem_ensure(col: str):
    if col not in _mem:
        _mem[col] = {}

COLLECTIONS = ["verified_users", "fraud_users", "transactions", "claims", "marketplace", "green_scores"]

# ── Collection management ─────────────────────────────────

def setup_collections():
    if _USE_ACTIAN:
        from cortex import CortexClient, DistanceMetric
        with CortexClient(ACTIAN_HOST) as c:
            for name in COLLECTIONS:
                if not c.has_collection(name):
                    c.create_collection(name, DIM, distance_metric=DistanceMetric.EUCLIDEAN)
    else:
        for name in COLLECTIONS:
            _mem_ensure(name)
    return {"status": "ok", "collections": COLLECTIONS}

def reset_collections():
    if _USE_ACTIAN:
        from cortex import CortexClient, DistanceMetric
        with CortexClient(ACTIAN_HOST) as c:
            for name in COLLECTIONS:
                if c.has_collection(name):
                    c.delete_collection(name)
                c.create_collection(name, DIM, distance_metric=DistanceMetric.EUCLIDEAN)
    else:
        for name in COLLECTIONS:
            _mem[name] = {}
    return {"status": "reset", "collections": COLLECTIONS}

# ── CRUD ──────────────────────────────────────────────────

def put(collection: str, record_id: int, payload: dict):
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            print(f"[db] Putting {record_id} into {collection}: {payload}")
            try:
                c.upsert(collection, id=record_id, vector=dummy_vec(), payload=payload)
                c.flush(collection)
                print(f"[db] Success put {record_id}")
                
                # Verify immediately
                check = c.get(collection, record_id)
                print(f"[db] Immediate check for {record_id}: {check}")

                # Update cache if applicable
                if collection in ["verified_users", "fraud_users", "user_wallets"] and payload.get("email"):
                    _email_id_cache[payload["email"]] = record_id
                
                if collection == "claims" and payload.get("receiptNumber"):
                    _receipt_id_cache[payload["receiptNumber"]] = record_id
            except Exception as e:
                print(f"[db] ERROR put: {e}")
                raise e
    else:
        _mem_ensure(collection)
        _mem[collection][record_id] = copy.deepcopy(payload)

def get_by_id(collection: str, record_id: int) -> Optional[dict]:
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            try:
                result = c.get(collection, record_id)
                if result and isinstance(result, tuple) and len(result) == 2:
                    return {**result[1], "_id": record_id}
            except Exception:
                pass
        return None
    else:
        _mem_ensure(collection)
        data = _mem[collection].get(record_id)
        return {**copy.deepcopy(data), "_id": record_id} if data else None

def get_all(collection: str, limit: int = 1000) -> List[dict]:
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            try:
                result = c.scroll(collection, limit=limit)
                records = result[0] if isinstance(result, tuple) else result
                return [{"_id": r.id if hasattr(r,'id') else 0, **(r.payload if hasattr(r,'payload') else {})} for r in records]
            except Exception:
                return []
    else:
        _mem_ensure(collection)
        return [{"_id": rid, **copy.deepcopy(data)} for rid, data in list(_mem[collection].items())[:limit]]

def find_by(collection: str, field: str, value, limit: int = 100) -> List[dict]:
    # In a real vector DB we'd filter, but Cortex might not support strict field filtering in scroll yet
    # so we fetch and filter in app for this hackathon scale
    all_items = get_all(collection, limit=1000)
    return [r for r in all_items if r.get(field) == value][:limit]

def find_one(collection: str, field: str, value) -> Optional[dict]:
    # Check cache first for email lookup
    if field == "email" and collection in ["verified_users", "fraud_users", "user_wallets"]:
        cached_id = _email_id_cache.get(value)
        if cached_id:
            print(f"[db] Cache HIT for {value} -> {cached_id}")
            # Verify it exists in DB (should be immediate via ID)
            record = get_by_id(collection, cached_id)
            if record: return record

    # Check cache for receipt number
    if field == "receiptNumber" and collection == "claims":
        cached_id = _receipt_id_cache.get(value)
        if cached_id:
            print(f"[db] Cache HIT for receipt {value} -> {cached_id}")
            record = get_by_id(collection, cached_id)
            if record: return record

    results = find_by(collection, field, value, limit=1)
    return results[0] if results else None

def delete_record(collection: str, record_id: int):
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            try:
                c.delete(collection, record_id)
                c.flush(collection)
            except: pass
    else:
        _mem_ensure(collection)
        if record_id in _mem[collection]:
            del _mem[collection][record_id]

def batch_put(collection: str, start_id: int, payloads: List[dict]):
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            ids = list(range(start_id, start_id + len(payloads)))
            vectors = [dummy_vec() for _ in payloads]
            c.batch_upsert(collection, ids=ids, vectors=vectors, payloads=payloads)
            c.flush(collection)
    else:
        _mem_ensure(collection)
        for i, payload in enumerate(payloads):
            _mem[collection][start_id + i] = copy.deepcopy(payload)

def health_info() -> dict:
    if _USE_ACTIAN:
        from cortex import CortexClient
        try:
            with CortexClient(ACTIAN_HOST) as c:
                ver, up = c.health_check()
            return {"status": "ok", "db": "Actian VectorAI", "version": ver, "uptime": str(up)}
        except Exception as e:
            return {"status": "error", "error": str(e)}
    else:
        total = sum(len(v) for v in _mem.values())
        return {"status": "ok", "db": "In-Memory (Actian offline)", "records": total}


# ═══════════════════════════════════════════════════════════
# INITIAL SEED DATA (Only used on RESET/INIT)
# ═══════════════════════════════════════════════════════════

MARKETPLACE_INITIAL = [
    {"title":"Campus Café $5 Gift Card","description":"Enjoy a free coffee or snack","cost":50,"type":"offer","category":"food","active":True,"inventory":100},
    {"title":"Library Print Credits (100)","description":"100 free pages","cost":30,"type":"offer","category":"academic","active":True,"inventory":200},
    {"title":"Portable Solar Charger","description":"Eco-friendly charger","cost":500,"type":"product","category":"tech","active":True,"inventory":10},
    {"title":"Bamboo Water Bottle","description":"Sustainable bottle","cost":80,"type":"product","category":"lifestyle","active":True,"inventory":50},
    {"title":"Public Transit Pass (1 Wk)","description":"Unlimited rides","cost":200,"type":"offer","category":"transport","active":True,"inventory":40},
    {"title":"Farmers Market Voucher ($10)","description":"Support local","cost":100,"type":"offer","category":"food","active":True,"inventory":60},
]

def seed():
    reset_collections()
    # Create one admin user in verified_users
    admin = {
        "name":"Charlie Admin", "email":"admin@greenbank.io", "password":"Admin123!", "role":"ADMIN",
        "firstName":"Charlie", "lastName":"Admin", "kycComplete":True, "fraudClear":True,
        "greenScore":800, "balance": 1000, "createdAt": now_iso()
    }
    put("verified_users", next_id(), admin)

    # Seed marketplace
    mp_payloads = []
    for m in MARKETPLACE_INITIAL:
        mp_payloads.append({**m, "cuid": cuid()})
    batch_put("marketplace", 1, mp_payloads)

    return {"status": "seeded", "verified_users": 1, "marketplace": len(MARKETPLACE_INITIAL)}
