import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.test") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

process.env.NODE_ENV = process.env.NODE_ENV || "test";
if (!process.env.RATE_LIMIT_AUTH_MAX) process.env.RATE_LIMIT_AUTH_MAX = "5000";
if (!process.env.METRICS_TOKEN) process.env.METRICS_TOKEN = "test-metrics-token";
