import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SendHorizontal } from "lucide-react";
import { api } from "../api/client";
import { ProjectPicker } from "../components/ProjectPicker";
import type { ChatCitation } from "../types";

type Message = { role: "user" | "assistant"; content: string; citations?: ChatCitation[] };

export function Chat() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !input.trim()) return;
    const question = input.trim();
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const response = await api.chat(projectId, question);
      setMessages((current) => [...current, { role: "assistant", content: response.answer, citations: response.citations }]);
    } catch (err) {
      setMessages((current) => [...current, { role: "assistant", content: err instanceof Error ? err.message : "Chat failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-40px)] grid-rows-[auto_1fr_auto] gap-4 py-6">
      <ProjectPicker currentId={projectId} />
      <div className="overflow-auto rounded-lg border border-line bg-panel p-4">
        {messages.length ? (
          <div className="grid gap-4">
            {messages.map((message, index) => (
              <article key={index} className={message.role === "user" ? "ml-auto max-w-3xl rounded-lg bg-zinc-100 p-4 text-ink" : "max-w-4xl rounded-lg border border-line bg-ink p-4"}>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{message.content}</pre>
                {message.citations?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {message.citations.slice(0, 6).map((citation) => (
                      <span key={`${citation.path}-${citation.start_line}`} className="rounded-md border border-cyan/25 bg-cyan/10 px-2 py-1 text-xs text-cyan">
                        {citation.path}:{citation.start_line}-{citation.end_line}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">Ask the repository</h1>
              <p className="mt-3 text-zinc-500">Try “How does authentication work?” or “Where are database queries?”</p>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-3">
        <input value={input} onChange={(event) => setInput(event.target.value)} className="input min-h-12 flex-1" placeholder="Ask about APIs, flows, bugs, tests, or architecture..." />
        <button disabled={!projectId || loading} className="inline-flex min-w-12 items-center justify-center rounded-lg bg-zinc-100 text-ink hover:bg-white disabled:opacity-50">
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}

