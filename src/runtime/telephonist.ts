import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { OpenRouter } from '@openrouter/sdk';
import fs from 'fs';
import { AudioConfig } from '../types/config.js';
import { UsageMetadata } from '../types/usage.js';

export interface AudioTranscriptionResult {
  text: string;
  usage: UsageMetadata;
}

export interface ITelephonist {
  /**
   * Transcribes an audio file on disk to text.
   *
   * @param filePath - The absolute path of the audio file to transcribe.
   * @param mimeType - The MIME type of the audio file (e.g. 'audio/ogg').
   * @param apiKey - The API key for the configured provider.
   * @returns A Promise resolving to result with text and usage.
   * @throws Error if upload or transcription fails.
   */
  transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult>;
}

class GeminiTelephonist implements ITelephonist {
  constructor(private readonly model: string) {}

  async transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    const ai = new GoogleGenAI({ apiKey });

    const uploadResult = await ai.files.upload({
      file: filePath,
      config: { mimeType }
    });

    const response = await ai.models.generateContent({
      model: this.model,
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

    const text = response.text;
    if (!text) {
      throw new Error('No transcription generated');
    }

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
  }
}

/**
 * Uses OpenAI Whisper API (/audio/transcriptions).
 * Also used for Ollama local Whisper via OpenAI-compatible endpoint.
 */
class WhisperTelephonist implements ITelephonist {
  constructor(
    private readonly model: string,
    private readonly baseURL?: string
  ) {}

  async transcribe(filePath: string, _mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    const client = new OpenAI({
      apiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {})
    });

    const transcription = await client.audio.transcriptions.create({
      model: this.model,
      file: fs.createReadStream(filePath),
    });

    const text = transcription.text;
    if (!text) {
      throw new Error('No transcription generated');
    }

    // Whisper API does not return token usage
    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    return { text, usage: usageMetadata };
  }
}

/**
 * Uses OpenRouter SDK with input_audio content type.
 * Supports any multimodal model on OpenRouter that accepts audio input
 * (e.g. google/gemini-2.5-flash, openai/gpt-4o-audio-preview).
 */
class OpenRouterTelephonist implements ITelephonist {
  constructor(private readonly model: string) {}

  async transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    const client = new OpenRouter({ apiKey });

    // Derive audio format from mimeType (e.g. 'audio/ogg' → 'ogg')
    const format = mimeType.split('/')[1]?.split(';')[0] || 'ogg';

    const audioBuffer = fs.readFileSync(filePath);
    const base64Audio = audioBuffer.toString('base64');

    const result = await client.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcribe this audio message accurately. Return only the transcribed text without any additional commentary.',
              },
              {
                type: 'input_audio',
                inputAudio: {
                  data: base64Audio,
                  format: format as any,
                },
              },
            ],
          },
        ],
        stream: false,
      },
    });

    const message = (result as any)?.choices?.[0]?.message;
    const text = typeof message?.content === 'string'
      ? message.content
      : message?.content?.[0]?.text ?? '';

    if (!text) {
      throw new Error('No transcription generated');
    }

    const usage = (result as any)?.usage;
    const usageMetadata: UsageMetadata = {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
    };

    return { text, usage: usageMetadata };
  }
}

/**
 * Factory function that creates the appropriate ITelephonist implementation
 * based on the audio provider configuration.
 *
 * Supported providers:
 * - google:     Google Gemini (native audio file upload)
 * - openai:     OpenAI Whisper API (/audio/transcriptions)
 * - openrouter: OpenRouter SDK with input_audio (multimodal models)
 * - ollama:     Ollama local Whisper via OpenAI-compatible endpoint
 */
export function createTelephonist(config: AudioConfig): ITelephonist {
  switch (config.provider) {
    case 'google':
      return new GeminiTelephonist(config.model);
    case 'openai':
      return new WhisperTelephonist(config.model);
    case 'openrouter':
      return new OpenRouterTelephonist(config.model);
    case 'ollama':
      // Ollama exposes an OpenAI-compatible /v1/audio/transcriptions endpoint
      // Requires a Whisper model loaded: `ollama pull whisper`
      return new WhisperTelephonist(
        config.model,
        (config.base_url || 'http://localhost:11434') + '/v1'
      );
    default:
      throw new Error(`Unsupported audio provider: '${(config as any).provider}'. Supported: google, openai, openrouter, ollama.`);
  }
}

// Legacy export for backward compatibility
export class Telephonist implements ITelephonist {
  private delegate: ITelephonist;

  constructor() {
    this.delegate = new GeminiTelephonist('gemini-2.5-flash-lite');
  }

  async transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult> {
    return this.delegate.transcribe(filePath, mimeType, apiKey);
  }
}
