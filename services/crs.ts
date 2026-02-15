import axios from 'axios';

// ─────────────────────────────────────────────────────────
// CRS (StitchCredit) Sandbox Integration
// Source: sfhacks2026-20260214-CRS-Sandbox.json (Postman)
// Base URL: https://api-sandbox.stitchcredit.com:443/api
// ─────────────────────────────────────────────────────────

const BASE_URL = "https://api-sandbox.stitchcredit.com:443/api";

// Credentials from Postman collection  (User Login request body)
const CRS_USERNAME = process.env.CRS_USERNAME || "sfhacks_dev38";
const CRS_PASSWORD = process.env.CRS_PASSWORD || "IA$PjtdDuosOvv!tV8O9X5VQ";

export class CrsService {
    private static token: string | null = null;
    private static refreshToken: string | null = null;
    private static tokenExpiry: number = 0;

    // ── 1. Authentication ──────────────────────────────────
    // POST /api/users/login
    // Returns: { id, token, refreshToken, expires, ... }
    static async login(): Promise<string> {
        // Re-use cached token if still valid
        if (this.token && Date.now() < this.tokenExpiry) {
            return this.token;
        }

        try {
            const res = await axios.post(`${BASE_URL}/users/login`, {
                username: CRS_USERNAME,
                password: CRS_PASSWORD,
            }, {
                headers: { "Content-Type": "application/json", Accept: "application/json" },
            });

            const data = res.data;
            this.token = data.token;
            this.refreshToken = data.refreshToken;
            // `expires` is seconds until expiry (e.g. 3600)
            this.tokenExpiry = Date.now() + (data.expires ?? 3600) * 1000 - 60_000; // 1 min buffer
            return this.token!;
        } catch (err: any) {
            console.error("CRS login failed:", err.response?.data || err.message);
            // Return a sentinel so callers can detect demo mode
            return "__MOCK__";
        }
    }

    // POST /api/users/refresh-token
    static async refreshSession(): Promise<string> {
        if (!this.refreshToken) return this.login();

        try {
            const res = await axios.post(`${BASE_URL}/users/refresh-token`, {
                refreshToken: this.refreshToken,
            }, {
                headers: { "Content-Type": "application/json", Accept: "application/json" },
            });
            this.token = res.data.token;
            this.refreshToken = res.data.refreshToken;
            this.tokenExpiry = Date.now() + (res.data.expires ?? 3600) * 1000 - 60_000;
            return this.token!;
        } catch {
            return this.login(); // fallback to full login
        }
    }

