"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAddress, parseUnits } from "viem";
import { useBalance } from "wagmi";
import { useApp, TOKENS, DEFAULT_TOKEN } from "@/lib/store";
import { ZERO, isLive, CONTRACTS } from "@/lib/config";
import { useEmbeddedWallet } from "@/lib/wallet";
import { payNative, payErc20, resolveName, createSocialEscrow } from "@/lib/onchain";
import { recipientKey, type SocialKind } from "@/lib/social";
import { decimalInput } from "@/lib/num";
import { Icon, type IconName } from "@/components/Icon";
import { Zapster, type Mood } from "@/components/Zapster";
import { ScanModal } from "./ScanModal";

type Kind = "tag" | "email" | "x" | "discord";
const TABS: { kind: Kind; label: string; icon: IconName; placeholder: string }[] = [
  { kind: "tag", label: "ZapTag / address", icon: "at", placeholder: "name.zap or 0x address" },
  { kind: "email", label: "Email", icon: "mail", placeholder: "their@email.com" },
  { kind: "x", label: "X", icon: "x", placeholder: "@handle on X" },
  { kind: "discord", label: "Discord", icon: "discord", placeholder: "their Discord username" },
];
const EXPLORER = "https://liteforge.explorer.caldera.xyz/tx/";
const CLAIM_HOURS = 24;

