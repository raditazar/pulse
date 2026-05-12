import { handle } from "hono/vercel";
import { app } from "./hono-app";

export default handle(app);

