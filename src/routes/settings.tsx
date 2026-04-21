import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Settings2, Key, Webhook, Cpu, Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "API Settings — Sentinel" },
      { name: "description", content: "Manage your API keys, webhooks, and blockchain settings." },
      { property: "og:title", content: "API Settings — Sentinel" },
      { property: "og:description", content: "Configure API access and on-chain integration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [show, setShow] = useState(false);
  const apiKey = "sk_live_x9f2_a8b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Settings2 size={12} /> Configuration
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            API & Integrations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wire Sentinel into your pipelines, mobile SDKs, and on-chain services.
          </p>
        </header>

        {/* API Key */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Key size={15} className="text-primary" />
            <h2 className="text-sm font-semibold">Production API Key</h2>
            <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/30">
              ACTIVE
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-black/40 border border-border px-3 py-2.5">
            <code className="flex-1 truncate text-xs font-mono text-primary">
              {show ? apiKey : "•".repeat(48)}
            </code>
            <button
              onClick={() => setShow((s) => !s)}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/5 text-muted-foreground"
            >
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(apiKey)}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/5 text-muted-foreground"
            >
              <Copy size={13} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Use this key with the Sentinel SDK to register signatures programmatically.
          </p>
        </section>

        {/* Webhook */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Webhook size={15} className="text-cyber" />
            <h2 className="text-sm font-semibold">Leak Webhook</h2>
          </div>
          <input
            defaultValue="https://api.your-app.com/sentinel/webhook"
            className="w-full rounded-lg bg-black/40 border border-border px-3 py-2.5 text-xs font-mono outline-none focus:border-primary/50"
          />
          <div className="mt-3 flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" defaultChecked className="accent-primary" />
              Notify on critical detections
            </label>
            <label className="flex items-center gap-2 text-xs ml-4">
              <input type="checkbox" className="accent-primary" />
              Notify on every match
            </label>
          </div>
        </section>

        {/* Blockchain */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={15} className="text-emerald" />
            <h2 className="text-sm font-semibold">On-Chain Anchoring</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Network" value="Polygon Mainnet" />
            <Field label="Contract" value="0x9f4e…b21c" mono />
            <Field label="Anchor frequency" value="Every signature" />
            <Field label="Average gas" value="$0.0008 / op" />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground font-mono">
            {/* TODO: Connect to Polygon/Smart Contract here */}
            // TODO: Connect to Polygon/Smart Contract here
          </p>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-black/30 border border-border px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono text-primary" : ""}`}>{value}</div>
    </div>
  );
}
