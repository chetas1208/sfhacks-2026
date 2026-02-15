"""
Actian VectorAI DB Data Layer – GECB
=====================================
Dual-mode: Actian VectorAI when Docker is running, in-memory fallback otherwise.
All CRUD operations work transparently on either backend.

Collections: users, claims, user_wallets, marketplace_products
"""

import os, copy, uuid, time
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
        print(f"[db] ⚠️  Actian unavailable, using in-memory storage")

_try_actian()

# ── In-memory store ───────────────────────────────────────

_mem: dict[str, dict[int, dict]] = {}

def _mem_ensure(col: str):
    if col not in _mem:
        _mem[col] = {}

COLLECTIONS = ["users", "claims", "user_wallets", "marketplace_products"]

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
    return {"status": "reset"}

# ── CRUD ──────────────────────────────────────────────────

def put(collection: str, record_id: int, payload: dict):
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            c.upsert(collection, id=record_id, vector=dummy_vec(), payload=payload)
            c.flush(collection)
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

def get_all(collection: str, limit: int = 500) -> List[dict]:
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            result = c.scroll(collection, limit=limit)
            records = result[0] if isinstance(result, tuple) else result
            return [{"_id": r.id if hasattr(r,'id') else 0, **(r.payload if hasattr(r,'payload') else {})} for r in records]
    else:
        _mem_ensure(collection)
        return [{"_id": rid, **copy.deepcopy(data)} for rid, data in list(_mem[collection].items())[:limit]]

def find_by(collection: str, field: str, value, limit: int = 100) -> List[dict]:
    return [r for r in get_all(collection, limit * 5) if r.get(field) == value][:limit]

def find_one(collection: str, field: str, value) -> Optional[dict]:
    results = find_by(collection, field, value, limit=1)
    return results[0] if results else None

def count(collection: str) -> int:
    if _USE_ACTIAN:
        from cortex import CortexClient
        with CortexClient(ACTIAN_HOST) as c:
            return c.count(collection)
    else:
        _mem_ensure(collection)
        return len(_mem[collection])

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
# SEED DATA
# ═══════════════════════════════════════════════════════════

