import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private extractor: any;

  private readonly MAX_CACHE_SIZE = 256;
  private cache = new Map<string, number[]>(); // text prefix -> embedding

  private constructor() {}

  static async getInstance(): Promise<EmbeddingService> {
    if (!EmbeddingService.instance) {
      const service = new EmbeddingService();

      service.extractor = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );

      EmbeddingService.instance = service;
    }

    return EmbeddingService.instance;
  }

  async generate(text: string): Promise<number[]> {
    const cacheKey = text.slice(0, 200);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    const embedding = Array.from(output.data) as number[];

    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      // Evict oldest entry (FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, embedding);

    return embedding;
  }
}
