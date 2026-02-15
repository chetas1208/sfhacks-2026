
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageProvider {
    uploadFile(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<string>;
}

class LocalStorageProvider implements StorageProvider {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async uploadFile(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<string> {
        const ext = path.extname(originalFilename);
        const filename = `${crypto.randomUUID()}${ext}`;
        const filePath = path.join(this.uploadDir, filename);

        await fs.promises.writeFile(filePath, fileBuffer);

        // Return public URL
        return `/uploads/${filename}`;
    }
}

// Singleton factory
let instance: StorageProvider | null = null;

export const getStorageService = (): StorageProvider => {
    if (!instance) {
        // In future, check env to switch to S3
        instance = new LocalStorageProvider();
    }
    return instance;
}
