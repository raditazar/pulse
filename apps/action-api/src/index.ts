import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {cors} from "hono/cors"
import { sessions } from "./routes/sessions";
import { transactions } from "./routes/transactions";
import { merchants } from "./routes/merchants";

const app = new Hono();

app.use("/*", cors())

const api = app.basePath("/api")

api.get("/", (c) =>
  c.json({
    name: "pulse-action-api",
    status: "ok",
    message: "Pulse backend is ready for session and split-payment routes.",
  }),
);

api.route("/sessions", sessions)
api.route("/transactions", transactions)
api.route("/merchants", merchants)

const PORT = Number(process.env.PORT ?? 8000);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Pulse Action API running on http://localhost:${info.port}`);
    console.log(`Endpoints available at http://localhost:${info.port}/api`);
  },
);

