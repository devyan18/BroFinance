declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        // Memory storage: buffer is populated, disk fields are absent
        buffer: Buffer;
        // Disk storage only
        destination?: string;
        filename?: string;
        path?: string;
      }
    }
    interface Request {
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

export {};
