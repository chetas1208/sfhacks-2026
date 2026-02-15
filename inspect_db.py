from backend import db
from cortex import CortexClient
import time

print("--- Actian VectorAI Inspection ---")
try:
    with CortexClient(db.ACTIAN_HOST) as c:
        # Check collections
        for name in db.COLLECTIONS:
            if c.has_collection(name):
                print(f"✅ Collection '{name}' exists.")
            else:
                print(f"❌ Collection '{name}' MISSING!")

        # TEST INSERT
        print("\n--- Test Insert Step 1 (Write) ---")
        test_id = 999999
        # Exact payload from log
        test_payload = {'name': 'Frankie Finder', 'email': 'frankie@greenbank.io', 'password': 'password123', 'role': 'USER', 'kycComplete': False, 'fraudClear': False, 'createdAt': '2026-02-15T03:51:11.109702'}
        print(f"Upserting ID {test_id} with FULL PAYLOAD...")
        c.upsert("verified_users", id=test_id, vector=[0.0]*4, payload=test_payload)
        c.flush("verified_users")
        print("Flushed. Closing connection...")

    print("\n--- Test Insert Step 2 (Read New Connection) ---")
    with CortexClient(db.ACTIAN_HOST) as c2:
        r = c2.get("verified_users", test_id)
        if r:
            print(f"✅ Read back success across connections: {r}")
            # Cleanup
            c2.delete("verified_users", test_id)
            c2.flush("verified_users")
        else:
            print("❌ Read back FAILED across connections!")

        # Dump users via Scroll (Testing Consistency)
        print("\n--- Testing Scroll Consistency ---")
        found_in_scroll = False
        start_time = time.time()
        for i in range(10):
            try:
                # Use c2, not c
                res = c2.scroll("verified_users")
                records = res[0] if isinstance(res, tuple) else res
                print(f"Scroll Attempt {i+1}: Found {len(records)} records")
                
                # Check if test_id is in records
                for r in records:
                    rid = r.id if hasattr(r, 'id') else getattr(r, '_id', None)
                    if rid == test_id:
                        print(f"✅ Found ID {test_id} in scroll after {time.time() - start_time:.2f}s")
                        found_in_scroll = True
                        break
                
                if found_in_scroll: break
                time.sleep(1)
            except Exception as e:
                print(f"Error scrolling: {e}")
                
        if not found_in_scroll:
            print("❌ ID {test_id} NOT found in scroll after 10s!")

except Exception as e:
    print(f"Error connecting to DB: {e}")
