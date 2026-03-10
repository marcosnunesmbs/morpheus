export interface IAudioAgent {
  /**
   * Transcribes an audio file on disk to text.
   * 
   * @param filePath - The absolute path of the audio file to transcribe.
   * @param mimeType - The MIME type of the audio file (e.g. 'audio/ogg').
   * @param apiKey - The Gemini API key to use for the transaction.
   * @returns A Promise resolving to the transcribed text string.
   * @throws Error if upload or transcription fails.
   */
  transcribe(filePath: string, mimeType: string, apiKey: string): Promise<string>;
}
