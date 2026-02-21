// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      /**
       * Usuario autenticado.
       * Se adjunta por el middleware authenticate con userId del JWT.
       */
      user?: {
        userId: string;
        accessToken?: string;
      };
    }
  }
}
