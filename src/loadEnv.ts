/**
 * Load .env.local before any other modules read process.env.
 * Must be imported first in app.ts.
 */
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(process.cwd(), '.env.local') });
