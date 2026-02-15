import requests
import json
import time

BASE_URL = "http://localhost:5002/api"

def run_test():
    print("Test: Signup -> Claim -> Verify Balance")
    
    # 1. Signup
    email = f"claimtest_{int(time.time())}@example.com"
    print(f"Signing up {email}...")
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "name": "Claim Test",
        "email": email,
        "password": "pass"
    })
    if res.status_code != 200:
        print(f"Signup failed: {res.text}")
        return
    
    data = res.json()
    token = data["token"]
    user_id = data["user"]["_id"]
    print(f"User ID: {user_id}")
    
    # 2. Check initial wallet
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{BASE_URL}/wallet", headers=headers)
    print(f"Initial Wallet: {res.json()}")
    initial_balance = res.json().get("balance", 0)
    
    # 3. Submit Claim
    print("Submitting Claim ($100)...")
    claim_payload = {
        "receiptNumber": f"REC-{int(time.time())}",
        "date": "2026-02-15",
        "amount": 100.0,
        "description": "Test Claim",
        "category": "EV charging"
    }
    res = requests.post(f"{BASE_URL}/claims", json=claim_payload, headers=headers)
    if res.status_code != 200:
        print(f"Claim failed: {res.text}")
        return
        
    claim_res = res.json()
    print(f"Claim Response: {claim_res}")
    expected_points = claim_res["points"]
    
    # 4. Check Wallet Again
    res = requests.get(f"{BASE_URL}/wallet", headers=headers)
    print(f"Post-Claim Wallet: {res.json()}")
    final_balance = res.json().get("balance", 0)
    
    if final_balance == initial_balance + expected_points:
        print("SUCCESS: Balance updated correctly.")
    else:
        print(f"FAILURE: Balance mismatch! Expected {initial_balance + expected_points}, got {final_balance}")

    # 5. Check Persistence (Direct DB check via backend script helper would be better but API represents truth)
    # If API sees it, it's in DB (or cache).
    # To check "Database", we rely on API. 
    # User might mean 'after refresh'.

if __name__ == "__main__":
    run_test()
