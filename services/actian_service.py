"""
Actian VectorAI DB Service
===========================
Two collections:
  1. marketplace  – reward item embeddings (semantic search for recommendations)
  2. wallet       – transaction embeddings (anomaly detection, history search)

Usage (CLI):
    python services/actian_service.py setup
    python services/actian_service.py upsert_product  '{"id":0,"vector":[0.1,...], "metadata":{...}}'
    python services/actian_service.py search_marketplace '{"vector":[0.1,...], "limit":5}'
    python services/actian_service.py upsert_wallet '{"id":0,"vector":[0.1,...], "metadata":{...}}'
    python services/actian_service.py search_wallet  '{"vector":[0.1,...], "limit":5}'
    python services/actian_service.py health
"""

import sys
import json
import asyncio
import os

# Graceful import – works without the .whl installed (returns mock data)
try:
    from cortex import CortexClient, DistanceMetric
    HAS_CORTEX = True
except ImportError:
    HAS_CORTEX = False

ACTIAN_HOST = os.getenv("ACTIAN_HOST", "localhost:50051")
DIMENSION   = 128  # embedding dimension for demo

# ── Collection helpers ─────────────────────────────────────

def get_client():
    return CortexClient(ACTIAN_HOST)


def setup():
    """Create the two collections if they don't exist."""
    if not HAS_CORTEX:
        return {"status": "skipped", "reason": "actiancortex not installed"}

    with get_client() as c:
        ver, up = c.health_check()
        # Marketplace collection (cosine similarity for product recs)
        if not c.has_collection("marketplace"):
            c.create_collection("marketplace", DIMENSION, distance_metric=DistanceMetric.COSINE)
        # Wallet collection (euclidean for anomaly / distance analysis)
        if not c.has_collection("wallet"):
            c.create_collection("wallet", DIMENSION, distance_metric=DistanceMetric.EUCLIDEAN)

    return {"status": "ok", "version": ver, "uptime": str(up)}


def health():
    if not HAS_CORTEX:
        return {"status": "skipped", "reason": "actiancortex not installed"}
    with get_client() as c:
        ver, up = c.health_check()
    return {"status": "ok", "version": ver, "uptime": str(up)}


# ── Marketplace operations ─────────────────────────────────

def upsert_product(payload: dict):
    """Insert or update a product vector.
    payload: { id: int, vector: float[], metadata: {} }
    """
    if not HAS_CORTEX:
        return {"status": "mocked"}

    with get_client() as c:
        c.upsert("marketplace",
                  id=int(payload["id"]),
                  vector=payload["vector"],
                  payload=payload.get("metadata", {}))
    return {"status": "ok"}


def batch_upsert_products(payload: dict):
    """Batch insert products.
    payload: { ids: int[], vectors: float[][], payloads: {}[] }
    """
    if not HAS_CORTEX:
        return {"status": "mocked"}

    with get_client() as c:
        c.batch_upsert("marketplace",
                       ids=payload["ids"],
                       vectors=payload["vectors"],
                       payloads=payload.get("payloads", []))
    return {"status": "ok", "count": len(payload["ids"])}


def search_marketplace(payload: dict):
    """K-NN search in marketplace.
    payload: { vector: float[], limit: int }
    """
    if not HAS_CORTEX:
        return [
            {"id": 1, "score": 0.95, "payload": {"title": "Solar Charger", "cost": 500}},
            {"id": 2, "score": 0.87, "payload": {"title": "Eco Bottle",    "cost": 20}},
            {"id": 3, "score": 0.80, "payload": {"title": "Bamboo Utensils","cost": 15}},
        ]

    with get_client() as c:
        results = c.search("marketplace",
                           query=payload["vector"],
                           top_k=payload.get("limit", 5))
    return [{"id": r.id, "score": r.score, "payload": r.payload} for r in results]


# ── Wallet / Transaction operations ────────────────────────

def upsert_wallet(payload: dict):
    """Insert a transaction vector.
    payload: { id: int, vector: float[], metadata: {} }
    """
    if not HAS_CORTEX:
        return {"status": "mocked"}

    with get_client() as c:
        c.upsert("wallet",
                  id=int(payload["id"]),
                  vector=payload["vector"],
                  payload=payload.get("metadata", {}))
    return {"status": "ok"}


def search_wallet(payload: dict):
    """K-NN search in wallet (find similar transactions).
    payload: { vector: float[], limit: int }
    """
    if not HAS_CORTEX:
        return [
            {"id": 10, "score": 0.3, "payload": {"type": "MINT",   "amount": 150, "desc": "Approved: Bike to Campus"}},
            {"id": 11, "score": 0.6, "payload": {"type": "REDEEM", "amount": -40, "desc": "Campus Café $2 off"}},
        ]

    with get_client() as c:
        results = c.search("wallet",
                           query=payload["vector"],
                           top_k=payload.get("limit", 5))
    return [{"id": r.id, "score": r.score, "payload": r.payload} for r in results]


def get_stats():
    if not HAS_CORTEX:
        return {"marketplace": "mock", "wallet": "mock"}
    with get_client() as c:
        m = c.get_stats("marketplace")
        w = c.get_stats("wallet")
    return {"marketplace": str(m), "wallet": str(w)}


# ── CLI dispatcher ─────────────────────────────────────────

COMMANDS = {
    "setup":              lambda p: setup(),
    "health":             lambda p: health(),
    "upsert_product":     upsert_product,
    "batch_upsert":       batch_upsert_products,
    "search_marketplace": search_marketplace,
    "upsert_wallet":      upsert_wallet,
    "search_wallet":      search_wallet,
    "stats":              lambda p: get_stats(),
}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python actian_service.py <command> [json_payload]"}))
        sys.exit(1)

    cmd = sys.argv[1]
    payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    handler = COMMANDS.get(cmd)
    if not handler:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
        sys.exit(1)

    try:
        result = handler(payload)
        print(json.dumps(result, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
