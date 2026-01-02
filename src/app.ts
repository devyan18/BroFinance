import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./settings/environments.ts";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));

app.listen(ENV.PORT, () => {
  console.log(`Server on port ${ENV.PORT}`);
});
