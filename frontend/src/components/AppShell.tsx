import { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { Bot, Braces, Bug, FileText, GitBranch, Home, Network, Settings, UploadCloud } from "lucide-react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/upload", label: "Upload", icon: UploadCloud },
  { to: "/dashboard", label: "Dashboard", icon: Braces },
  { to: "/chat", label: "Chat", icon: Bot },
  { to: "/architecture", label: "Architecture", icon: Network },
  { to: "/api", label: "API", icon: GitBranch },
  { to: "/bugs", label: "Bugs", icon: Bug },
  { to: "/readme", label: "README", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-ink text-zinc-100">
      <div className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-panel/90 px-4 py-5 backdrop-blur xl:block">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan/50 bg-cyan/10 text-cyan">
            <Braces size={21} />
          </div>
          <div>
            <div className="text-sm font-semibold">Codebase Explainer</div>
            <div className="text-xs text-zinc-500">Local AI architect</div>
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? "bg-zinc-100 text-ink" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <main className="xl:pl-64">
        <div className="sticky top-0 z-20 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur xl:hidden">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan/50 bg-cyan/10 text-cyan">
              <Braces size={19} />
            </div>
            <div className="text-sm font-semibold">Codebase Explainer</div>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    isActive ? "border-cyan bg-cyan/10 text-cyan" : "border-line text-zinc-400"
                  }`
                }
              >
                <item.icon size={16} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
