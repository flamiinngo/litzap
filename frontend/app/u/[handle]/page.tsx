"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { MotionBackground } from "@/components/MotionBackground";
import { Zapster } from "@/components/Zapster";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { decimalInput } from "@/lib/num";

export default function PayHandlePage() {
  const params = useParams();
  const handle = String(params?.handle ?? "");
  const tag = `${handle}.zap`;

  const { session, send } = useApp();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);

  function pay() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (session) {
      send({ to: tag, amount: amt, token: "USDC", note });
      setDone(true);
    }
  }

  return (
    <div className="relative min-h-screen">
      <MotionBackground />
      <header className="mx-auto flex max-w-md items-center justify-between px-5 py-5">
        <Link href="/"><Logo /></Link>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-5 pt-6 text-center">
        <Zapster mood={done ? "success" : "idle"} size={180} />
        <h1 className="font-brand mt-2 text-3xl font-semibold text-text">
          Pay <span className="gradient-text italic">{tag}</span>
        </h1>

        {done ? (
          <div className="panel mt-6 w-full p-6">
            <p className="text-text">Sent ${amount} to {tag}.</p>
            <Link href="/" className="btn-primary mt-4 inline-block px-6 py-3 text-sm">Open LitZap</Link>
          </div>
        ) : (
          <div className="panel mt-6 w-full p-6">
            <div className="flex items-center rounded-full px-5" style={{ background: "var(--field)" }}>
              <span className="font-display text-lg font-bold text-muted">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(decimalInput(e.target.value))}
                placeholder="0.00"
                inputMode="decimal"
                className="font-display w-full bg-transparent py-3.5 pl-2 text-lg font-bold outline-none"
              />
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note"
              className="field mt-3 px-5 py-3 text-sm"
            />
            {session ? (
              <button onClick={pay} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-4 text-base">
                <Icon name="send" size={18} strokeWidth={2} /> Pay {tag}
              </button>
            ) : (
              <Link href="/#start" className="btn-primary mt-4 block py-4 text-base">
                Sign in to pay
              </Link>
            )}
            <p className="mt-3 text-xs text-muted">No account? Create one in 60 seconds — no seed phrase.</p>
          </div>
        )}
      </main>
    </div>
  );
}
