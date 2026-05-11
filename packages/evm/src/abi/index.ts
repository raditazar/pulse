import MockUSDC from "./MockUSDC.json" with { type: "json" };
import PulseSender from "./PulseSender.json" with { type: "json" };

export const MockUSDCAbi = MockUSDC;
export const PulseSenderAbi = PulseSender;

export type AbiOf<T> = T;
