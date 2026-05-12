import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default("https://pulse-web-lime.vercel.app"),
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

export function getPlatformUsdcTokenAccount() {
  return env.PLATFORM_USDC_TOKEN_ACCOUNT;
}
