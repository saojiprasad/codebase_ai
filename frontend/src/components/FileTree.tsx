import { ChevronRight, FileCode2, Folder } from "lucide-react";
import type { FileTreeNode } from "../types";

export function FileTree({ node, depth = 0 }: { node?: FileTreeNode; depth?: number }) {
  if (!node) return <p className="text-sm text-zinc-500">No file tree indexed yet.</p>;
  if (node.type === "file") {
    return (
      <div className="flex items-center gap-2 truncate py-1 text-sm text-zinc-400" style={{ paddingLeft: depth * 14 }}>
        <FileCode2 size={14} className="text-cyan" />
        <span className="truncate">{node.name}</span>
        {node.language ? <span className="ml-auto text-xs text-zinc-600">{node.language}</span> : null}
      </div>
    );
  }
  return (
    <div>
      {node.name !== "root" ? (
        <div className="flex items-center gap-2 py-1 text-sm text-zinc-300" style={{ paddingLeft: depth * 14 }}>
          <ChevronRight size={14} className="text-zinc-600" />
          <Folder size={14} className="text-amber" />
          {node.name}
        </div>
      ) : null}
      <div>
        {(node.children ?? []).slice(0, 250).map((child) => (
          <FileTree key={`${child.type}-${child.path ?? child.name}-${depth}`} node={child} depth={node.name === "root" ? depth : depth + 1} />
        ))}
      </div>
    </div>
  );
}

