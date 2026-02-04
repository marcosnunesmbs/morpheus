import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SatiRepository } from '../repository.js';
import fs from 'fs-extra';
import path from 'path';

describe('SatiRepository', () => {
    const dbPath = path.join(process.cwd(), 'test-memory.db');
    let repo: SatiRepository;

    beforeEach(() => {
        // Reset singleton instance for testing
        (SatiRepository as any).instance = null;
        repo = SatiRepository.getInstance(dbPath);
        repo.initialize();
    });

    afterEach(() => {
        try {
            repo.close();
        } catch(e) {}
        
        if (fs.existsSync(dbPath)) {
            try {
                fs.unlinkSync(dbPath);
                fs.rmdirSync(path.dirname(dbPath)); // cleanup dir if possible/empty
            } catch(e) {}
        }
    });

    it('should save and retrieve memory', async () => {
        const mem = {
            category: 'preference' as any,
            importance: 'high' as any,
            summary: 'Test Memory',
            hash: '123',
            source: 'test'
        };
        
        await repo.save(mem);
        const result = repo.findByHash('123');
        expect(result).not.toBeNull();
        expect(result?.summary).toBe('Test Memory');
    });

    it('should deduplicate (update) on hash collision', async () => {
        const mem1 = {
            category: 'preference' as any,
            importance: 'medium' as any,
            summary: 'Test Memory v1',
            hash: 'abc',
            source: 'test'
        };
        await repo.save(mem1);

        const mem2 = {
            category: 'preference' as any,
            importance: 'high' as any,
            summary: 'Test Memory v2', // Summary logic might not update summary field in my query
            // Let's check my query in repository.ts:
            // ON CONFLICT(hash) DO UPDATE SET importance..., details... but NOT summary.
            // If hash is same, summary implies same content usually.
            // But here I test that fields ARE updated.
            hash: 'abc', 
            source: 'test',
            details: 'updated details'
        };
        await repo.save(mem2);

        const result = repo.findByHash('abc');
        expect(result).not.toBeNull();
        expect(result?.importance).toBe('high');
        expect(result?.details).toBe('updated details');
        
        // Since my query did not update summary (it assumed hash=summary match), summary should stay v1.
        expect(result?.summary).toBe('Test Memory v1');
        
        // Access count should increment
        expect(result?.access_count).toBeGreaterThan(0);
    });
});
