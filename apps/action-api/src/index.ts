import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {cors} from "hono/cors"
import { sessions } from "./routes/sessions";
import { transactions } from "./routes/transactions";
import { merchants } from "./routes/merchants";

const app = new Hono();

app.use("/*", cors())

app.get("/", (c) =>
  c.json({
    name: "pulse-action-api",
    status: "ok",
    message: "Pulse backend is ready for session and split-payment routes.",
  }),
);

app.route("/sessions", sessions)
app.route("/transactions", transactions)
app.route("/merchants", merchants)

serve(
  {
    fetch: app.fetch,
    port: 3002,
  },
  (info) => {
    console.log(`Pulse Action API running on http://localhost:${info.port}`);
  },
);

