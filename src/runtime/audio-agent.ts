import { GoogleGenAI } from '@google/genai';
import { UsageMetadata } from '../types/usage.js';

export interface AudioTranscriptionResult {
  text: string;
  usage: UsageMetadata;
}

export interface IAudioAgent {
  /**
   * Transcribes an audio file on disk to text.
   * 
   * @param filePath - The absolute path of the audio file to transcribe.
   * @param mimeType - The MIME type of the audio file (e.g. 'audio/ogg').
   * @param apiKey - The Gemini API key to use for the transaction.
   * @returns A Promise resolving to result with text and usage.
   * @throws Error if upload or transcription fails.
   */
  transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult>;
}

export class AudioAgent implements IAudioAgent {
  async transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    try {
      const ai = new GoogleGenAI({ apiKey });

      // Upload the file
      const uploadResult = await ai.files.upload({
        file: filePath,
        config: { mimeType }
      });

      // Generate content (transcription)
      // using gemini-1.5-flash as it is fast and supports audio
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              { 
                fileData: { 
                  fileUri: uploadResult.uri, 
                  mimeType: uploadResult.mimeType 
                } 
              },
              { text: "Transcribe this audio message accurately. Return only the transcribed text without any additional commentary." }
            ]
          }
        ]
      });

      // The new SDK returns text directly on the response object
      const text = response.text;
      if (!text) {
        throw new Error('No transcription generated');
      }

      // Extract usage metadata
      const usage = response.usageMetadata;
      
      const usageMetadata: UsageMetadata = {
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
        total_tokens: usage?.totalTokenCount ?? 0,
        input_token_details: {
            cache_read: usage?.cachedContentTokenCount ?? 0
        }
      };

      return { text, usage: usageMetadata };
    } catch (error) {
      // Wrap error for clarity
      if (error instanceof Error) {
        throw new Error(`Audio transcription failed: ${error.message}`);
      }
      throw error;
    }
  }
}
