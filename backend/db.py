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
POINTS_PER_USD = float(os.getenv("POINTS_PER_USD", "0.5"))

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

# ── Caching (Write-through) ──────────────────────────────
CACHE_FILE = os.path.join(os.path.dirname(__file__), 'db_cache.json')

_email_id_cache: dict[str, int] = {}
_receipt_id_cache: dict[str, int] = {}
_tx_email_cache: dict[str, list[int]] = {} # email -> list of tx_ids

def _load_cache():
    global _email_id_cache, _receipt_id_cache, _tx_email_cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                data = json.load(f)
                _email_id_cache = data.get("email_id", {})
                _receipt_id_cache = data.get("receipt_id", {})
                _tx_email_cache = data.get("tx_email", {})
            print(f"[db] Loaded cache: {len(_email_id_cache)} users, {len(_receipt_id_cache)} receipts")
        except Exception as e:
            print(f"[db] Failed to load cache: {e}")

def _save_cache():
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump({
                "email_id": _email_id_cache,
                "receipt_id": _receipt_id_cache,
                "tx_email": _tx_email_cache
            }, f)
    except Exception as e:
        print(f"[db] Failed to save cache: {e}")

# Load immediately
_load_cache()

# ── In-memory store (Fallback only) ───────────────────────

_mem: dict[str, dict[int, dict]] = {}

def _mem_ensure(col: str):
    if col not in _mem:
        _mem[col] = {}

COLLECTIONS = ["verified_users", "fraud_users", "transactions", "claims", "marketplace", "green_scores", "user_wallets"]

def _switch_to_memory_fallback(reason: str):
    global _USE_ACTIAN
    if _USE_ACTIAN:
        print(f"[db] ⚠️  Switching to in-memory fallback: {reason}")
    _USE_ACTIAN = False
    for name in COLLECTIONS:
        _mem_ensure(name)

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
        try:
            with CortexClient(ACTIAN_HOST) as c:
                print(f"[db] Putting {record_id} into {collection}: {payload}")
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

                # Cache transaction IDs per email
                if collection == "transactions" and payload.get("email"):
                    email = payload["email"]
                    if email not in _tx_email_cache:
                        _tx_email_cache[email] = []
                    _tx_email_cache[email].append(record_id)
                
                _save_cache()
                return
        except Exception as e:
            print(f"[db] ERROR put: {e}")
            _switch_to_memory_fallback(f"Actian write failed on {collection}: {e}")
            # continue to in-memory write below
    else:
        _mem_ensure(collection)
    _mem[collection][record_id] = copy.deepcopy(payload)
    if collection in ["verified_users", "fraud_users", "user_wallets"] and payload.get("email"):
        _email_id_cache[payload["email"]] = record_id
    if collection == "claims" and payload.get("receiptNumber"):
        _receipt_id_cache[payload["receiptNumber"]] = record_id
    if collection == "transactions" and payload.get("email"):
        email = payload["email"]
        if email not in _tx_email_cache:
            _tx_email_cache[email] = []
        if record_id not in _tx_email_cache[email]:
            _tx_email_cache[email].append(record_id)
    _save_cache()

def get_by_id(collection: str, record_id: int) -> Optional[dict]:
    if _USE_ACTIAN:
        from cortex import CortexClient
        try:
            with CortexClient(ACTIAN_HOST) as c:
                result = c.get(collection, record_id)
                if result and isinstance(result, tuple) and len(result) == 2:
                    return {**result[1], "_id": record_id}
        except Exception as e:
            _switch_to_memory_fallback(f"Actian read failed on {collection}: {e}")
    else:
        _mem_ensure(collection)
    _mem_ensure(collection)
    data = _mem[collection].get(record_id)
    return {**copy.deepcopy(data), "_id": record_id} if data else None

def get_all(collection: str, limit: int = 1000) -> List[dict]:
    if _USE_ACTIAN:
        from cortex import CortexClient
        try:
            with CortexClient(ACTIAN_HOST) as c:
                result = c.scroll(collection, limit=limit)
                records = result[0] if isinstance(result, tuple) else result
                return [{"_id": r.id if hasattr(r,'id') else 0, **(r.payload if hasattr(r,'payload') else {})} for r in records]
        except Exception as e:
            _switch_to_memory_fallback(f"Actian list failed on {collection}: {e}")
    else:
        _mem_ensure(collection)
    _mem_ensure(collection)
    return [{"_id": rid, **copy.deepcopy(data)} for rid, data in list(_mem[collection].items())[:limit]]

