import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import expressRateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { envConfig } from './settings/environments.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { connectDb } from './settings/connectDb.ts';

const app = express();

app.use(
  expressRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.use(helmet());
app.use(morgan('dev'));

app.use('/api', authRouter);

app.listen(envConfig.PORT, async () => {
  console.log(`Server on port ${envConfig.PORT}`);
  connectDb(envConfig.MONGODB_URI).catch(_error => process.exit(1));
});

