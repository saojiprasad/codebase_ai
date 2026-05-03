import { Cpu, Database, HardDrive, ServerCog } from "lucide-react";
import type { ReactNode } from "react";

export function Settings() {
  return (
    <div className="grid gap-6 py-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">Local AI</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Runtime settings</h1>
        <p className="mt-4 max-w-3xl text-zinc-400">
          Configure these values in the backend `.env` file on the machine where you run the platform.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SettingCard icon={<Cpu />} title="LLM provider" value="ACE_LLM_PROVIDER=ollama" />
        <SettingCard icon={<ServerCog />} title="Ollama model" value="ACE_OLLAMA_MODEL=qwen2.5-coder:7b" />
        <SettingCard icon={<Database />} title="Vector backend" value="ACE_VECTOR_BACKEND=chroma" />
        <SettingCard icon={<HardDrive />} title="Embedding model" value="ACE_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5" />
      </div>
      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Recommended local models</h2>
        <div className="mt-4 grid gap-2 text-sm text-zinc-400">
          <code>ollama pull qwen2.5-coder:7b</code>
          <code>ollama pull deepseek-coder:6.7b</code>
          <code>ollama pull codellama:7b</code>
          <code>ollama pull phi3:mini</code>
          <code>ACE_LLM_PROVIDER=llamacpp ACE_LLAMA_CPP_BASE_URL=http://localhost:8080</code>
        </div>
      </section>
    </div>
  );
}

function SettingCard({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return (
    <article className="rounded-lg border border-line bg-panel p-5">
      <div className="mb-4 text-cyan">{icon}</div>
      <div className="text-sm text-zinc-500">{title}</div>
      <code className="mt-2 block text-sm text-zinc-200">{value}</code>
    </article>
  );
}
