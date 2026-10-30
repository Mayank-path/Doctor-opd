declare module 'multer' {
  export interface StorageEngine {
    _handleFile(
      req: any,
      file: any,
      cb: (error?: any, info?: any) => void,
    ): void;
    _removeFile(req: any, file: any, cb: (error: Error | null) => void): void;
  }

  export class MulterError extends Error {
    name: string;
    code: string;
    message: string;
    field?: string;
    constructor(code: string, field?: string);
  }

  export function memoryStorage(): StorageEngine;
  export function diskStorage(options: any): StorageEngine;

  interface MulterOptions {
    dest?: string;
    storage?: StorageEngine;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      parts?: number;
      headerPairs?: number;
    };
  }

  export default function multer(options?: MulterOptions): any;
}
