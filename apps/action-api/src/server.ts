import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./index";

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
