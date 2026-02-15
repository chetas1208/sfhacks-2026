import odbc from 'odbc';

// Interface matching our existing VectorStore
export interface VectorStore {
    storeVector(id: string, text: string, metadata: any): Promise<void>;
    searchSimilar(text: string, limit: number, filter?: any): Promise<any[]>;
}

export class ActianVectorStore implements VectorStore {
    private connectionString: string;
    private tableName = "claim_vectors";

    constructor() {
        // Connection string for Actian Vector (via ODBC)
        // Example: "Driver={Actian Vector};Host=localhost;Port=VW7;Database=my_db;Uid=actian;Pwd=password;"
        this.connectionString = process.env.ACTIAN_CONNECTION_STRING || "";
    }

    private async getConnection() {
        if (!this.connectionString) {
            throw new Error("ACTIAN_CONNECTION_STRING is not defined");
        }
        return odbc.connect(this.connectionString);
    }

    async init() {
        // Create table if not exists
        // Note: Vector type syntax depends on Actian version. using simplified schema.
        if (!this.connectionString) return;

        try {
            const conn = await this.getConnection();
            await conn.query(`
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
                id VARCHAR(64) PRIMARY KEY,
                content VARCHAR(2000),
                embedding VECTOR(1536), -- Assuming standard embedding size
                metadata VARCHAR(2000)
            )
        `);
            await conn.close();
        } catch (e) {
            console.error("Failed to init Actian table", e);
        }
    }

    async storeVector(id: string, text: string, metadata: any): Promise<void> {
        if (!this.connectionString) {
            console.warn("Mocking Actian storeVector (no connection string)");
            return;
        }

        try {
            // 1. Generate Embedding (Mocked here, normally call OpenAI/Gemini)
            // For MVP we just store the text. In real app, we need the vector array.
            const mockVector = "[0.1, 0.2, ...]";

            const conn = await this.getConnection();
            // Use parameterized query
            await conn.query(`INSERT INTO ${this.tableName} (id, content, embedding, metadata) VALUES (?, ?, ?, ?)`,
                [id, text, mockVector, JSON.stringify(metadata)]
            );
            await conn.close();
        } catch (e) {
            console.error("Actian storeVector error", e);
        }
    }

    async searchSimilar(text: string, limit: number, filter?: any): Promise<any[]> {
        if (!this.connectionString) {
            // Fallback to local stub behavior if no DB
            return [];
        }

        try {
            const conn = await this.getConnection();
            // Conceptual Vector Search Query
            // SELECT *, COSINE_SIMILARITY(embedding, ?) as score FROM table ORDER BY score DESC LIMIT ?
            // Syntax varies. 
            const query = `SELECT id, content, metadata FROM ${this.tableName} LIMIT ${limit}`;
            const result = await conn.query(query);
            await conn.close();

            return result.map((row: any) => ({
                id: row.id,
                content: row.content,
                metadata: JSON.parse(row.metadata),
                score: 0.9 // mocked score
            }));
        } catch (e) {
            console.error("Actian searchSimilar error", e);
            return [];
        }
    }
}
