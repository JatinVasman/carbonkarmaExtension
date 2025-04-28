import { deflate, inflate } from 'pako';

class CompressionService {
    static async compressData(data) {
        try {
            const jsonString = JSON.stringify(data);
            const compressed = deflate(jsonString);
            return compressed;
        } catch (error) {
            console.error('Compression error:', error);
            return null;
        }
    }

    static async decompressData(compressed) {
        try {
            const decompressed = inflate(compressed, { to: 'string' });
            return JSON.parse(decompressed);
        } catch (error) {
            console.error('Decompression error:', error);
            return null;
        }
    }
}

export default CompressionService;