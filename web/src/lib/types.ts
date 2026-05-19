// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  provider: string;
  is_email_verified: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Workspace types
export interface Workspace {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  members?: WorkspaceMember[];
  boards?: Board[];
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  user?: User;
}

// Board types
export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  background: string;
  visibility: string;
  created_at: string;
  updated_at: string;
  lists?: List[];
  labels?: Label[];
}

// List types
export interface List {
  id: string;
  board_id: string;
  name: string;
  position: number;
  cards?: Card[];
}

// Card types
export interface Card {
  id: string;
  list_id: string;
  name: string;
  description: string;
  position: number;
  due_date: string | null;
  labels?: CardLabel[];
  members?: CardMember[];
  checklists?: Checklist[];
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface CardLabel {
  id: string;
  card_id: string;
  label_id: string;
  label?: Label;
}

export interface CardMember {
  id: string;
  card_id: string;
  user_id: string;
  user?: User;
}

export interface Checklist {
  id: string;
  card_id: string;
  name: string;
  items?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  name: string;
  is_checked: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  card_id?: string;
  type: string;
  is_read: boolean;
  created_at: string;
  user?: User;
  actor?: User;
  card?: Card & { list?: List };
}

export interface Activity {
  id: string;
  board_id: string;
  card_id?: string;
  user_id: string;
  action: string;
  details: string;
  created_at: string;
  user?: User;
  card?: Card;
}

export interface Comment {
  id: string;
  card_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  user?: User;
}
