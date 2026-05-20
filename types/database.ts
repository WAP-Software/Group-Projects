export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// ROW TYPES (full records from DB)
// ============================================================
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
  program: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  course_name: string | null;
  semester: string | null;
  color: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  joined_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  content: Json | null;
  yjs_state: string | null;
  created_by: string | null;
  status: "draft" | "in_review" | "approved";
  created_at: string;
  updated_at: string;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  position: Json | null;
  resolved: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: "backlog" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  position: number;
  milestone: boolean;
  depends_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskLabel {
  id: string;
  task_id: string;
  label: string;
  color: string;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  assigned_to: string | null;
  position: number;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface TaskFile {
  id: string;
  task_id: string;
  file_id: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  workspace_id: string;
  name: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  r2_key: string;
  folder_path: string;
  version: number;
  parent_version_id: string | null;
  uploaded_by: string | null;
  description: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  thread_id: string | null;
  file_id: string | null;
  edited: boolean;
  created_at: string;
}

export interface Source {
  id: string;
  workspace_id: string;
  title: string;
  url: string | null;
  file_id: string | null;
  source_type: "url" | "pdf" | "book" | "paper" | "news" | "other";
  notes: string | null;
  tags: string[] | null;
  added_by: string | null;
  created_at: string;
}

export interface Formula {
  id: string;
  workspace_id: string;
  title: string;
  latex: string;
  description: string | null;
  category: string;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  workspace_id: string;
  document_id: string;
  title: string;
  status: "pending" | "in_review" | "changes_requested" | "approved";
  submitted_by: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewAssignment {
  id: string;
  review_id: string;
  reviewer_id: string;
  status: "pending" | "in_progress" | "done";
  feedback: string | null;
  rating: number | null;
  submitted_at: string | null;
}

export interface Poll {
  id: string;
  workspace_id: string;
  question: string;
  options: Json;
  created_by: string | null;
  expires_at: string | null;
  multiple_choice: boolean;
  anonymous: boolean;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option_ids: Json;
  created_at: string;
}

export interface Contribution {
  workspace_id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  tasks_completed: number;
  tasks_created: number;
  documents_created: number;
  files_uploaded: number;
  messages_sent: number;
}

// ============================================================
// DATABASE TYPE (for Supabase client generic)
// ============================================================
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & { id: string };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Workspace, "id" | "created_at">>;
        Relationships: [];
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Omit<WorkspaceMember, "id" | "joined_at"> & { id?: string };
        Update: Partial<Omit<WorkspaceMember, "id">>;
        Relationships: [];
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Document, "id" | "created_at">>;
        Relationships: [];
      };
      document_comments: {
        Row: DocumentComment;
        Insert: Omit<DocumentComment, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<DocumentComment, "id" | "created_at">>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Task, "id" | "created_at">>;
        Relationships: [];
      };
      task_labels: {
        Row: TaskLabel;
        Insert: Omit<TaskLabel, "id"> & { id?: string };
        Update: Partial<Omit<TaskLabel, "id">>;
        Relationships: [];
      };
      task_subtasks: {
        Row: TaskSubtask;
        Insert: Omit<TaskSubtask, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<TaskSubtask, "id" | "created_at">>;
        Relationships: [];
      };
      task_comments: {
        Row: TaskComment;
        Insert: Omit<TaskComment, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<TaskComment, "id" | "created_at">>;
        Relationships: [];
      };
      task_files: {
        Row: TaskFile;
        Insert: Omit<TaskFile, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<TaskFile, "id" | "created_at">>;
        Relationships: [];
      };
      files: {
        Row: FileRecord;
        Insert: Omit<FileRecord, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<FileRecord, "id" | "created_at">>;
        Relationships: [];
      };
      channels: {
        Row: Channel;
        Insert: Omit<Channel, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Channel, "id" | "created_at">>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Message, "id" | "created_at">>;
        Relationships: [];
      };
      sources: {
        Row: Source;
        Insert: Omit<Source, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Source, "id" | "created_at">>;
        Relationships: [];
      };
      formulas: {
        Row: Formula;
        Insert: Omit<Formula, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Formula, "id" | "created_at">>;
        Relationships: [];
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<Review, "id" | "created_at">>;
        Relationships: [];
      };
      review_assignments: {
        Row: ReviewAssignment;
        Insert: Omit<ReviewAssignment, "id"> & { id?: string };
        Update: Partial<Omit<ReviewAssignment, "id">>;
        Relationships: [];
      };
      polls: {
        Row: Poll;
        Insert: Omit<Poll, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Poll, "id" | "created_at">>;
        Relationships: [];
      };
      poll_votes: {
        Row: PollVote;
        Insert: Omit<PollVote, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<PollVote, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      contributions: {
        Row: Contribution;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
