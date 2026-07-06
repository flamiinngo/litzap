"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseUnits, formatUnits } from "viem";
import { useBalance } from "wagmi";
import { TOKENS, DEFAULT_TOKEN } from "@/lib/store";
import { useEmbeddedWallet } from "@/lib/wallet";
import { ZERO, CONTRACTS, isLive } from "@/lib/config";
import { createDropOnchain, getDropOnchain, type DropInfo } from "@/lib/onchain";
import { decimalInput, integerInput } from "@/lib/num";
import { Icon } from "@/components/Icon";

const DROP_HOURS = 72;
const LS = "litzap.mydrops";
const makeCode = () => {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
};
const tokenBySym = (s: string) => TOKENS.find((t) => t.symbol === s)!;
const tokenMeta = (addr: string) => TOKENS.find((t) => (t.native && addr === ZERO) || t.address.toLowerCase() === addr.toLowerCase());

export function DropsView() {
  const address = useEmbeddedWallet();
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("");
  const [split, setSplit] = useState<"lucky" | "equal">("lucky");
  const [tokenSym, setTokenSym] = useState(DEFAULT_TOKEN);
  const [note, setNote] = useState("");
  const [origin, setOrigin] = useState("https://litzap.xyz");
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState<{ code: string; note?: string; info?: DropInfo | null }[]>([]);

  const token = tokenBySym(tokenSym);
  const { data: bal } = useBalance({ address, token: token.native ? undefined : token.address, query: { enabled: !!address && (token.native || token.address !== ZERO), refetchInterval: 8000 } });
  const balNum = bal ? +bal.formatted : 0;
  const balText = token.symbol === "USDC" ? `$${balNum.toFixed(2)}` : `${balNum.toFixed(4)} ${token.symbol}`;

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  // load my created drops and refresh their on-chain status
  useEffect(() => {
    let codes: { code: string; note?: string }[] = [];
    try { codes = JSON.parse(localStorage.getItem(LS) || "[]"); } catch {}
    if (codes.length === 0) return;
    (async () => {
      const withInfo = await Promise.all(codes.map(async (c) => ({ ...c, info: await getDropOnchain(c.code) })));
      setMine(withInfo);
    })();
  }, [created]);

  async function make() {
    setErr("");
    const t = parseFloat(total);
    const c = parseInt(count, 10);
    if (!t || t <= 0 || !c || c <= 0) return setErr("Enter an amount and how many people.");
    if (t > balNum) return setErr(`You only have ${balText}.`);
    if (!isLive || CONTRACTS.drops === ZERO) return setErr("Drops aren't configured on-chain yet.");

    setBusy(true);
    try {
      const code = makeCode();
      const expiry = BigInt(Math.floor(Date.now() / 1000) + DROP_HOURS * 3600);
      await createDropOnchain({
        code, token: token.address, native: token.native,
        amount: parseUnits(String(t), token.decimals), count: c, lucky: split === "lucky", expiry,
      });
      try {
        const prev = JSON.parse(localStorage.getItem(LS) || "[]");
        localStorage.setItem(LS, JSON.stringify([{ code, note }, ...prev]));
      } catch {}
      setCreated(code);
      setTotal(""); setCount(""); setNote("");
    } catch (e) {
      const x = e as { shortMessage?: string; message?: string };
      setErr(x.shortMessage || x.message || "Couldn't create the drop.");
    } finally {
      setBusy(false);
    }
  }

  const link = (code: string) => `${origin}/drop/${code}`;

  return (
    <div className="max-w-xl">
      <h1 className="font-brand text-4xl font-semibold text-text">Zapster Drops</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Drop a pot of money to a group — everyone grabs a share, on-chain. Post the link anywhere.</p>

      <div className="panel p-6">
        {/* amount + token toggle */}
        <div className="flex items-center gap-2 rounded-full pr-2" style={{ background: "var(--field)" }}>
          <div className="flex flex-1 items-center px-5">
            <span className="font-display text-lg font-bold text-muted">{token.symbol === "USDC" ? "$" : ""}</span>
            <input value={total} onChange={(e) => setTotal(decimalInput(e.target.value))} placeholder="total" inputMode="decimal" className="font-display w-full bg-transparent py-3.5 pl-1 text-lg font-bold outline-none" />
          </div>
          <div className="flex gap-1 rounded-full p-1" style={{ background: "var(--surface-2)" }}>
            {TOKENS.map((t) => (
              <button key={t.symbol} onClick={() => setTokenSym(t.symbol)} className="rounded-full px-3 py-1.5 text-xs font-bold transition" style={{ background: t.symbol === tokenSym ? "var(--accent)" : "transparent", color: t.symbol === tokenSym ? "#fff" : "var(--muted)" }}>
                {t.symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 mt-2 px-2 text-xs text-muted">Balance: <span className="font-semibold">{balText}</span></div>

        <div className="flex items-center rounded-full px-5" style={{ background: "var(--field)" }}>
          <input value={count} onChange={(e) => setCount(integerInput(e.target.value))} placeholder="how many people" inputMode="numeric" className="w-full bg-transparent py-3.5 text-sm outline-none" />
        </div>

        <div className="mt-3 flex gap-2">
          {(["lucky", "equal"] as const).map((s) => (
            <button key={s} onClick={() => setSplit(s)} className="flex-1 rounded-full px-4 py-2.5 text-xs font-semibold transition" style={{ background: split === s ? "var(--accent-ring)" : "var(--field)", color: split === s ? "var(--accent)" : "var(--muted)" }}>
              {s === "lucky" ? "Lucky (random shares)" : "Equal split"}
            </button>
          ))}
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Message (e.g. happy friday!)" className="field mt-3 px-5 py-3 text-sm" />

        <button onClick={make} disabled={busy} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-4 text-base disabled:opacity-50">
          <Icon name="bolt" size={18} strokeWidth={2} /> {busy ? "Creating on-chain…" : "Create drop"}
        </button>

        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}

        <AnimatePresence>
          {created && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl px-4 py-3 text-sm text-text" style={{ background: "var(--accent-ring)" }}>
              Drop is live on-chain. Share this so people can grab their share:
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("I dropped some money on LitZap — grab your share:")}&url=${encodeURIComponent(link(created))}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] text-muted hover:text-accent" style={{ background: "var(--field)" }}>
                  <Icon name="x" size={13} /> Share on X
                </a>
                <button onClick={() => navigator.clipboard?.writeText(link(created))} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] text-muted hover:text-accent" style={{ background: "var(--field)" }}>
                  <Icon name="copy" size={13} /> Copy link
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mine.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.16em] text-muted">Your drops</h2>
          <div className="space-y-2">
            {mine.map((d) => {
              const tm = d.info ? tokenMeta(d.info.token) : undefined;
              const totalTxt = d.info && tm ? `${tm.symbol === "USDC" ? "$" : ""}${(+formatUnits(d.info.total, tm.decimals)).toFixed(tm.symbol === "USDC" ? 2 : 4)}` : "";
              return (
                <div key={d.code} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text">{d.note || `Drop ${d.code}`}</div>
                    <div className="text-[11px] text-muted">
                      {d.info ? `${d.info.claimed}/${d.info.count} grabbed · ${totalTxt} total` : "loading…"}
                    </div>
                  </div>
                  <button onClick={() => navigator.clipboard?.writeText(link(d.code))} className="ml-2 text-muted hover:text-accent" title="Copy link">
                    <Icon name="copy" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
