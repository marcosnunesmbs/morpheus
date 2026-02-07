import { pipeline } from '@xenova/transformers';

export class EmbeddingService {
  private static instance: EmbeddingService;
  private extractor: any;

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
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}
