#!/bin/bash

# Configuration
API_URL="http://localhost:5001/api"
EMAIL="test_claim_$(date +%s)@greenbank.io"
PASSWORD="password123"

echo "--- Claims & Credits Test ---"
echo "Target: $EMAIL"

# 1. Signup (Expect 100 credits)
echo ""
echo "1. Signing up..."
SIGNUP_RES=$(curl -s "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Claim Tester\", \"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $SIGNUP_RES | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Signup failed: $SIGNUP_RES"
  exit 1
fi
echo "✅ Signup success. Token acquired."

# 2. Check Initial Balance (Should be 100)
echo ""
echo "2. Checking Initial Balance..."
PROFILE_RES=$(curl -s "$API_URL/profile" -H "Authorization: Bearer $TOKEN")
BALANCE=$(echo $PROFILE_RES | grep -o '"balance":[0-9]*' | cut -d':' -f2)

if [ "$BALANCE" == "100" ]; then
  echo "✅ Initial Balance is 100."
else
  echo "❌ Initial Balance check failed. Expected 100, got $BALANCE"
  echo "Response: $PROFILE_RES"
  exit 1
fi

# 3. Submit Claim (Bart - $50.50)
RECEIPT_NUM="REC-$(date +%s)"
echo ""
echo "3. Submitting Valid Claim (Bart - $50.50)..."
CLAIM_RES=$(curl -s "$API_URL/claims" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"category\": \"Bart\", \"date\": \"2026-02-15\", \"receiptNumber\": \"$RECEIPT_NUM\", \"amount\": 50.50, \"description\": \"Commute\"}")

STATUS=$(echo $CLAIM_RES | grep -o '"status":"approved"')
if [ -n "$STATUS" ]; then
  echo "✅ Claim Approved."
else
  echo "❌ Claim Failed: $CLAIM_RES"
  exit 1
fi

# 4. Check Balance (Should be 150.5)
echo ""
echo "4. Checking Balance after Claim..."
PROFILE_RES=$(curl -s "$API_URL/profile" -H "Authorization: Bearer $TOKEN")
BALANCE=$(echo $PROFILE_RES | grep -o '"balance":[0-9.]*' | cut -d':' -f2)

if [ "$BALANCE" == "150.5" ]; then
  echo "✅ Balance updated to 150.5."
else
  echo "❌ Balance update failed. Expected 150.5, got $BALANCE"
  exit 1
fi

# 5. Duplicate Claim (Should Fail)
echo ""
echo "5. Submitting Duplicate Claim..."
DUP_RES=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/claims" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"category\": \"Bart\", \"date\": \"2026-02-15\", \"receiptNumber\": \"$RECEIPT_NUM\", \"amount\": 50.50, \"description\": \"Duplicate\"}")

if [ "$DUP_RES" == "400" ]; then
  echo "✅ Duplicate Claim Rejected (400)."
else
  echo "❌ Duplicate Claim NOT Rejected. Code: $DUP_RES"
  exit 1
fi

echo ""
echo "🎉 ALL TESTS PASSED!"