    // GET /api/users  (user details)
    static async getUserDetails() {
        const token = await this.login();
        if (token === "__MOCK__") return { name: "Demo User", email: "demo@gecb.app" };

        const res = await axios.get(`${BASE_URL}/users`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        return res.data;
    }

    // ── 2. Consumer Credit Report ──────────────────────────
    // TransUnion  –  tu-prequal-vantage4
    // POST /api/transunion/credit-report/standard/tu-prequal-vantage4
    static async getTransUnionCreditReport(identity: any) {
        const token = await this.login();
        const body = buildCreditBody(identity);

        if (token === "__MOCK__") return mockCreditScore("TransUnion");

        try {
            const res = await axios.post(
                `${BASE_URL}/transunion/credit-report/standard/tu-prequal-vantage4`,
                body,
                { headers: authHeaders(token) },
            );
            return { raw: res.data, requestId: res.headers["requestid"], provider: "TransUnion" };
        } catch (err: any) {
            console.error("TU credit report error:", err.response?.data || err.message);
            return mockCreditScore("TransUnion");
        }
    }

    // Experian  –  exp-prequal-vantage4
    // POST /api/experian/credit-profile/credit-report/standard/exp-prequal-vantage4
    static async getExperianCreditReport(identity: any) {
        const token = await this.login();
        const body = buildCreditBody(identity);

        if (token === "__MOCK__") return mockCreditScore("Experian");

        try {
            const res = await axios.post(
                `${BASE_URL}/experian/credit-profile/credit-report/standard/exp-prequal-vantage4`,
                body,
                { headers: authHeaders(token) },
            );
            return { raw: res.data, requestId: res.headers["requestid"], provider: "Experian" };
        } catch (err: any) {
            console.error("EXP credit report error:", err.response?.data || err.message);
            return mockCreditScore("Experian");
        }
    }

    // Equifax  –  efx-prequal-vantage4
    // POST /api/equifax/credit-report/standard/efx-prequal-vantage4
    static async getEquifaxCreditReport(identity: any) {
        const token = await this.login();
        const body = buildCreditBody(identity);

        if (token === "__MOCK__") return mockCreditScore("Equifax");

        try {
            const res = await axios.post(
                `${BASE_URL}/equifax/credit-report/standard/efx-prequal-vantage4`,
                body,
                { headers: authHeaders(token) },
            );
            return { raw: res.data, requestId: res.headers["requestid"], provider: "Equifax" };
        } catch (err: any) {
            console.error("EFX credit report error:", err.response?.data || err.message);
            return mockCreditScore("Equifax");
        }
    }

    // ── 3. Identity Verification (LexisNexis FlexID) ──────
    // POST /api/flex-id/flex-id
    static async verifyIdentity(identity: any) {
        const token = await this.login();

        const body = {
            firstName: identity.firstName || "NATALIE",
            lastName: identity.lastName || "KORZEC",
            ssn: identity.ssn || "7537",
            dateOfBirth: identity.dob || "1940-12-23",
            streetAddress: identity.address || "801 E OGDEN 1011",
            city: identity.city || "VAUGHN",
            state: identity.state || "WA",
            zipCode: identity.zip || "98394",
            homePhone: identity.phone || "5031234567",
        };

        if (token === "__MOCK__") return { verified: true, source: "mock" };

        try {
            const res = await axios.post(`${BASE_URL}/flex-id/flex-id`, body, {
                headers: authHeaders(token),
            });
            return { raw: res.data, requestId: res.headers["requestid"], verified: true };
        } catch (err: any) {
            console.error("FlexID error:", err.response?.data || err.message);
            return { verified: false, error: err.response?.data || err.message };
        }
    }

    // ── 4. Fraud Finder ────────────────────────────────────
    // POST /api/fraud-finder/fraud-finder
    static async checkFraud(identity: any) {
        const token = await this.login();

        const body = {
            firstName: identity.firstName || "John",
            lastName: identity.lastName || "Doe",
            phoneNumber: identity.phone || "1234929999",
            email: identity.email || "example@atdata.com",
            ipAddress: identity.ip || "47.25.65.96",
            address: {
                addressLine1: identity.address || "15900 SPACE CN",
                city: identity.city || "HOUSTON",
                state: identity.state || "TX",
                postalCode: identity.zip || "77062",
            },
        };

        if (token === "__MOCK__") return { status: "CLEAR", riskScore: 10 };

        try {
            const res = await axios.post(`${BASE_URL}/fraud-finder/fraud-finder`, body, {
                headers: authHeaders(token),
            });
            return { raw: res.data, requestId: res.headers["requestid"] };
        } catch (err: any) {
            console.error("Fraud Finder error:", err.response?.data || err.message);
            return { status: "ERROR", message: err.response?.data || err.message };
        }
    }

    // ── 5. Criminal / Eviction Reports ─────────────────────
    // POST /api/criminal/new-request
    static async getCriminalReport(identity: any) {
        const token = await this.login();
        const body = buildCicBody(identity);
        if (token === "__MOCK__") return { status: "mock" };

        try {
            const res = await axios.post(`${BASE_URL}/criminal/new-request`, body, {
                headers: authHeaders(token),
            });
            return { raw: res.data, requestId: res.headers["requestid"] };
        } catch (err: any) {
            console.error("Criminal report error:", err.response?.data || err.message);
            return { status: "error", message: err.message };
        }
    }

    // POST /api/eviction/new-request
    static async getEvictionReport(identity: any) {
        const token = await this.login();
        const body = buildCicBody(identity);
        if (token === "__MOCK__") return { status: "mock" };

        try {
            const res = await axios.post(`${BASE_URL}/eviction/new-request`, body, {
                headers: authHeaders(token),
            });
            return { raw: res.data, requestId: res.headers["requestid"] };
        } catch (err: any) {
            console.error("Eviction report error:", err.response?.data || err.message);
            return { status: "error", message: err.message };
        }
    }

    // ── 6. Utility: Logs & Retention ───────────────────────
    // GET /api/users/logs?page=0&size=200
    static async getLogs(page = 0, size = 200) {
        const token = await this.login();
        if (token === "__MOCK__") return [];

        const res = await axios.get(`${BASE_URL}/users/logs?page=${page}&size=${size}`, {
            headers: authHeaders(token),
        });
        return res.data;
    }

    // GET /api/users/retention/{RequestID}
    static async getRetention(requestId: string) {
        const token = await this.login();
        if (token === "__MOCK__") return {};

        const res = await axios.get(`${BASE_URL}/users/retention/${requestId}`, {
            headers: { ...authHeaders(token), Accept: "application/json" },
        });
        return res.data;
    }
}

// ── Helpers ────────────────────────────────────────────────

function authHeaders(token: string) {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}

function buildCreditBody(id: any) {
    return {
        firstName: id.firstName || "BARBARA",
        middleName: id.middleName || "M",
        lastName: id.lastName || "DOTY",
        suffix: "",
        birthDate: id.dob || "1966-01-04",
        ssn: id.ssn || "000000000",
        addresses: [
            {
                borrowerResidencyType: "Current",
                addressLine1: id.address || "1100 LYNHURST LN",
                addressLine2: "",
                city: id.city || "DENTON",
                state: id.state || "TX",
                postalCode: id.zip || "762058006",
            },
        ],
    };
}

function buildCicBody(id: any) {
    return {
        reference: "gecb-ref",
        subjectInfo: {
            last: id.lastName || "Consumer",
            first: id.firstName || "Jonathan",
            middle: "",
            dob: id.dob || "01-01-1982",
            ssn: id.ssn || "666-44-3321",
            houseNumber: id.houseNumber || "1803",
            streetName: id.street || "Norma",
            city: id.city || "Cottonwood",
            state: id.state || "CA",
            zip: id.zip || "91502",
        },
    };
}

function mockCreditScore(provider: string) {
    return {
        score: 720,
        rating: "Excellent",
        provider: `${provider} (Sandbox Mock)`,
        date: new Date().toISOString(),
    };
}
