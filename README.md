# Green Energy Credit Bank (GECB)

A full-stack MVP for a sustainable action tracking and rewards platform. Users can submit claims for green actions, get peer-verified to earn credits, and redeem them in a marketplace. Includes an education module to boost earnings.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL (via Prisma ORM)
- **Vector DB**: [Actian VectorAI DB](https://www.actian.com/) – marketplace recommendations & transaction search
- **Auth**: NextAuth.js (Credentials)
- **AI**: Google Gemini (chatbot) + ElevenLabs (voice)
- **Credit Reporting**: StitchCredit CRS Sandbox (TransUnion, Experian, Equifax, FlexID, Fraud Finder)
- **OCR**: EasyOCR (receipt scanning)

## Prerequisites
- Node.js 18+
- Python 3.10+ (for Actian VectorAI & OCR services)
- Docker (for PostgreSQL and Actian VectorAI DB)

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Python Environment (for Actian VectorAI & OCR)
```bash
python -m venv .venv
source .venv/bin/activate          # Linux/macOS
pip install actiancortex-0.1.0b1-py3-none-any.whl  # Actian client
pip install easyocr                                  # OCR
```

### 3. Start Services (Docker)

**PostgreSQL + Actian VectorAI DB:**
```bash
docker compose up -d
```
This starts:
- PostgreSQL on `localhost:5432`
- Actian VectorAI DB on `localhost:50051`

### 4. Environment Variables
Copy `.env` and fill in your keys:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret for NextAuth |
| `ACTIAN_HOST` | VectorAI DB host (default: `localhost:50051`) |
| `CRS_USERNAME` | StitchCredit sandbox username |
| `CRS_PASSWORD` | StitchCredit sandbox password |
| `GEMINI_API_KEY` | Google Gemini API key (chatbot) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (voice) |

### 5. Initialize Database
```bash
npx prisma db push
npx prisma db seed
```

### 6. Initialize Actian VectorAI Collections
```bash
python services/actian_service.py setup
```

## Running the App

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## API Endpoints

### Core
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/auth/*` | NextAuth authentication |
| GET | `/api/wallet` | Wallet balance & transactions |
| GET/POST | `/api/claims` | Claims CRUD |
| GET/POST | `/api/review/*` | Review queue & voting |
| GET | `/api/rewards` | Marketplace items |
| POST | `/api/redeem` | Redeem credits |
| GET | `/api/lessons` | Education lessons |
| POST | `/api/quiz/[id]/attempt` | Quiz submission |

### Actian VectorAI DB (`/api/actian`)
| Method | Action | Description |
|---|---|---|
| GET | `?action=health` | Health check |
| GET | `?action=stats` | Collection stats |
| POST | `setup` | Create collections |
| POST | `upsert_product` | Insert marketplace item vector |
| POST | `search_marketplace` | K-NN product search |
| POST | `upsert_wallet` | Insert transaction vector |
| POST | `search_wallet` | K-NN transaction search |

### CRS – StitchCredit (`/api/crs`)
| Method | Action | Description |
|---|---|---|
| GET | `?action=score` | TransUnion credit score (default) |
| GET | `?action=score&bureau=experian` | Experian credit score |
| GET | `?action=score&bureau=equifax` | Equifax credit score |
| POST | `login` | Authenticate with CRS |
| POST | `credit` | Full credit report |
| POST | `flexid` | LexisNexis FlexID identity verification |
| POST | `fraud` | Fraud Finder check |
| POST | `criminal` | Criminal background |
| POST | `eviction` | Eviction history |

### OCR (`/api/ocr`)
| Method | Description |
|---|---|
| POST | Upload receipt image for green credit calculation |

---

## Demo Walkthrough

Use the following credentials to test the different roles:

**Users:**
- **Alice (User)**: `alice@example.com` / `Password123!`
- **Bob (Reviewer)**: `reviewer@example.com` / `Password123!`
- **Charlie (Admin)**: `admin@example.com` / `Password123!`

### Flow 1: Submit & Verify
1. **Login as Alice** (`alice@example.com`).
2. Go to **Submit Claim**.
3. Select "Bike to Campus", enter description "Rode 5 miles", upload a photo.
4. Click **Submit**. Status shows `PENDING`.
5. **Logout**, login as **Bob**, go to **Review Queue**, approve the claim.
6. **Logout**, login as **Charlie**, approve again (2 votes required).

### Flow 2: Check Credits
1. **Login as Alice**. Dashboard shows balance `15` credits (10 base × 1.5 Tier2).
2. Credit Score widget shows your score from StitchCredit CRS.

### Flow 3: Marketplace
1. Go to **Marketplace**. Browse items.
2. Try to redeem "Campus Café" (Cost 40). Should fail (insufficient funds).

### Flow 4: Education Multiplier
1. Go to **Learn** → "Carbon Footprint 101".
2. Take quiz (answers: Carbon Dioxide, Transportation, Yes).
3. Earn **1.2x multiplier** for future claims.

### Flow 5: Receipt OCR
1. Go to **Submit Claim** → upload a receipt image.
2. OCR extracts green items and calculates bonus credits.

### Flow 6: AI Chatbot
1. Click the chat icon on any page.
2. Ask about sustainability, your account, or green actions.

---

## Troubleshooting
- **DB connection fails**: Check Docker status or `DATABASE_URL` in `.env`.
- **Actian VectorAI not connecting**: Ensure `docker compose up -d` is running, check port 50051.
- **CRS returns mock data**: Verify `CRS_USERNAME` and `CRS_PASSWORD` in `.env`.
- **OCR fails**: Ensure Python venv is active and `easyocr` is installed.
- **Styling looks off**: Ensure `tailwind.config.ts` and `globals.css` are properly set up.