def get_transactions_by_email(email: str) -> List[dict]:
    """Retrieve transactions for a specific email using the write-through cache."""
    tx_ids = _tx_email_cache.get(email, [])
    results = []
    for tid in tx_ids:
        tx = get_by_id("transactions", tid)
        if tx:
            results.append(tx)
    return results

def find_by(collection: str, field: str, value, limit: int = 100) -> List[dict]:
    # In a real vector DB we'd filter, but Cortex might not support strict field filtering in scroll yet
    # so we fetch and filter in app for this hackathon scale
    all_items = get_all(collection, limit=10000)
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
    for i, payload in enumerate(payloads):
        put(collection, start_id + i, payload)

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
# SEED DATA (Only used on RESET/INIT)
# ═══════════════════════════════════════════════════════════

MARKETPLACE_SOURCE = {
    "offers": [
        {"product_name": "Sonic The Hedgehog 3", "brand": "SEGA", "price": "$59.99", "image_url": "https://m.media-amazon.com/images/I/51rnJbc9CrL.jpg"},
        {"product_name": "Onyx Storm (The Empyrean Book 3)", "brand": "Entangled", "price": "$19.99", "image_url": "https://m.media-amazon.com/images/I/51erLQfWU8L.jpg"},
        {"product_name": "Amazon Fire TV Stick 4K", "brand": "Amazon", "price": "$49.99", "image_url": "https://m.media-amazon.com/images/I/51glskD21nL.jpg"},
        {"product_name": "Samsung 50\" Crystal UHD TV", "brand": "Samsung", "price": "$379.99", "image_url": "https://m.media-amazon.com/images/I/51R4iScDJqL.jpg"},
        {"product_name": "Dyson V8 Vacuum", "brand": "Dyson", "price": "$349.00", "image_url": "https://m.media-amazon.com/images/I/31Mll1htAXL.jpg"},
        {"product_name": "Echo Buds Replacement Covers", "brand": "Amazon", "price": "$9.99", "image_url": "https://m.media-amazon.com/images/I/61KOZAbCkML.jpg"},
        {"product_name": "Owala FreeSip Water Bottle", "brand": "Owala", "price": "$27.99", "image_url": "https://m.media-amazon.com/images/I/31jQEUMGhCL.jpg"},
        {"product_name": "Stanley Beer Pint Glass", "brand": "Stanley", "price": "$20.00", "image_url": "https://m.media-amazon.com/images/I/41Tq9lOLJeL.jpg"},
        {"product_name": "Fender Bass Guitar Package", "brand": "Fender", "price": "$229.99", "image_url": "https://m.media-amazon.com/images/I/41PlIjT0qcL.jpg"},
        {"product_name": "Donald Trump Coin", "brand": "Collectible", "price": "$12.99", "image_url": "https://m.media-amazon.com/images/I/818iy-vmELL.jpg"},
        {"product_name": "Saker Mini Chainsaw", "brand": "Saker", "price": "$45.99", "image_url": "https://m.media-amazon.com/images/I/51Xcfs+w8TL.jpg"},
        {"product_name": "Smart Mobile Homes", "brand": "Generic", "price": "$15000.00", "image_url": "https://m.media-amazon.com/images/I/513VJC9cpBL.jpg"},
        {"product_name": "Asmuse Banjo 5 String", "brand": "Asmuse", "price": "$159.00", "image_url": "https://m.media-amazon.com/images/I/51GI0vXQbxL.jpg"},
        {"product_name": "CreoleFeast Propane Fryer", "brand": "CreoleFeast", "price": "$129.99", "image_url": "https://m.media-amazon.com/images/I/51z+QvLeMhL.jpg"},
        {"product_name": "Spirited Away Steelbook", "brand": "Studio Ghibli", "price": "$24.99", "image_url": "https://m.media-amazon.com/images/I/41rgFiYz6bL.jpg"},
        {"product_name": "The Hunger Games DVD", "brand": "Lionsgate", "price": "$9.99", "image_url": "https://m.media-amazon.com/images/I/51awED+QlZL.jpg"},
        {"product_name": "USAOPOLY TAPPLE Word Game", "brand": "USAOPOLY", "price": "$19.99", "image_url": "https://m.media-amazon.com/images/I/41dKkKzhf9L.jpg"},
        {"product_name": "Harry Potter Sorcerer's Stone", "brand": "Scholastic", "price": "$12.50", "image_url": "https://m.media-amazon.com/images/I/51Ppi-8kISL.jpg"},
        {"product_name": "Instant Print Camera for Kids", "brand": "Generic", "price": "$39.99", "image_url": "https://m.media-amazon.com/images/I/51cn+wauaOL.jpg"},
        {"product_name": "Behave (Robert Sapolsky)", "brand": "Penguin", "price": "$18.00", "image_url": "https://m.media-amazon.com/images/I/41m+taHRzuL.jpg"},
        {"product_name": "Ha-Seong Kim Autographed Ball", "brand": "MLB", "price": "$89.99", "image_url": "https://m.media-amazon.com/images/I/814ngfCiWbL.jpg"},
        {"product_name": "Alpha Grillers Meat Thermometer", "brand": "Alpha Grillers", "price": "$16.99", "image_url": "https://m.media-amazon.com/images/I/512O9dEwcWL.jpg"},
        {"product_name": "Amazon Business Amex Card", "brand": "Amex", "price": "$0.00", "image_url": "https://m.media-amazon.com/images/G/01/AmazonBusinessPayments/SBCC/DP/SBCC_US_DualCards.png"},
        {"product_name": "Owala FreeSip Water Bottle", "brand": "Owala", "price": "$27.99", "image_url": "https://m.media-amazon.com/images/I/31jQEUMGhCL.jpg"},
        {"product_name": "Blink Plus", "brand": "Blink", "price": "$10.00", "image_url": "https://m.media-amazon.com/images/G/01/B08JHCVHTY/correct.png"},
    ],
    "products": [
        {"product_name": "Amazon Basics Dog Pee Pads", "brand": "Amazon Basics", "price": "$15.99", "image_url": "https://m.media-amazon.com/images/I/51YxZi7vGDL.jpg"},
        {"product_name": "Amazon Basics Copy Paper", "brand": "Amazon Basics", "price": "$9.99", "image_url": "https://m.media-amazon.com/images/I/21aO-njfR+L.jpg"},
        {"product_name": "MedPride Nitrile Gloves", "brand": "MedPride", "price": "$12.50", "image_url": "https://m.media-amazon.com/images/I/41xqIEtBfrS.jpg"},
        {"product_name": "Kinsa Smart Thermometer", "brand": "Kinsa", "price": "$24.99", "image_url": "https://m.media-amazon.com/images/I/41ryt9CsQ8L.jpg"},
        {"product_name": "Ernie Ball Guitar Strings", "brand": "Ernie Ball", "price": "$6.99", "image_url": "https://m.media-amazon.com/images/I/81Cz93WGTaL.jpg"},
        {"product_name": "Beef Tallow For Skin", "brand": "Generic", "price": "$18.00", "image_url": "https://m.media-amazon.com/images/I/513SjixzqQL.jpg"},
        {"product_name": "Guns (Kindle Single)", "brand": "Kindle", "price": "$1.99", "image_url": "https://m.media-amazon.com/images/I/3167D-lfywL.jpg"},
        {"product_name": "Gerber Baby Onesies", "brand": "Gerber", "price": "$14.00", "image_url": "https://m.media-amazon.com/images/I/418K1iNJhlL.jpg"},
        {"product_name": "Chicken Diapers", "brand": "Generic", "price": "$11.99", "image_url": "https://m.media-amazon.com/images/I/410R5D+f84L.jpg"},
        {"product_name": "Lizards Clothes for Bearded Dragon", "brand": "Generic", "price": "$8.50", "image_url": "https://m.media-amazon.com/images/I/51482YAedyL.jpg"},
        {"product_name": "Bearded Dragon Travel Backpack", "brand": "Generic", "price": "$22.00", "image_url": "https://m.media-amazon.com/images/I/51Eg+I5h3-L.jpg"},
        {"product_name": "Queenmore Small Dog Sweaters", "brand": "Queenmore", "price": "$13.99", "image_url": "https://m.media-amazon.com/images/I/4118uKRUkNL.jpg"},
        {"product_name": "Artificial Grass Potty Mat", "brand": "Generic", "price": "$25.99", "image_url": "https://m.media-amazon.com/images/I/51dF+1C1idL.jpg"},
        {"product_name": "Yosemite Address Light", "brand": "Yosemite", "price": "$35.00", "image_url": "https://m.media-amazon.com/images/I/41F0dNk9FrL.jpg"},
        {"product_name": "Midwest Hearth Valve Key", "brand": "Midwest Hearth", "price": "$14.99", "image_url": "https://m.media-amazon.com/images/I/31AHo6iH6FL.jpg"},
        {"product_name": "American Fireglass Lava Rock", "brand": "American Fireglass", "price": "$19.50", "image_url": "https://m.media-amazon.com/images/I/51SHiV-gokL.jpg"},
        {"product_name": "Pride and Prejudice Kindle", "brand": "Kindle", "price": "$0.00", "image_url": "https://m.media-amazon.com/images/I/51jSMPqBXxL.jpg"},
        {"product_name": "Pellets Barn Owl Pellet", "brand": "Generic", "price": "$9.00", "image_url": "https://m.media-amazon.com/images/I/41zzkO2a04L.jpg"},
        {"product_name": "Starbond CA Glue Accelerator", "brand": "Starbond", "price": "$15.99", "image_url": "https://m.media-amazon.com/images/I/51DVKNV8V5L.jpg"},
        {"product_name": "Blingstar L Bracket", "brand": "Blingstar", "price": "$11.00", "image_url": "https://m.media-amazon.com/images/I/51szdDkwBEL.jpg"},
        {"product_name": "Plastic Hole Plugs", "brand": "Generic", "price": "$7.99", "image_url": "https://m.media-amazon.com/images/I/51fMljSiRYL.jpg"},
        {"product_name": "U Brands Bulletin Board", "brand": "U Brands", "price": "$16.00", "image_url": "https://m.media-amazon.com/images/I/31j6W9BynZL.jpg"},
        {"product_name": "MATEIN Cable Organizer Bag", "brand": "MATEIN", "price": "$15.99", "image_url": "https://m.media-amazon.com/images/I/51+-HSpCovL.jpg"},
        {"product_name": "How To Train Your Dragon Storybook", "brand": "Storybook", "price": "$6.99", "image_url": "https://m.media-amazon.com/images/I/81aq4IxenbL.png"},
        {"product_name": "Ethernet Adapter for Fire TV", "brand": "Amazon", "price": "$14.99", "image_url": "https://m.media-amazon.com/images/I/41Dmsxz0qDL.jpg"},
    ],
}

