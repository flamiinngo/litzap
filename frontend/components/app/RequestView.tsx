"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAddress, parseUnits } from "viem";
import { useApp, TOKENS, DEFAULT_TOKEN } from "@/lib/store";
import { ZERO, isLive } from "@/lib/config";
import { resolveName, requestPayment } from "@/lib/onchain";
import { decimalInput } from "@/lib/num";
import { Icon } from "@/components/Icon";

const EXPLORER = "https://liteforge.explorer.caldera.xyz/tx/";

export function RequestView() {
  const { session } = useApp();
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenSym, setTokenSym] = useState(DEFAULT_TOKEN);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; hash?: string } | null>(null);

  const token = TOKENS.find((t) => t.symbol === tokenSym)!;
  const link = session ? `${typeof window !== "undefined" ? window.location.origin : "https://litzap.xyz"}/u/${session.username}` : "";

  async function submit() {
    setResult(null);
    const amt = parseFloat(amount);
    const v = from.trim();
    if (!v) return setResult({ ok: false, msg: "Who are you requesting from?" });
    if (!amt || amt <= 0) return setResult({ ok: false, msg: "Enter an amount." });
    if (!isLive) return setResult({ ok: false, msg: "On-chain contracts not configured." });

    setBusy(true);
    try {
      let payer: `0x${string}`;
      if (isAddress(v)) payer = v as `0x${string}`;
      else {
        const name = v.replace(/^@/, "").replace(/\.zap$/, "").toLowerCase();
        payer = await resolveName(name);
        if (!payer || payer === ZERO) throw new Error(`${name}.zap isn't on LitZap yet — share your pay link instead.`);
      }
      const hash = await requestPayment(payer, token.native ? ZERO : token.address, parseUnits(String(amt), token.decimals), note);
      setResult({ ok: true, msg: `Request sent to ${v}. They'll see it on their home screen.`, hash });
      setAmount("");
      setNote("");
    } catch (e) {
      const x = e as { shortMessage?: string; message?: string };
      setResult({ ok: false, msg: x.shortMessage || x.message || "Couldn't send the request." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-brand text-4xl font-semibold text-text">Request money</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Ask a ZapTag or address to pay you — it lands on their home screen, on-chain.</p>

      <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="name.zap or 0x address" className="field mb-4 px-5 py-3.5 text-sm" />

      <div className="flex items-center gap-2 rounded-full pr-2" style={{ background: "var(--field)" }}>
        <div className="flex flex-1 items-center px-5">
          <span className="font-display text-lg font-bold text-muted">{token.symbol === "USDC" ? "$" : ""}</span>
          <input value={amount} onChange={(e) => setAmount(decimalInput(e.target.value))} placeholder="0.00" inputMode="decimal" className="font-display w-full bg-transparent py-3.5 pl-1 text-lg font-bold outline-none" />
        </div>
        <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface-2)" }}>
          {TOKENS.map((t) => (
            <button key={t.symbol} onClick={() => setTokenSym(t.symbol)} className="rounded-full px-3 py-1.5 text-xs font-bold transition" style={{ background: t.symbol === tokenSym ? "var(--accent)" : "transparent", color: t.symbol === tokenSym ? "#fff" : "var(--muted)" }}>
              {t.symbol}
            </button>
          ))}
        </div>
      </div>

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's it for?" className="field mb-5 mt-4 px-5 py-3 text-sm" />

      <button onClick={submit} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base disabled:opacity-50">
        <Icon name="arrowDownLeft" size={18} strokeWidth={2} />
        {busy ? "Sending request…" : "Send request"}
      </button>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: result.ok ? "var(--accent-ring)" : "rgba(239,68,68,0.12)", color: result.ok ? "var(--text)" : "#ef4444" }}>
            <div>{result.msg}</div>
            {result.hash && <a href={`${EXPLORER}${result.hash}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent underline">View on explorer</a>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 rounded-2xl px-4 py-3 text-xs text-muted" style={{ background: "var(--surface-2)" }}>
        Requesting someone not on LitZap yet? Share your pay link instead:
        <button onClick={() => navigator.clipboard?.writeText(link)} className="mt-2 flex items-center gap-2 rounded-full px-4 py-2 text-[11px] text-muted hover:text-accent" style={{ background: "var(--field)" }}>
          <Icon name="copy" size={13} /> {link}
        </button>
      </div>
    </div>
  );
}
