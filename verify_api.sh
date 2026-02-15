#!/bin/bash

BASE_URL="http://localhost:5001"
EMAIL="frankie_id_test_$(date +%s)@greenbank.io"

echo "1. Signup..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Frankie Finder\", \"email\":\"$EMAIL\", \"password\":\"password123\"}")

echo "Response: $RESPONSE"

# Extract token (simple grep/sed, assuming JSON structure)
TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "No token in signup output. Trying login..."
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\", \"password\":\"password123\"}")
  TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "Still no token. Failed."
  exit 1
fi

echo "Got Token: ${TOKEN:0:10}..."


echo "2. KYC..."
curl -v -X POST "$BASE_URL/api/kyc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"firstName": "Frankie", "lastName": "Finder", "ssn": "9999", "dob": "1990-01-01", "address": "123 St", "city": "City", "state": "CA", "zip": "90210", "phone": "5555555555"}'

echo "3. Login Scan Test..."
# Using the same email to see if find_one works
curl -v -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\", \"password\":\"password123\"}"
