import requests

BASE_URL = "http://localhost:5001"

def test_flow():
    # 1. Signup
    print("Trying Signup...")
    email = "frank@greenbank.io"
    resp = requests.post(f"{BASE_URL}/api/auth/signup", json={
        "name": "Frank Finder",
        "email": email,
        "password": "password123"
    })
    
    if resp.status_code == 409:
        print("User exists, trying login...")
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": "password123"
        })

    if not resp.ok:
        print(f"Auth failed: {resp.text}")
        return

    data = resp.json()
    token = data.get("token")
    print(f"Got Token: {token[:10]}...")

    # 2. KYC
    print("Trying KYC...")
    headers = {"Authorization": f"Bearer {token}"}
    kyc_data = {
        "firstName": "Frank", "lastName": "Finder", "ssn": "1234", "dob": "1990-01-01",
        "address": "123 St", "city": "City", "state": "CA", "zip": "90210", "phone": "5555555555"
    }
    
    resp = requests.post(f"{BASE_URL}/api/kyc", json=kyc_data, headers=headers)
    print(f"KYC Status: {resp.status_code}")
    print(f"KYC Response: {resp.text}")

if __name__ == "__main__":
    test_flow()
