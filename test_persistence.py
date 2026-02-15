from backend import db
import time

print("Testing Actian Persistence...")
test_id = 999999
test_payload = {"email": "persistence@test.com", "balance": 123}

if db.get_by_id("user_wallets", test_id):
    print("Found existing test record! Persistence WORKS.")
    db.put("user_wallets", test_id, {**test_payload, "balance": 456})
    print("Updated record.")
else:
    print("No existing test record. Creating new one.")
    db.put("user_wallets", test_id, test_payload)
    print("Created record.")

# Verify immediate read
rec = db.get_by_id("user_wallets", test_id)
print(f"Immediate read: {rec}")