USER_PROFILES = [
    {"name":"Alice Johnson","email":"alice@greenbank.io","password":"Pass123!","role":"USER","firstName":"Alice","lastName":"Johnson","ssn":"1234","dob":"1995-06-15","address":"123 Green St","city":"San Francisco","state":"CA","zip":"94102","phone":"4151234567"},
    {"name":"Bob Smith","email":"bob@greenbank.io","password":"Pass123!","role":"REVIEWER","firstName":"Bob","lastName":"Smith","ssn":"2345","dob":"1990-03-22","address":"456 Oak Ave","city":"San Jose","state":"CA","zip":"95112","phone":"4082345678"},
    {"name":"Charlie Admin","email":"admin@greenbank.io","password":"Admin123!","role":"ADMIN","firstName":"Charlie","lastName":"Davis","ssn":"3456","dob":"1988-11-30","address":"789 Elm Blvd","city":"Oakland","state":"CA","zip":"94601","phone":"5103456789"},
    {"name":"Diana Chen","email":"diana@greenbank.io","password":"Pass123!","role":"USER","firstName":"Diana","lastName":"Chen","ssn":"4567","dob":"1997-01-10","address":"321 Pine Rd","city":"Berkeley","state":"CA","zip":"94704","phone":"5104567890"},
    {"name":"Ethan Patel","email":"ethan@greenbank.io","password":"Pass123!","role":"USER","firstName":"Ethan","lastName":"Patel","ssn":"5678","dob":"1993-08-05","address":"654 Maple Ct","city":"Palo Alto","state":"CA","zip":"94301","phone":"6505678901"},
    {"name":"Fiona Garcia","email":"fiona@greenbank.io","password":"Pass123!","role":"USER","firstName":"Fiona","lastName":"Garcia","ssn":"6789","dob":"1996-12-18","address":"987 Cedar Ln","city":"Santa Clara","state":"CA","zip":"95050","phone":"4086789012"},
    {"name":"George Kim","email":"george@greenbank.io","password":"Pass123!","role":"USER","firstName":"George","lastName":"Kim","ssn":"7890","dob":"1994-04-25","address":"147 Birch Way","city":"Sunnyvale","state":"CA","zip":"94086","phone":"4087890123"},
    {"name":"Hannah Lee","email":"hannah@greenbank.io","password":"Pass123!","role":"USER","firstName":"Hannah","lastName":"Lee","ssn":"8901","dob":"1998-07-03","address":"258 Walnut Dr","city":"Mountain View","state":"CA","zip":"94040","phone":"6508901234"},
    {"name":"Ivan Russo","email":"ivan@greenbank.io","password":"Pass123!","role":"USER","firstName":"Ivan","lastName":"Russo","ssn":"9012","dob":"1991-09-14","address":"369 Spruce Pl","city":"Redwood City","state":"CA","zip":"94061","phone":"6509012345"},
    {"name":"Julia Nguyen","email":"julia@greenbank.io","password":"Pass123!","role":"USER","firstName":"Julia","lastName":"Nguyen","ssn":"0123","dob":"1999-02-28","address":"480 Ash St","city":"Fremont","state":"CA","zip":"94536","phone":"5100123456"},
    {"name":"Kevin Brown","email":"kevin@greenbank.io","password":"Pass123!","role":"USER","firstName":"Kevin","lastName":"Brown","ssn":"1111","dob":"1992-05-20","address":"591 Poplar Ave","city":"Hayward","state":"CA","zip":"94541","phone":"5101111111"},
    {"name":"Laura Martinez","email":"laura@greenbank.io","password":"Pass123!","role":"USER","firstName":"Laura","lastName":"Martinez","ssn":"2222","dob":"1995-10-08","address":"702 Willow Rd","city":"Daly City","state":"CA","zip":"94015","phone":"6502222222"},
    {"name":"Mike Thompson","email":"mike@greenbank.io","password":"Pass123!","role":"USER","firstName":"Mike","lastName":"Thompson","ssn":"3333","dob":"1990-01-15","address":"813 Sycamore Ct","city":"South SF","state":"CA","zip":"94080","phone":"6503333333"},
    {"name":"Nina Anderson","email":"nina@greenbank.io","password":"Pass123!","role":"USER","firstName":"Nina","lastName":"Anderson","ssn":"4444","dob":"1997-06-22","address":"924 Chestnut Ln","city":"San Mateo","state":"CA","zip":"94401","phone":"6504444444"},
    {"name":"Oscar Wilson","email":"oscar@greenbank.io","password":"Pass123!","role":"USER","firstName":"Oscar","lastName":"Wilson","ssn":"5555","dob":"1993-11-30","address":"135 Laurel Way","city":"Burlingame","state":"CA","zip":"94010","phone":"6505555555"},
    {"name":"Priya Sharma","email":"priya@greenbank.io","password":"Pass123!","role":"USER","firstName":"Priya","lastName":"Sharma","ssn":"6666","dob":"1996-03-12","address":"246 Magnolia Dr","city":"Foster City","state":"CA","zip":"94404","phone":"6506666666"},
    {"name":"Quinn Taylor","email":"quinn@greenbank.io","password":"Pass123!","role":"USER","firstName":"Quinn","lastName":"Taylor","ssn":"7777","dob":"1994-08-19","address":"357 Juniper Pl","city":"Millbrae","state":"CA","zip":"94030","phone":"6507777777"},
    {"name":"Rachel Moore","email":"rachel@greenbank.io","password":"Pass123!","role":"USER","firstName":"Rachel","lastName":"Moore","ssn":"8888","dob":"1998-12-05","address":"468 Dogwood St","city":"San Bruno","state":"CA","zip":"94066","phone":"6508888888"},
    {"name":"Sam Jackson","email":"sam@greenbank.io","password":"Pass123!","role":"USER","firstName":"Sam","lastName":"Jackson","ssn":"9999","dob":"1991-04-17","address":"579 Holly Ave","city":"Pacifica","state":"CA","zip":"94044","phone":"6509999999"},
    {"name":"Tina White","email":"tina@greenbank.io","password":"Pass123!","role":"USER","firstName":"Tina","lastName":"White","ssn":"1010","dob":"1999-07-23","address":"680 Ivy Rd","city":"Half Moon Bay","state":"CA","zip":"94019","phone":"6501010101"},
    {"name":"Uma Krishnan","email":"uma@greenbank.io","password":"Pass123!","role":"USER","firstName":"Uma","lastName":"Krishnan","ssn":"1212","dob":"1995-02-14","address":"791 Fern Ct","city":"Cupertino","state":"CA","zip":"95014","phone":"4081212121"},
    {"name":"Victor Lopez","email":"victor@greenbank.io","password":"Pass123!","role":"USER","firstName":"Victor","lastName":"Lopez","ssn":"1313","dob":"1992-09-08","address":"802 Reed Ln","city":"Milpitas","state":"CA","zip":"95035","phone":"4081313131"},
    {"name":"Wendy Park","email":"wendy@greenbank.io","password":"Pass123!","role":"USER","firstName":"Wendy","lastName":"Park","ssn":"1414","dob":"1997-05-30","address":"913 Sage Way","city":"Newark","state":"CA","zip":"94560","phone":"5101414141"},
    {"name":"Xavier Flores","email":"xavier@greenbank.io","password":"Pass123!","role":"USER","firstName":"Xavier","lastName":"Flores","ssn":"1515","dob":"1993-12-25","address":"124 Thyme Dr","city":"Union City","state":"CA","zip":"94587","phone":"5101515151"},
    {"name":"Yuki Tanaka","email":"yuki@greenbank.io","password":"Pass123!","role":"USER","firstName":"Yuki","lastName":"Tanaka","ssn":"1616","dob":"1996-06-11","address":"235 Rosemary Pl","city":"Pleasanton","state":"CA","zip":"94566","phone":"9251616161"},
    {"name":"Zara Ahmed","email":"zara@greenbank.io","password":"Pass123!","role":"USER","firstName":"Zara","lastName":"Ahmed","ssn":"1717","dob":"1994-10-03","address":"346 Basil St","city":"Dublin","state":"CA","zip":"94568","phone":"9251717171"},
    {"name":"Aaron Mitchell","email":"aaron@greenbank.io","password":"Pass123!","role":"USER","firstName":"Aaron","lastName":"Mitchell","ssn":"1818","dob":"1998-01-27","address":"457 Clover Ave","city":"Livermore","state":"CA","zip":"94550","phone":"9251818181"},
    {"name":"Bella Santos","email":"bella@greenbank.io","password":"Pass123!","role":"USER","firstName":"Bella","lastName":"Santos","ssn":"1919","dob":"1991-07-16","address":"568 Mint Rd","city":"Tracy","state":"CA","zip":"95376","phone":"2091919191"},
    {"name":"Carlos Rivera","email":"carlos@greenbank.io","password":"Pass123!","role":"USER","firstName":"Carlos","lastName":"Rivera","ssn":"2020","dob":"1999-03-09","address":"679 Dill Ct","city":"Stockton","state":"CA","zip":"95202","phone":"2092020202"},
    {"name":"Delia Wong","email":"delia@greenbank.io","password":"Pass123!","role":"USER","firstName":"Delia","lastName":"Wong","ssn":"2121","dob":"1995-08-21","address":"780 Parsley Ln","city":"Concord","state":"CA","zip":"94520","phone":"9252121212"},
    {"name":"Eric Foster","email":"eric@greenbank.io","password":"Pass123!","role":"USER","firstName":"Eric","lastName":"Foster","ssn":"2323","dob":"1992-11-14","address":"891 Oregano Way","city":"Walnut Creek","state":"CA","zip":"94596","phone":"9252323232"},
    {"name":"Fatima Ali","email":"fatima@greenbank.io","password":"Pass123!","role":"USER","firstName":"Fatima","lastName":"Ali","ssn":"2424","dob":"1997-04-07","address":"902 Tarragon Dr","city":"San Ramon","state":"CA","zip":"94583","phone":"9252424242"},
    {"name":"Greg Hill","email":"greg@greenbank.io","password":"Pass123!","role":"USER","firstName":"Greg","lastName":"Hill","ssn":"2525","dob":"1993-06-29","address":"113 Coriander Pl","city":"Danville","state":"CA","zip":"94526","phone":"9252525252"},
    {"name":"Holly Reed","email":"holly@greenbank.io","password":"Pass123!","role":"USER","firstName":"Holly","lastName":"Reed","ssn":"2626","dob":"1996-09-18","address":"224 Cumin St","city":"Antioch","state":"CA","zip":"94509","phone":"9252626262"},
    {"name":"Isaac Cruz","email":"isaac@greenbank.io","password":"Pass123!","role":"USER","firstName":"Isaac","lastName":"Cruz","ssn":"2727","dob":"1994-02-12","address":"335 Paprika Ave","city":"Pittsburg","state":"CA","zip":"94565","phone":"9252727272"},
    {"name":"Jade Cooper","email":"jade@greenbank.io","password":"Pass123!","role":"USER","firstName":"Jade","lastName":"Cooper","ssn":"2828","dob":"1998-05-24","address":"446 Saffron Rd","city":"Brentwood","state":"CA","zip":"94513","phone":"9252828282"},
    {"name":"Kyle Morgan","email":"kyle@greenbank.io","password":"Pass123!","role":"USER","firstName":"Kyle","lastName":"Morgan","ssn":"2929","dob":"1991-10-31","address":"557 Turmeric Ct","city":"Martinez","state":"CA","zip":"94553","phone":"9252929292"},
    {"name":"Lily Evans","email":"lily@greenbank.io","password":"Pass123!","role":"USER","firstName":"Lily","lastName":"Evans","ssn":"3030","dob":"1999-01-06","address":"668 Nutmeg Ln","city":"Richmond","state":"CA","zip":"94801","phone":"5103030303"},
    {"name":"Mason Perry","email":"mason@greenbank.io","password":"Pass123!","role":"USER","firstName":"Mason","lastName":"Perry","ssn":"3131","dob":"1995-07-19","address":"779 Ginger Way","city":"El Cerrito","state":"CA","zip":"94530","phone":"5103131313"},
    {"name":"Nora Collins","email":"nora@greenbank.io","password":"Pass123!","role":"USER","firstName":"Nora","lastName":"Collins","ssn":"3232","dob":"1992-12-03","address":"880 Vanilla Dr","city":"Albany","state":"CA","zip":"94706","phone":"5103232323"},
    {"name":"Owen Price","email":"owen@greenbank.io","password":"Pass123!","role":"USER","firstName":"Owen","lastName":"Price","ssn":"3434","dob":"1997-03-26","address":"991 Fennel Pl","city":"Emeryville","state":"CA","zip":"94608","phone":"5103434343"},
    {"name":"Paige Howard","email":"paige@greenbank.io","password":"Pass123!","role":"USER","firstName":"Paige","lastName":"Howard","ssn":"3535","dob":"1993-08-15","address":"102 Anise St","city":"San Leandro","state":"CA","zip":"94577","phone":"5103535353"},
    {"name":"Ray Butler","email":"ray@greenbank.io","password":"Pass123!","role":"USER","firstName":"Ray","lastName":"Butler","ssn":"3636","dob":"1996-11-27","address":"213 Caraway Ave","city":"Alameda","state":"CA","zip":"94501","phone":"5103636363"},
    {"name":"Sophia Barnes","email":"sophia@greenbank.io","password":"Pass123!","role":"USER","firstName":"Sophia","lastName":"Barnes","ssn":"3737","dob":"1994-04-09","address":"324 Cardamom Rd","city":"San Carlos","state":"CA","zip":"94070","phone":"6503737373"},
    {"name":"Tyler Ross","email":"tyler@greenbank.io","password":"Pass123!","role":"USER","firstName":"Tyler","lastName":"Ross","ssn":"3838","dob":"1998-06-20","address":"435 Mace Ct","city":"Belmont","state":"CA","zip":"94002","phone":"6503838383"},
    {"name":"Ursula Gray","email":"ursula@greenbank.io","password":"Pass123!","role":"USER","firstName":"Ursula","lastName":"Gray","ssn":"3939","dob":"1991-02-08","address":"546 Sumac Ln","city":"Menlo Park","state":"CA","zip":"94025","phone":"6503939393"},
    {"name":"Vince Kelly","email":"vince@greenbank.io","password":"Pass123!","role":"USER","firstName":"Vince","lastName":"Kelly","ssn":"4040","dob":"1999-09-12","address":"657 Bay Way","city":"Atherton","state":"CA","zip":"94027","phone":"6504040404"},
    {"name":"Willow Diaz","email":"willow@greenbank.io","password":"Pass123!","role":"USER","firstName":"Willow","lastName":"Diaz","ssn":"4141","dob":"1995-05-01","address":"768 Palm Dr","city":"Woodside","state":"CA","zip":"94062","phone":"6504141414"},
    {"name":"Xena Powell","email":"xena@greenbank.io","password":"Pass123!","role":"USER","firstName":"Xena","lastName":"Powell","ssn":"4242","dob":"1992-10-17","address":"879 Canyon Pl","city":"Portola Valley","state":"CA","zip":"94028","phone":"6504242424"},
    {"name":"Yosef Long","email":"yosef@greenbank.io","password":"Pass123!","role":"USER","firstName":"Yosef","lastName":"Long","ssn":"4343","dob":"1997-07-29","address":"980 Ridge St","city":"Los Altos","state":"CA","zip":"94022","phone":"6504343434"},
]

