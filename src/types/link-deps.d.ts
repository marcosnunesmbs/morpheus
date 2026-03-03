declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    version: string;
  }

  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;

  export default pdfParse;
}

declare module 'mammoth' {
  interface MammothResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface MammothOptions {
    buffer?: Buffer;
    path?: string;
  }

  function extractRawText(options: MammothOptions): Promise<MammothResult>;

  export { extractRawText };
}
