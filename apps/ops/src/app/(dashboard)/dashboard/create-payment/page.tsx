"use client";

import { useEffect, useState } from "react";
import type { PulseSessionRecord } from "@pulse/types";
import {
  cancelSession,
  createMerchantSession,
  getMerchantSessions,
  type MerchantTerminal,
} from "@/lib/api";
import { useMerchant } from "@/components/dashboard/MerchantProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  ConfirmDialog,
  CtaButton,
  FieldLabel,
  Panel,
  PanelHeading,
} from "@/components/dashboard/primitives";
import { formatTime, shortAddress } from "@/lib/dashboard-data";

const createPaymentDefaults = {
  amount: "3.13",
  description: "Counter payment",
};

export default function CreatePaymentPage() {
  const { merchant } = useMerchant();
  const [amount, setAmount] = useState(createPaymentDefaults.amount);
  const [description, setDescription] = useState(createPaymentDefaults.description);
  const [createdSession, setCreatedSession] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<MerchantTerminal | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingSessions, setPendingSessions] = useState<PulseSessionRecord[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [cancellingSessionId, setCancellingSessionId] = useState<string | null>(null);
  const d = createPaymentDefaults;

  const loadPendingSessions = () => {
    if (!merchant) return;

    setPendingError(null);
    getMerchantSessions(merchant.id, 10)
      .then((sessions) => {
        setPendingSessions(
          sessions.filter((session) => session.status === "pending" || session.status === "submitted"),
        );
      })
      .catch((error) => {
        setPendingError(error instanceof Error ? error.message : "Failed to load pending sessions");
      });
  };

  useEffect(() => {
    loadPendingSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant?.id]);

  const normalizeAmount = () => {
    const raw = amount.replace(/[^0-9.]/g, "");
    const parsed = Number(raw || "0");
    return parsed.toFixed(2);
  };

  const handleCreateSession = async () => {
    if (!merchant) {
      setStatusMessage("Merchant account not found. Please log in again.");
      setConfirmOpen(false);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const created = await createMerchantSession(merchant.id, {
        amountUsdc: normalizeAmount(),
        sourceChain: "solana",
      });
      setCreatedSession(created.checkoutUrl);
      setTerminal(created.terminal);
      setStatusMessage(`Session created for ${(Number(created.amountUsdcUnits) / 1_000_000).toFixed(2)} USDC`);
      loadPendingSessions();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to create session");
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleCopySession = async () => {
    if (!createdSession) return;
    await navigator.clipboard?.writeText(createdSession);
  };

  const handleCancelSession = async (session: PulseSessionRecord) => {
    setCancellingSessionId(session.id);
    setPendingError(null);
    try {
      await cancelSession(session.id);
      setPendingSessions((current) => current.filter((item) => item.id !== session.id));
      if (terminal?.currentSessionId === session.id) {
        setTerminal((current) => current ? { ...current, currentSessionId: null } : current);
      }
      setStatusMessage(`Cancelled ${session.amountUsdc} USDC pending transaction.`);
      loadPendingSessions();
    } catch (error) {
      setPendingError(error instanceof Error ? error.message : "Failed to cancel transaction");
    } finally {
      setCancellingSessionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Create Payment"
        subtitle="Enter an amount and bind the latest payment session to your cashier NFC."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading title="Payment Details" sub="The created session is served through your account's single cashier NFC chip." />

          <div className="flex flex-col gap-3.5">
            <div>
              <FieldLabel>Amount (USDC)</FieldLabel>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[22px] font-extrabold text-text outline-none focus:border-purple"
                aria-label="Payment amount in USDC"
              />
            </div>

            <div>
              <FieldLabel>Description (Optional)</FieldLabel>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text outline-none focus:border-purple"
                aria-label="Payment description"
              />
            </div>

            <div className="rounded-control border border-border bg-bg-soft p-3">
              <div className="text-[11px] font-semibold text-muted">Cashier NFC Chip</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-text">
                    {terminal?.label ?? "Cashier Counter"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    NFC #{terminal?.nfcCode ?? "created on first session"}
                  </div>
                </div>
                <span className="rounded-pill bg-lavender px-2 py-1 text-[10px] font-bold text-purple">
                  {terminal?.currentSessionId ? "Linked" : "Ready"}
                </span>
              </div>
            </div>

            <CtaButton className="mt-2" onClick={() => setConfirmOpen(true)} disabled={isSubmitting}>
              Create Payment Session
            </CtaButton>

            {createdSession && (
              <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px] text-muted">
                <div className="font-bold text-text">Session ready</div>
                <div className="mt-1 num break-all text-[11px]">
                  {createdSession} · {normalizeAmount()} USDC · {description || d.description} ·{" "}
                  {terminal?.label ?? "Cashier Counter"}
                </div>
                <button
                  type="button"
                  onClick={handleCopySession}
                  className="focus-ring mt-2 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-purple"
                >
                  Copy Session Link
                </button>
              </div>
            )}

            {statusMessage && (
              <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px] text-muted">
                {statusMessage}
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel className="bg-bg-soft">
            <PanelHeading title="Notes" sub="A few important details about payment sessions." />
            <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
              <li>Sessions remain active for 15 minutes after creation.</li>
              <li>Your cashier NFC always opens the latest active session.</li>
              <li>Payments are signed directly in the customer wallet.</li>
              <li>On-chain settlement usually completes in 1-2 seconds.</li>
            </ul>
          </Panel>

          <Panel>
            <PanelHeading title="Pending Transactions" sub="Open sessions waiting for customer payment." />
            {pendingError ? (
              <div className="rounded-[10px] border border-border bg-bg-soft p-3 text-[12px] font-semibold text-muted">
                {pendingError}
              </div>
            ) : pendingSessions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {pendingSessions.map((session) => (
                  <PendingSessionRow
                    key={session.id}
                    session={session}
                    isCancelling={cancellingSessionId === session.id}
                    onCancel={() => handleCancelSession(session)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-border bg-bg-soft p-3 text-[12px] font-semibold text-muted">
                No pending transactions.
              </div>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Create this payment session?"
        description="Your cashier NFC will open this latest payment session for the next customer tap."
        confirmLabel={isSubmitting ? "Creating..." : "Create Session"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleCreateSession}
      >
        <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Amount</span>
            <span className="num font-extrabold text-text">{normalizeAmount()} USDC</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted">Cashier NFC</span>
            <span className="truncate font-bold text-text">
              {terminal?.label ?? shortAddress(merchant?.merchantPda)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted">Description</span>
            <span className="truncate font-bold text-text">{description || d.description}</span>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function PendingSessionRow({
  session,
  isCancelling,
  onCancel,
}: {
  session: PulseSessionRecord;
  isCancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-bg-soft p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {session.status}
          </div>
          <div className="mt-1 num text-[15px] font-extrabold text-text">
            {session.amountUsdc} USDC
          </div>
        </div>
        <div className="text-right text-[11px] font-semibold text-muted">
          {formatTime(session.createdAt ?? session.expiresAt)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="num min-w-0 truncate text-[10px] text-muted">
          {shortAddress(session.sessionPda)}
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCancelling}
          className="focus-ring shrink-0 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[10px] font-bold text-[var(--color-error)] hover:border-[var(--color-error)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCancelling ? "Cancelling..." : "Cancel"}
        </button>
      </div>
    </div>
  );
}
