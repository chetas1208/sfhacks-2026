from cortex import CortexClient
import os
from dotenv import load_dotenv

load_dotenv()
ACTIAN_HOST = os.getenv("ACTIAN_HOST", "localhost:50051")

print(f"Testing Actian Search Filter on {ACTIAN_HOST}...")
try:
    with CortexClient(ACTIAN_HOST) as c:
        # Create test record
        test_id = 999999
        c.upsert("user_wallets", id=test_id, vector=[0.0]*4, payload={"email": "filter@test.com", "balance": 100})
        c.flush("user_wallets")
        
        # Test Search with Filter
        print("Searching with filter...")
        try:
            # Try filter arg first
            # Note: cortex client might not have 'filter' arg in search?
            # I need to inspect the client or just try.
            results = c.search("user_wallets", [0.0]*4, k=1, filter={"email": {"$eq": "filter@test.com"}})
            print(f"Search Results (filter arg): {results}")
        except TypeError:
            print("Search does not support 'filter' arg.")
        except Exception as e:
            print(f"Search failed: {type(e)} {e}")

        # Try find method if exists
        if hasattr(c, 'find'):
            print("Client has 'find' method. Testing...")
            try:
                res = c.find("user_wallets", filter={"email": {"$eq": "filter@test.com"}})
                print(f"Find Results: {res}")
            except Exception as e:
                print(f"Find failed: {e}")
        else:
            print("Client has NO 'find' method.")
            
except Exception as e:
    print(f"Connection failed: {e}")
