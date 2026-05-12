import { z } from "zod";

const productionAppUrl = "https://pulse-web-lime.vercel.app";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default(productionAppUrl),
  USDC_MINT: z.string().min(32),
  PLATFORM_USDC_TOKEN_ACCOUNT: z.string().min(32),
  PULSE_PAYMENT_PROGRAM_ID: z
    .string()
    .min(32)
    .default("Gh2NP3fBQfdARCkTerXx8vzgEY1yFhH5ApM8v79rj8d2"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SOLANA_COMMITMENT: z.enum(["confirmed", "finalized"]).default("confirmed"),
  SOLANA_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);

export const publicAppUrl = normalizePublicAppUrl(env.NEXT_PUBLIC_APP_URL);

export function getPlatformUsdcTokenAccount() {
  return env.PLATFORM_USDC_TOKEN_ACCOUNT;
}

function normalizePublicAppUrl(value: string) {
  const trimmed = value.trim();
  const shouldUseProduction =
    process.env.VERCEL === "1" &&
    /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed);
  const appUrl = shouldUseProduction ? productionAppUrl : trimmed;
  const withProtocol =
    /^[a-z][a-z\d+\-.]*:\/\//i.test(appUrl) || appUrl.startsWith("/")
      ? appUrl
      : `https://${appUrl}`;
  return withProtocol.replace(/\/$/, "");
}
