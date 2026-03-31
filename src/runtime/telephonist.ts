import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { OpenRouter } from '@openrouter/sdk';
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import os from 'os';
import { parseFile } from 'music-metadata';
import { AudioConfig, TtsConfig } from '../types/config.js';
import { UsageMetadata } from '../types/usage.js';

/**
 * Returns the actual audio duration in seconds by parsing the file header.
 * Falls back to a size-based estimate (~32 kbps) if parsing fails.
 */
async function getAudioDurationSeconds(filePath: string): Promise<number> {
  try {
    const metadata = await parseFile(filePath);
    const duration = metadata.format.duration;
    if (duration != null && duration > 0) return Math.round(duration);
  } catch {
    // fall through to estimate
  }
  try {
    const stats = fs.statSync(filePath);
    return Math.round(stats.size / 4000); // ~32 kbps fallback
  } catch {
    return 0;
  }
}

export interface AudioTranscriptionResult {
  text: string;
  usage: UsageMetadata;
}

export interface AudioSynthesisResult {
  /** Absolute path to the generated audio file. */
  filePath: string;
  /** MIME type of the audio file (e.g. 'audio/ogg', 'audio/mpeg', 'audio/wav'). */
  mimeType: string;
  usage: UsageMetadata;
}

export const TTS_MAX_CHARS = 4096;

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

  /**
   * Synthesizes text to speech and writes the result to a temp .ogg file.
   *
   * @param text - The text to synthesize.
   * @param apiKey - The API key for the configured TTS provider.
   * @param voice - Optional voice override.
   * @returns A Promise resolving to the result with filePath and usage.
   * @throws Error if synthesis fails.
   */
  synthesize?(text: string, apiKey: string, voice?: string, stylePrompt?: string): Promise<AudioSynthesisResult>;
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
      },
      audio_duration_seconds: await getAudioDurationSeconds(filePath)
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
      audio_duration_seconds: await getAudioDurationSeconds(filePath)
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
      audio_duration_seconds: await getAudioDurationSeconds(filePath)
    };

    return { text, usage: usageMetadata };
  }
}

/**
 * Factory function that creates the appropriate ITelephonist implementation
 * based on the audio provider configuration.
 *
 * Supported providers:
 * - gemini:     Google Gemini (native audio file upload)
 * - openai:     OpenAI Whisper API (/audio/transcriptions)
 * - openrouter: OpenRouter SDK with input_audio (multimodal models)
 * - ollama:     Ollama local Whisper via OpenAI-compatible endpoint
 */
export function createTelephonist(config: AudioConfig): ITelephonist {
  switch (config.provider) {
    case 'gemini':
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
      throw new Error(`Unsupported audio provider: '${(config as any).provider}'. Supported: gemini, openai, openrouter, ollama.`);
  }
}

// ─── TTS Implementations ─────────────────────────────────────────────────────

function truncateForTts(text: string): string {
  if (text.length <= TTS_MAX_CHARS) return text;
  console.warn(`[Telephonist] TTS input truncated from ${text.length} to ${TTS_MAX_CHARS} chars.`);
  return text.slice(0, TTS_MAX_CHARS);
}

function mimeTypeToExt(mimeType: string): string {
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('aac')) return '.aac';
  return '.audio';
}

async function writeTempAudio(buffer: Buffer, ext: string): Promise<string> {
  const filePath = path.join(os.tmpdir(), `morpheus-tts-${Date.now()}${ext}`);
  await fsExtra.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Wraps raw PCM data in a WAV container header.
 * Gemini TTS returns audio/pcm at 24000Hz, 16-bit, mono.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitDepth = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);         // PCM chunk size
  header.writeUInt16LE(1, 20);          // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

class OpenAITtsTelephonist implements ITelephonist {
  constructor(private readonly model: string, private readonly defaultVoice: string) {}

  async transcribe(): Promise<AudioTranscriptionResult> {
    throw new Error('OpenAITtsTelephonist does not support transcription.');
  }

  async synthesize(text: string, apiKey: string, voice?: string, stylePrompt?: string): Promise<AudioSynthesisResult> {
    const client = new OpenAI({ apiKey });
    const raw = stylePrompt ? `${stylePrompt}: ${text}` : text;
    const input = truncateForTts(raw);

    const response = await client.audio.speech.create({
      model: this.model,
      voice: (voice || this.defaultVoice) as any,
      input,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = await writeTempAudio(buffer, '.mp3');

    return {
      filePath,
      mimeType: 'audio/mpeg',
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        audio_duration_seconds: 0,
      },
    };
  }
}

class GeminiTtsTelephonist implements ITelephonist {
  constructor(private readonly model: string, private readonly defaultVoice: string) {}

  async transcribe(): Promise<AudioTranscriptionResult> {
    throw new Error('GeminiTtsTelephonist does not support transcription.');
  }

  async synthesize(text: string, apiKey: string, voice?: string, stylePrompt?: string): Promise<AudioSynthesisResult> {
    const ai = new GoogleGenAI({ apiKey });
    const raw = stylePrompt ? `${stylePrompt}: ${text}` : text;
    const input = truncateForTts(raw);

    const response = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: input }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || this.defaultVoice },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('audio/')
    );

    if (!audioPart?.inlineData?.data) {
      throw new Error('Gemini TTS: no audio data in response');
    }

    const rawMimeType: string = audioPart.inlineData.mimeType ?? 'audio/pcm';
    const rawBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    let mimeType = rawMimeType;
    let buffer: Buffer;

    // Gemini returns raw PCM — wrap it in a WAV container
    if (rawMimeType.includes('pcm') || rawMimeType.includes('l16')) {
      // Parse sample rate from mimeType params e.g. "audio/pcm;rate=24000"
      const rateMatch = rawMimeType.match(/rate=(\d+)/i);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      buffer = pcmToWav(rawBuffer, sampleRate);
      mimeType = 'audio/wav';
    } else {
      buffer = rawBuffer;
    }

    const ext = mimeTypeToExt(mimeType);
    const filePath = await writeTempAudio(buffer, ext);

    const usage = response.usageMetadata;
    return {
      filePath,
      mimeType,
      usage: {
        input_tokens: usage?.promptTokenCount ?? 0,
        output_tokens: usage?.candidatesTokenCount ?? 0,
        total_tokens: usage?.totalTokenCount ?? 0,
        audio_duration_seconds: 0,
      },
    };
  }
}

/**
 * Factory that creates an ITelephonist with TTS (synthesize) support.
 * Supports providers: openai, gemini.
 */
export function createTtsTelephonist(config: TtsConfig): ITelephonist {
  switch (config.provider) {
    case 'openai':
      return new OpenAITtsTelephonist(config.model, config.voice);
    case 'gemini':
      return new GeminiTtsTelephonist(config.model, config.voice);
    default:
      throw new Error(`Unsupported TTS provider: '${(config as any).provider}'. Supported: openai, gemini.`);
  }
}

// ─── Legacy export for backward compatibility ─────────────────────────────────

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
