import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { sessions } from "./routes/sessions";
import { transactions } from "./routes/transactions";
import { merchants } from "./routes/merchants";
import { terminals } from "./routes/terminals";
import { tap } from "./routes/tap";

export const app = new Hono();

app.use("/*", cors());

const health = {
  name: "pulse-action-api",
  status: "ok",
  message: "Pulse backend is ready for session and split-payment routes.",
};

app.get("/", (c) => c.json(health));

const api = app.basePath("/api");

api.get("/", (c) => c.json(health));

api.route("/sessions", sessions);
api.route("/transactions", transactions);
api.route("/merchants", merchants);
api.route("/terminals", terminals);
api.route("/tap", tap);

export default handle(app);

