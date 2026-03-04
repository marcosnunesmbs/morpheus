import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

// ─── Hashing ─────────────────────────────────────────────────────────────────

/**
 * Calculate SHA-256 hash of file content.
 */
export function hashDocument(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate SHA-256 hash of a file by path.
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return hashDocument(content);
}

// ─── Chunking ───────────────────────────────────────────────────────────────

export interface ChunkResult {
  content: string;
  position: number;
  char_start: number;
  char_end: number;
}

/**
 * Split text into chunks respecting sentence boundaries.
 * @param text - The text to chunk
 * @param chunkSize - Target size in characters (default: 500)
 * @param minChunkSize - Minimum chunk size to avoid tiny chunks (default: 100)
 */
export function chunkText(text: string, chunkSize = 500, minChunkSize = 100): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let position = 0;
  let charPos = 0;

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let chunkStart = 0;

  for (const paragraph of paragraphs) {
    // If adding this paragraph exceeds chunk size
    if (currentChunk.length + paragraph.length + 2 > chunkSize && currentChunk.length >= minChunkSize) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        position: position++,
        char_start: chunkStart,
        char_end: chunkStart + currentChunk.length,
      });
      currentChunk = paragraph;
      chunkStart = charPos;
    } else if (paragraph.length > chunkSize) {
      // Paragraph is too long, split by sentences
      if (currentChunk.length > 0) {
        // Save current chunk first
        chunks.push({
          content: currentChunk.trim(),
          position: position++,
          char_start: chunkStart,
          char_end: chunkStart + currentChunk.length,
        });
        currentChunk = '';
      }

      const sentences = splitBySentences(paragraph);
      let sentenceChunk = '';
      let sentenceStart = charPos;

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length + 1 > chunkSize && sentenceChunk.length >= minChunkSize) {
          chunks.push({
            content: sentenceChunk.trim(),
            position: position++,
            char_start: sentenceStart,
            char_end: sentenceStart + sentenceChunk.length,
          });
          sentenceChunk = sentence;
          sentenceStart = charPos + (paragraph.indexOf(sentence) > 0 ? paragraph.indexOf(sentence) : 0);
        } else {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
        }
      }

      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
        chunkStart = sentenceStart;
      }
    } else {
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      if (!currentChunk) {
        chunkStart = charPos;
      }
    }

    charPos += paragraph.length + 2; // +2 for paragraph separator
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      position,
      char_start: chunkStart,
      char_end: chunkStart + currentChunk.length,
    });
  }

  return chunks;
}

/**
 * Split text by sentences using common sentence delimiters.
 */
function splitBySentences(text: string): string[] {
  // Match sentences ending with . ! ? followed by space or end of string
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s+|$)/g) || [text];
  return sentences.map(s => s.trim()).filter(Boolean);
}

// ─── Document Parsing ────────────────────────────────────────────────────────

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
  };
}

/**
 * Parse PDF file and extract text.
 */
export async function parsePDF(filePath: string): Promise<ParsedDocument> {
  const dataBuffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  const text = textResult.text || '';
  const infoResult = await parser.getInfo();

  return {
    text,
    metadata: {
      pageCount: infoResult.total,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Parse DOCX file and extract text.
 */
export async function parseDOCX(filePath: string): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Parse plain text file.
 */
export async function parseTXT(filePath: string): Promise<ParsedDocument> {
  const text = await fs.readFile(filePath, 'utf-8');

  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Parse Markdown file (treated as plain text for chunking).
 */
export async function parseMD(filePath: string): Promise<ParsedDocument> {
  return parseTXT(filePath);
}

// ─── Supported Formats ───────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

/**
 * Check if a file extension is supported.
 */
export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Get the content type based on file extension.
 */
export function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Parse a document based on its file extension.
 */
export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return parsePDF(filePath);
    case '.docx':
      return parseDOCX(filePath);
    case '.txt':
      return parseTXT(filePath);
    case '.md':
      return parseMD(filePath);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

/**
 * Process a document: parse, chunk, and return chunks with metadata.
 */
export async function processDocument(
  filePath: string,
  chunkSize = 500
): Promise<{
  text: string;
  chunks: ChunkResult[];
  hash: string;
  metadata: ParsedDocument['metadata'];
}> {
  // Parse document
  const parsed = await parseDocument(filePath);

  // Calculate hash
  const hash = hashDocument(parsed.text);

  // Chunk text
  const chunks = chunkText(parsed.text, chunkSize);

  return {
    text: parsed.text,
    chunks,
    hash,
    metadata: parsed.metadata,
  };
}