def _price_to_points(price: str) -> int:
    try:
        usd = float(str(price).replace("$", "").replace(",", "").strip())
        return int(round(usd * POINTS_PER_USD))
    except Exception:
        return 0

def _marketplace_payloads() -> List[dict]:
    payloads: List[dict] = []
    for row in MARKETPLACE_SOURCE["offers"]:
        payloads.append({
            "title": row["product_name"],
            "description": f"{row['brand']} offer",
            "cost": _price_to_points(row["price"]),
            "type": "offer",
            "category": "offer",
            "active": True,
            "inventory": 100,
            "brand": row["brand"],
            "image_url": row["image_url"],
            "cuid": cuid(),
        })
    for row in MARKETPLACE_SOURCE["products"]:
        payloads.append({
            "title": row["product_name"],
            "description": f"{row['brand']} product",
            "cost": _price_to_points(row["price"]),
            "type": "product",
            "category": "product",
            "active": True,
            "inventory": 80,
            "brand": row["brand"],
            "image_url": row["image_url"],
            "cuid": cuid(),
        })
    return payloads

def seed():
    reset_collections()
    # Create one admin user in verified_users
    admin = {
        "name":"Charlie Admin", "email":"admin@greenbank.io", "password":"Admin123!", "role":"ADMIN",
        "firstName":"Charlie", "lastName":"Admin", "kycComplete":True, "fraudClear":True,
        "greenScore":800, "balance": 1000, "createdAt": now_iso()
    }
    put("verified_users", next_id(), admin)
    put("user_wallets", next_id(), {"email": admin["email"], "balance": 1000})

    # Seed marketplace
    mp_payloads = _marketplace_payloads()
    batch_put("marketplace", 1, mp_payloads)

    return {"status": "seeded", "verified_users": 1, "wallets": 1, "marketplace": len(mp_payloads)}