MARKETPLACE_ITEMS = [
    {"title":"Campus Café $5 Gift Card","description":"Enjoy a free coffee or snack at the campus café","cost":50,"active":True,"inventory":100,"category":"food"},
    {"title":"Library Print Credits (100 pages)","description":"100 free pages of printing at any campus library","cost":30,"active":True,"inventory":200,"category":"academic"},
    {"title":"Portable Solar Charger","description":"Eco-friendly solar phone charger","cost":500,"active":True,"inventory":10,"category":"tech"},
    {"title":"Bamboo Water Bottle","description":"Sustainable bamboo & stainless steel water bottle","cost":80,"active":True,"inventory":50,"category":"lifestyle"},
    {"title":"Recycled Notebook Set","description":"3-pack notebooks from 100% recycled paper","cost":25,"active":True,"inventory":150,"category":"academic"},
    {"title":"Organic Cotton Tote Bag","description":"Reusable shopping bag – say no to plastic","cost":40,"active":True,"inventory":75,"category":"lifestyle"},
    {"title":"LED Desk Lamp","description":"Energy-efficient LED lamp for your study desk","cost":150,"active":True,"inventory":30,"category":"tech"},
    {"title":"Public Transit Pass (1 Week)","description":"7-day unlimited rides on local transit","cost":200,"active":True,"inventory":40,"category":"transport"},
    {"title":"Farmers Market Voucher ($10)","description":"Support local organic farmers with this voucher","cost":100,"active":True,"inventory":60,"category":"food"},
    {"title":"Tree Planting Certificate","description":"We plant a tree in your name","cost":300,"active":True,"inventory":999,"category":"impact"},
]

