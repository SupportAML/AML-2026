
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Plaintiff' | 'Defendant' | 'Lawyer' | 'Other';
}

export interface ReportComment {
  id: string;
  sectionId?: string; // Kept for legacy compatibility, but effectively global or "main"
  author: string;
  text: string;
  context?: string; // The selected text this comment refers to
  timestamp: number;
  resolved: boolean;
  replies: ReportComment[]; // Nested replies
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  pageNumber: number;
}

export interface Suggestion {
  id: string;
  type: 'REVISION' | 'CITATION' | 'GENERATION';
  sectionId: string; // "main" for single doc
  originalText?: string;
  suggestedText: string;
  rationale: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: number;
}

export interface ChronologyEvent {
  id: string;
  date: string;
  formattedText: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
}

export interface StructuredChronology {
  years: {
    year: string;
    months: {
      month: string;
      events: ChronologyEvent[];
    }[];
  }[];
  irrelevantFacts: ChronologyEvent[];
}

export interface Case {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  startDate?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  status: 'planning' | 'active' | 'on_hold' | 'cancelled' | 'archived';
  ownerId: string;
  ownerName?: string;
  assignedUserIds?: string[];
  assignedUserEmails?: string[]; // Pre-authorized emails for invited users
  virtualFolders?: string[];

  // New Fields
  primaryLawyer?: string;
  clients: Client[];

  // Report Writer State
  reportContent?: string; // Single unified document content
  reportSections?: ReportSection[]; // Legacy support
  suggestions?: Suggestion[];

  // Legacy fields 
  reportDraft?: string;
  pendingReportDraft?: string;

  reportStatus?: 'idle' | 'generating' | 'review';
  reportComments?: ReportComment[];
  additionalContext?: string;
  caseSummary?: string;

  // Strategy Persistence
  strategyData?: StrategyAnalysis;

  // Chronology Persistence
  chronologyData?: StructuredChronology;

  // Research Persistence
  researchResults?: ResearchArticle[];
  researchGaps?: { topic: string; reason: string }[];

  // Deposition Chat Persistence - Multiple conversations per scenario
  depoChats?: { [scenarioId: string]: ChatMessage[] }; // Map of scenario ID to chat history
  depoStage?: 'ANALYSIS' | 'SIMULATION';
  depoActiveScenario?: string;

  // Draft Versioning
  draftVersions?: {
    id: string;
    date: string;
    content: string;
    status: 'draft' | 'finalized' | 'generated';
    author: string;
    label?: string;
  }[];

  // Export History (Audit Trail)
  exportHistory?: {
    id: string;
    date: string;
    format: 'pdf' | 'word' | 'text' | 'clipboard';
    user: string;
    fileName?: string;
  }[];

  // Last activity timestamp - auto-updated on any case-related change
  lastActivityAt?: string;

  // Finalization
  isFinal?: boolean;
  signature?: string;
  signedDate?: string;
  reportTemplate?: string;
}

export interface StrategyScenario {
  id: string;
  title: string;
  plaintiffArgument: string;
  defenseArgument: string;
  firstQuestion: string;
  idealAnswer: string;
}

export interface ResearchArticle {
  title: string;
  source: string;
  summary: string;
  url: string;
  citation: string;
}

export interface ResearchGap {
  topic: string;
  reason: string;
}

export interface StrategyAnalysis {
  scenarios: StrategyScenario[];
  overallAssessment: string;
}

export type UserRole = 'ADMIN' | 'USER';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  avatarColor?: string;
  qualifications?: string;
  bio?: string;
  cvFileName?: string;
  cvUrl?: string;
}

export interface AuthorizedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'invited';
  addedAt: string;
  password?: string;
  avatarColor?: string;
  inviteTokenId?: string; // Reference to invitation token used
}

export interface PendingSignupRequest {
  id: string;
  email: string;
  name: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied';
  reviewedBy?: string;
  reviewedAt?: string;
  denialReason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface InvitationToken {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  usedBy?: string;
  status: 'active' | 'expired' | 'used' | 'revoked';
}

export type ReviewStatus = 'pending' | 'in_review' | 'reviewed';

export interface Document {
  id: string;
  caseId: string;
  name: string;
  type: 'pdf';
  category?: 'legal' | 'research' | 'medical';
  url: string;
  uploadDate: string;
  size: string;
  driveFileId?: string;
  storagePath?: string;
  path?: string;
  citation?: string;
  reviewStatus?: ReviewStatus;
}

export interface Annotation {
  id: string;
  documentId: string;
  caseId: string;
  page: number;
  text: string;
  author: string;
  timestamp: string;
  eventDate?: string;
  eventTime?: string;
  category: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  type?: 'point' | 'highlight' | 'area' | 'voice';
  imageUrl?: string;
}

export interface DepoFeedback {
  score: number; // 1-10
  critique: string;
  questionIntent: string; // What counsel was trying to do
  technique: string; // Name of technique to use
  betterAnswer: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  coaching?: DepoFeedback;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  CASE_VIEW = 'CASE_VIEW',
  DOC_VIEWER = 'DOC_VIEWER',
  ANNOTATION_ROLLUP = 'ANNOTATION_ROLLUP',
  CLIENTS = 'CLIENTS',
  ORIENTATION = 'ORIENTATION',
  PROFILE = 'PROFILE',
  TEAM_ADMIN = 'TEAM_ADMIN',
  ADMIN_INSIGHTS = 'ADMIN_INSIGHTS',
  SETTINGS = 'SETTINGS'
}

