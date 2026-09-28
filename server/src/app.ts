import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { apiRouter } from "./routes";

export const app = express();

// Di belakang satu proxy (Vercel atau nginx); dibutuhkan agar IP untuk rate limit dan riwayat benar.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

app.use(errorHandler);
