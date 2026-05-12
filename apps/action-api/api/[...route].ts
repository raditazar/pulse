import { handle } from "hono/vercel";
import { app } from "../src/hono-app";

export default handle(app);
