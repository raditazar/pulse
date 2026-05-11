import type { Context } from "hono";
import type { z } from "zod";

export function parseJsonBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T
): Promise<z.infer<T> | Response> {
  return c.req
    .json()
    .then((body) => {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            error: "Invalid request body",
            issues: parsed.error.flatten(),
          },
          400
        );
      }

      return parsed.data;
    })
    .catch(() => c.json({ error: "Invalid or missing JSON payload" }, 400));
}

export function bigintToString(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return String(value);
  return value;
}