ACTION_TYPES = [
    {"code":"BIKE_TO_CAMPUS","title":"Bike to Campus","baseCredits":10,"icon":"🚲"},
    {"code":"PUBLIC_TRANSIT","title":"Public Transit Ride","baseCredits":8,"icon":"🚌"},
    {"code":"ENERGY_SCREENSHOT","title":"Energy Usage Screenshot","baseCredits":5,"icon":"⚡"},
    {"code":"RECYCLING","title":"Recycling Drop-off","baseCredits":6,"icon":"♻️"},
    {"code":"REUSABLE_CONTAINER","title":"Reusable Container Used","baseCredits":3,"icon":"🥤"},
    {"code":"SOLAR_PANEL","title":"Solar Panel Install","baseCredits":50,"icon":"☀️"},
    {"code":"COMPOST","title":"Composting","baseCredits":4,"icon":"🌱"},
    {"code":"CARPOOL","title":"Carpooling","baseCredits":7,"icon":"🚗"},
]

def seed():
    reset_collections()
    user_payloads = [{**u, "createdAt": now_iso(), "kycComplete": False, "fraudClear": False, "greenScore": None} for u in USER_PROFILES]
    batch_put("users", 1, user_payloads)
    wallet_payloads = [{"email": u["email"], "balance": 0, "transactions": [], "purchaseHistory": []} for u in USER_PROFILES]
    batch_put("user_wallets", 1, wallet_payloads)
    product_payloads = [{**item, "cuid": cuid()} for item in MARKETPLACE_ITEMS]
    batch_put("marketplace_products", 1, product_payloads)
    return {"status": "seeded", "users": len(USER_PROFILES), "wallets": len(USER_PROFILES), "products": len(MARKETPLACE_ITEMS), "actionTypes": len(ACTION_TYPES), "storage": "Actian VectorAI" if _USE_ACTIAN else "In-Memory"}
