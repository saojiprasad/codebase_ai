import { ArrowRight, Bot, Braces, Network, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";

export function Landing() {
  return (
    <div className="grid min-h-[calc(100vh-40px)] content-center gap-10 py-8">
      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-sm text-cyan">
            <Bot size={16} />
            Local-first AI architect for real repositories
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-normal text-zinc-50 sm:text-6xl">
            AI Codebase Explainer
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
            Upload a ZIP, clone a GitHub repo, or scan a local folder. The platform maps architecture, APIs, dependencies, bugs, diagrams, documentation, and grounded AI chat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/upload" className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-ink hover:bg-white">
              Analyze a project
              <ArrowRight size={17} />
            </Link>
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-3 text-sm text-zinc-300 hover:border-cyan hover:text-cyan">
              Open dashboard
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-line bg-ink p-4 font-mono text-sm text-zinc-300">
            <div className="text-mint">repo.scan()</div>
            <div className="mt-2 text-zinc-500">detect stack, parse AST, index chunks</div>
            <div className="mt-4 text-cyan">rag.chat("How does auth work?")</div>
            <div className="mt-2 text-zinc-500">answers cite exact files and lines</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Graph" value={<Network />} detail="Imports, APIs, services" accent="cyan" />
            <MetricCard label="Security" value={<ShieldCheck />} detail="Risk detection" accent="mint" />
            <MetricCard label="Docs" value={<Braces />} detail="README generation" accent="amber" />
          </div>
        </div>
      </section>
    </div>
  );
}