export function SendView() {
  const { addTx } = useApp();
  const address = useEmbeddedWallet();
  const [kind, setKind] = useState<Kind>("tag");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenSym, setTokenSym] = useState(DEFAULT_TOKEN);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<Mood>("idle");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; hash?: string } | null>(null);

  const token = TOKENS.find((t) => t.symbol === tokenSym)!;
  const tab = TABS.find((t) => t.kind === kind)!;
  const isSocial = kind !== "tag";

  // live on-chain balance of the selected token
  const { data: bal } = useBalance({
    address,
    token: token.native ? undefined : token.address,
    query: { enabled: !!address && (token.native || token.address !== ZERO), refetchInterval: 8000 },
  });
  const balNum = bal ? +bal.formatted : 0;
  const balText = token.symbol === "USDC" ? `$${balNum.toFixed(2)}` : `${balNum.toFixed(4)} ${token.symbol}`;
  const amtNum = parseFloat(amount) || 0;
  const overBalance = amtNum > balNum;

  function handleScan(text: string) {
    setScanning(false);
    // a LitZap QR encodes a pay link like https://litzap.xyz/u/<handle>
    let val = text.trim();
    const m = val.match(/\/u\/([a-z0-9_]+)/i);
    if (m) val = m[1];
    setKind("tag");
    setTo(val);
    setResult(null);
  }

  async function submit() {
    setResult(null);
    if (!to.trim()) return setResult({ ok: false, msg: "Who are you paying?" });
    if (!amtNum || amtNum <= 0) return setResult({ ok: false, msg: "Enter an amount." });
    if (overBalance) return setResult({ ok: false, msg: `You only have ${balText} to send.` });
    if (!isLive) return setResult({ ok: false, msg: "On-chain contracts not configured." });
    if (!token.native && token.address === ZERO) return setResult({ ok: false, msg: `${token.symbol} address not configured.` });
    if (isSocial && CONTRACTS.escrow === ZERO) return setResult({ ok: false, msg: "Pay-by-social isn't configured yet." });

    setMood("idle");
    setBusy(true);
    try {
      const units = parseUnits(String(amtNum), token.decimals);

      if (!isSocial) {
        const v = to.trim();
        let dest: `0x${string}`;
        if (isAddress(v)) dest = v as `0x${string}`;
        else {
          const name = v.replace(/^@/, "").replace(/\.zap$/, "").toLowerCase();
          dest = await resolveName(name);
          if (!dest || dest === ZERO) throw new Error(`${name}.zap isn't registered yet.`);
        }
        const hash = token.native
          ? await payNative(dest, String(amtNum), note)
          : await payErc20(token.address, dest, units, note);
        addTx({ dir: "out", party: v, amount: amtNum, token: token.symbol, note, hash });
        setMood("zap");
        setResult({ ok: true, msg: `Sent ${amtNum} ${token.symbol} to ${v}.`, hash });
      } else {
        const handle = to.trim().replace(/^@/, "").toLowerCase();
        const key = recipientKey(kind as SocialKind, handle);
        const expiry = BigInt(Math.floor(Date.now() / 1000) + CLAIM_HOURS * 3600);
        const { hash } = await createSocialEscrow({
          token: token.address,
          native: token.native,
          amount: units,
          recipientKey: key,
          expiry,
          note,
        });
        addTx({ dir: "out", party: `${kind}:${handle}`, amount: amtNum, token: token.symbol, note, hash });
        setMood("zap");
        setResult({
          ok: true,
          msg: `Locked ${amtNum} ${token.symbol} for ${handle} on ${tab.label}. They claim it after verifying ${tab.label} — auto-refunds to you in ${CLAIM_HOURS}h if unclaimed.`,
          hash,
        });
      }

      setTo("");
      setAmount("");
      setNote("");
    } catch (e: unknown) {
      setMood("broke");
      setResult({ ok: false, msg: (e as { shortMessage?: string })?.shortMessage || (e as Error)?.message || "Transaction failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_300px]">
      <div>
        <h1 className="font-brand text-4xl font-semibold text-text">Send money</h1>
        <p className="mb-6 mt-1 text-sm text-muted">Real on-chain payments on LitVM — to a ZapTag, an address, or someone's X / Discord.</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.kind} onClick={() => { setKind(t.kind); setResult(null); }} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition" style={{ background: kind === t.kind ? "var(--accent-ring)" : "var(--field)", color: kind === t.kind ? "var(--accent)" : "var(--muted)" }}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-full pr-2" style={{ background: "var(--field)" }}>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={tab.placeholder} className="w-full bg-transparent px-5 py-3.5 text-sm outline-none" />
          <button type="button" onClick={() => setScanning(true)} title="Scan to pay" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
            <Icon name="scan" size={18} />
          </button>
        </div>

        {/* amount + token */}
        <div className="flex items-center gap-2 rounded-full pr-2" style={{ background: "var(--field)" }}>
          <div className="flex flex-1 items-center px-5">
            <span className="font-display text-lg font-bold text-muted">{token.symbol === "USDC" ? "$" : ""}</span>
            <input value={amount} onChange={(e) => setAmount(decimalInput(e.target.value))} placeholder="0.00" inputMode="decimal" className="font-display w-full bg-transparent py-3.5 pl-1 text-lg font-bold outline-none" />
          </div>

          {/* styled token picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition"
              style={{ background: "var(--surface-2)", color: "var(--text)" }}
            >
              {token.symbol}
              <Icon name="arrowRight" size={13} className="rotate-90 opacity-60" />
            </button>
            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl p-1.5"
                  style={{ background: "var(--surface)", boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}
                >
                  {TOKENS.map((t) => (
                    <button
                      key={t.symbol}
                      onClick={() => { setTokenSym(t.symbol); setPickerOpen(false); setResult(null); }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition hover:opacity-90"
                      style={{ background: t.symbol === tokenSym ? "var(--accent-ring)" : "transparent", color: "var(--text)" }}
                    >
                      <span className="font-bold">{t.symbol}</span>
                      <span className="text-xs text-muted">{t.name}</span>
                      {t.symbol === tokenSym && <Icon name="check" size={14} className="ml-auto text-accent" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* live balance + max */}
        <div className="mb-4 mt-2 flex items-center justify-between px-2 text-xs">
          <span className={overBalance ? "text-red-400" : "text-muted"}>
            Balance: <span className="font-semibold">{balText}</span>
          </span>
          <button
            type="button"
            onClick={() => balNum > 0 && setAmount(String(balNum))}
            className="font-semibold text-accent disabled:opacity-40"
            disabled={balNum <= 0}
          >
            Max
          </button>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" className="field mb-4 px-5 py-3 text-sm" />

        {isSocial && (
          <div className="mb-4 rounded-2xl px-4 py-3 text-xs text-muted" style={{ background: "var(--surface-2)" }}>
            They don't need an account yet. Your money is locked safely on-chain and released only to the verified owner of <b>{tab.label}</b> — or returned to you after {CLAIM_HOURS} hours.
          </div>
        )}

        <button onClick={submit} disabled={busy || overBalance} className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base disabled:opacity-50">
          <Icon name="send" size={18} strokeWidth={2} />
          {busy ? (isSocial ? "Locking on-chain…" : "Sending on-chain…") : isSocial ? `Send to ${tab.label}` : "Send"}
        </button>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ background: result.ok ? "var(--accent-ring)" : "rgba(239,68,68,0.12)", color: result.ok ? "var(--text)" : "#ef4444" }}>
              <div>{result.msg}</div>
              {result.hash && (
                <a href={`${EXPLORER}${result.hash}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-accent underline">
                  View on explorer
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="hidden items-start justify-center md:flex">
        <Zapster mood={mood} size={220} />
      </div>

      {scanning && <ScanModal onResult={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
