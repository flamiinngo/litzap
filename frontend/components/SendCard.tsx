"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, useSwitchChain } from "wagmi";
import { readContract } from "wagmi/actions";
import { keccak256, toHex, parseEther, isAddress } from "viem";
import { wagmiConfig, CONTRACTS, NATIVE, ZERO, isLive, litvm } from "@/lib/config";
import { payAbi, registryAbi } from "@/lib/abi";
import { decimalInput } from "@/lib/num";
import { Icon, type IconName } from "./Icon";
import type { Mood } from "./Zapster";

type Result = { kind: "ok" | "err"; msg: string; claimLink?: string };

function Toggle({
  on,
  set,
  icon,
  title,
  sub,
}: {
  on: boolean;
  set: (v: boolean) => void;
  icon: IconName;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={() => set(!on)}
      className="flex flex-1 items-center gap-3 rounded-full px-4 py-3 text-left transition"
      style={{
        background: on ? "var(--accent-ring)" : "var(--field)",
        boxShadow: on ? "0 0 0 1.5px var(--accent)" : "none",
      }}
    >
      <span style={{ color: on ? "var(--accent)" : "var(--muted)" }}>
        <Icon name={icon} size={18} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-text">{title}</span>
        <span className="block text-[11px] text-muted">{sub}</span>
      </span>
      <span
        className="ml-auto h-5 w-9 rounded-full p-0.5 transition"
        style={{ background: on ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="block h-4 w-4 rounded-full transition"
          style={{ background: "var(--surface)", transform: on ? "translateX(16px)" : "none" }}
        />
      </span>
    </button>
  );
}

export function SendCard({ onMood }: { onMood: (m: Mood) => void }) {
  const { isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [boomerang, setBoomerang] = useState(false);
  const [ghost, setGhost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const claimMode = boomerang || ghost;

  async function resolveRecipient(): Promise<`0x${string}`> {
    const v = to.trim();
    if (v.startsWith("@")) {
      const name = v.slice(1).toLowerCase();
      const addr = (await readContract(wagmiConfig, {
        address: CONTRACTS.registry,
        abi: registryAbi,
        functionName: "resolve",
        args: [name],
      })) as `0x${string}`;
      if (!addr || addr === ZERO)
        throw new Error(`@${name} isn't on LitZap yet — use Boomerang to send anyway.`);
      return addr;
    }
    if (isAddress(v)) return v as `0x${string}`;
    throw new Error("Enter a @username or a 0x address.");
  }

  function newSecret() {
    const b = crypto.getRandomValues(new Uint8Array(32));
    const secret = toHex(b);
    return { secret, hash: keccak256(secret) };
  }

  async function onZap() {
    setResult(null);
    let amt: bigint;
    try {
      amt = parseEther((amount || "0").trim());
    } catch {
      setResult({ kind: "err", msg: "That amount looks off." });
      return;
    }
    if (amt <= 0n) {
      setResult({ kind: "err", msg: "Enter an amount to send." });
      return;
    }

    onMood(ghost ? "ghost" : "idle");
    setBusy(true);
    try {
      if (!isLive) {
        await new Promise((r) => setTimeout(r, 700));
        onMood("zap");
        const demo = newSecret();
        setResult({
          kind: "ok",
          msg: claimMode
            ? "Demo Boomerang created. Deploy LitZapPay and set NEXT_PUBLIC_PAY to go live."
            : "Demo payment sent. Deploy LitZapPay and set NEXT_PUBLIC_PAY to go live.",
          claimLink: claimMode ? `${location.origin}/claim#${demo.secret.slice(0, 22)}…` : undefined,
        });
        return;
      }

      if (!isConnected) throw new Error("Connect your wallet first.");

      // External wallets may be on Ethereum mainnet — force LitVM (4441) before signing.
      if (chainId !== litvm.id) await switchChainAsync({ chainId: litvm.id });

      if (claimMode) {
        const { secret, hash } = newSecret();
        const expiry = BigInt(Math.floor(Date.now() / 1000) + 24 * 3600);
        await writeContractAsync({
          chainId: litvm.id,
          address: CONTRACTS.pay,
          abi: payAbi,
          functionName: "createClaim",
          args: [NATIVE, amt, expiry, hash],
          value: amt,
        });
        onMood("zap");
        setResult({
          kind: "ok",
          msg: ghost
            ? "Private send complete. Recipient unlinked — full MWEB amount-shielding activates once LitVM's endpoint is live."
            : "Sent. Share the claim link — it auto-returns in 24h if unclaimed.",
          claimLink: `${location.origin}/claim#${secret}`,
        });
      } else {
        const dest = await resolveRecipient();
        await writeContractAsync({
          chainId: litvm.id,
          address: CONTRACTS.pay,
          abi: payAbi,
          functionName: "pay",
          args: [dest, NATIVE, amt, note],
          value: amt,
        });
        onMood("zap");
        setResult({ kind: "ok", msg: "Payment sent." });
      }
    } catch (e: unknown) {
      onMood("broke");
      const msg =
        (e as { shortMessage?: string })?.shortMessage ||
        (e as Error)?.message ||
        "Something went wrong.";
      setResult({ kind: "err", msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex h-full w-full flex-col p-6 md:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-extrabold text-text">Send money</h2>
          <p className="text-xs text-muted">A @username, an address, or anyone — across any chain.</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent"
          style={{ background: "var(--accent-ring)" }}
        >
          LitVM · 4441
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={claimMode ? "opacity-40 transition" : "transition"}>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">To</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="@username or 0x…"
            disabled={claimMode}
            className="field px-4 py-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Amount (LTC)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(decimalInput(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
            className="field font-display px-4 py-3 text-lg font-bold"
          />
        </div>
      </div>

      <label className="mb-1.5 mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted">Note</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's it for?"
        className="field px-4 py-2.5 text-sm"
      />

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Toggle on={boomerang} set={setBoomerang} icon="clock" title="Boomerang" sub="Send to anyone · auto-returns 24h" />
        <Toggle on={ghost} set={setGhost} icon="shield" title="Ghost Mode" sub="Private · MWEB-ready" />
      </div>

      <div className="mt-auto pt-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onZap}
          disabled={busy}
          className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base"
        >
          <Icon name={ghost ? "shield" : "send"} size={18} strokeWidth={2} />
          {busy ? "Sending…" : ghost ? "Send privately" : "Send"}
        </motion.button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm"
            style={{
              background: result.kind === "ok" ? "var(--accent-ring)" : "rgba(239,68,68,0.12)",
              color: result.kind === "ok" ? "var(--text)" : "#ef4444",
            }}
          >
            <div className="flex items-start gap-2">
              {result.kind === "ok" && (
                <span className="mt-0.5 text-accent">
                  <Icon name="check" size={16} strokeWidth={2.4} />
                </span>
              )}
              <span>{result.msg}</span>
            </div>
            {result.claimLink && (
              <button
                onClick={() => navigator.clipboard?.writeText(result.claimLink!)}
                className="flex items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-[11px] text-muted hover:text-accent"
                style={{ background: "var(--field)" }}
                title="Copy claim link"
              >
                <Icon name="copy" size={13} />
                <span className="truncate">{result.claimLink}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
