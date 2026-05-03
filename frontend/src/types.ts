export type Project = {
  id: string;
  name: string;
  root_path: string;
  source_type: string;
  status: "queued" | "running" | "ready" | "failed" | string;
  metadata: Record<string, unknown>;
  scan_result: ScanResult;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: string;
  project_id: string;
  kind: string;
  status: string;
  phase: string;
  progress: number;
  message: string;
  error?: string | null;
};

export type ScanResult = {
  file_count?: number;
  folder_count?: number;
  skipped_files?: number;
  total_size_bytes?: number;
  languages?: Record<string, number>;
  tree?: FileTreeNode;
  tech_stack?: TechStack;
  knowledge_graph?: KnowledgeGraph;
  api_map?: ApiMap;
  database_map?: DatabaseMap;
  bugs?: BugReport;
  improvements?: ImprovementReport;
  diagrams?: Record<string, string>;
  embedding_count?: number;
  generated_readme?: string;
};

export type TechStack = {
  detected?: string[];
  languages?: Record<string, number>;
  manifests?: Array<{ path: string; kind: string }>;
  dependencies?: string[];
  summary?: string;
};

export type KnowledgeGraph = {
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  stats?: { nodes: number; edges: number; cycles: number };
};

export type ApiMap = {
  count?: number;
  endpoints?: ApiEndpoint[];
};

export type ApiEndpoint = {
  path: string;
  methods: string[];
  handler_file: string;
  line?: number;
  auth_hint?: string;
  request_hint?: string;
  response_hint?: string;
};

export type BugReport = {
  score?: number;
  summary?: Record<string, number>;
  issues?: Issue[];
};

export type DatabaseMap = {
  tables?: Array<{ name: string; file: string; line: number }>;
  relationships?: Array<{ from_column: string; to_table: string; file: string; line: number }>;
  orm_usage?: Record<string, string[]>;
  summary?: string;
};

export type ImprovementReport = {
  suggestions?: Array<{ severity: string; category: string; recommendation: string }>;
};

export type Issue = {
  severity: "Critical" | "High" | "Medium" | "Low";
  category: string;
  title: string;
  file?: string;
  line?: number;
  details: string;
  recommendation: string;
};

export type FileTreeNode = {
  name: string;
  type: "folder" | "file";
  path?: string;
  language?: string;
  size_bytes?: number;
  children?: FileTreeNode[];
};

export type ChatCitation = {
  path: string;
  start_line: number;
  end_line: number;
  score: number;
};
