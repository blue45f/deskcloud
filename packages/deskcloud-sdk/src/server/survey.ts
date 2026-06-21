/**
 * @heejun/deskcloud/server — Survey Desk ADMIN client (secret `sk_` key).
 *
 * SECURITY: secret-key only. NEVER import from browser-bundled code.
 *
 * Covers the admin surface of SurveyDesk's admin controller
 * (`@Controller('admin/surveys/:appId')`, global prefix `/api`). In SurveyDesk
 * the native admin guard reads `X-Admin-Token`; the DeskCloud transport carries
 * the secret as `x-sk` and the DeskCloud gateway maps it to the Desk's admin
 * auth — so this client never sets auth headers itself (per scaffold convention).
 *
 *   - GET  /api/admin/surveys/:appId/responses          → listResponses
 *   - GET  /api/admin/surveys/:appId/summary            → getSummary
 *   - GET  /api/admin/surveys/:appId                    → listSurveys
 *   - GET  /api/admin/surveys/:appId/:version           → getSurvey
 *   - POST /api/admin/surveys/:appId                    → createSurvey
 *   - PUT  /api/admin/surveys/:appId/:version           → updateSurvey
 *   - POST /api/admin/surveys/:appId/:version/activate  → activateSurvey
 *
 * DTO types are duplicated here (derived from @surveydesk/shared) for a
 * self-contained SDK with zero deps on the Desk repos.
 */

import { createAdminTransport as createDeskTransport } from "../core/admin.js";

import type {
  Survey,
  SurveyOption,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyTextVariant,
} from "../clients/survey.js";

// Re-export the shared domain types so the server barrel can surface them too.
export type {
  Survey,
  SurveyOption,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyTextVariant,
};

// ── Admin DTO types (mirrored from @surveydesk/shared) ──────────────────────

/** Survey create/update body (version-agnostic). */
export interface SurveyBodyInput {
  title: string;
  /** Optional intro shown atop the widget. */
  intro?: string | null;
  questions: SurveyQuestion[];
}

/** Admin create-survey input (creates a new, inactive version). */
export type CreateSurveyInput = SurveyBodyInput;
/** Admin update-survey input (updates a specific version in place). */
export type UpdateSurveyInput = SurveyBodyInput;

/** A single response row in the admin response list. */
export interface SurveyResponse {
  id: string;
  appId: string;
  surveyVersion: number;
  answers: Record<string, unknown>;
  respondentUserId: string | null;
  respondentEmail: string | null;
  meta: { pageUrl?: string; userAgent?: string; referrer?: string } | null;
  createdAt: string;
}

/** Paginated admin response list. */
export interface SurveyResponseList {
  items: SurveyResponse[];
  /** Total rows for the same filter (matches X-Total-Count). */
  total: number;
  offset: number;
  limit: number;
}

/** Paging params for {@link SurveyAdminClient.listResponses}. */
export interface SurveyResponseListParams {
  offset?: number;
  limit?: number;
}

// ── Summary (aggregation) types ─────────────────────────────────────────────

/** rating question aggregation. */
export interface RatingSummary {
  questionId: string;
  label: string;
  type: "rating";
  count: number;
  /** Mean (2dp), or null when no samples. */
  average: number | null;
  /** Per-star counts `{ '1': n, …, '5': n }`. */
  distribution: Record<string, number>;
}

/** nps question aggregation. */
export interface NpsSummary {
  questionId: string;
  label: string;
  type: "nps";
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** NPS = round(promoters% − detractors%), −100..100, or null. */
  score: number | null;
  /** 0–10 mean (2dp), or null. */
  average: number | null;
}

/** choice question aggregation. */
export interface ChoiceSummary {
  questionId: string;
  label: string;
  type: "single_choice" | "multi_choice";
  count: number;
  tallies: { value: string; label: string; count: number }[];
}

/** text question aggregation. */
export interface TextSummary {
  questionId: string;
  label: string;
  type: "text";
  count: number;
  recent: { value: string; createdAt: string }[];
}

export type QuestionSummary =
  | RatingSummary
  | NpsSummary
  | ChoiceSummary
  | TextSummary;

/** Aggregated summary for a survey version. */
export interface SurveySummary {
  appId: string;
  surveyVersion: number;
  /** Total responses aggregated (this version). */
  responseCount: number;
  questions: QuestionSummary[];
}

// ── Client surface ──────────────────────────────────────────────────────────

/** Options for {@link createSurveyAdminClient}. */
export interface SurveyAdminClientOptions {
  /** Base URL of the Survey Desk. */
  endpoint: string;
  /** Secret key (`sk_…`) — required; server-only. */
  secretKey: string;
}

/** Admin (secret-key) Survey Desk client. */
export interface SurveyAdminClient {
  /** List responses for an app (newest first, paginated). */
  listResponses(
    appId: string,
    params?: SurveyResponseListParams,
  ): Promise<SurveyResponseList>;
  /**
   * Aggregated summary — response count, mean rating, NPS, choice tallies,
   * recent free-text (active version, or latest if none active).
   */
  getSummary(appId: string): Promise<SurveySummary>;
  /** List all survey versions for an app (newest first). */
  listSurveys(appId: string): Promise<Survey[]>;
  /** Fetch a single survey version. */
  getSurvey(appId: string, version: number): Promise<Survey>;
  /** Create a new (inactive, auto-incremented) survey version. */
  createSurvey(appId: string, input: CreateSurveyInput): Promise<Survey>;
  /** Update a specific survey version in place. */
  updateSurvey(
    appId: string,
    version: number,
    input: UpdateSurveyInput,
  ): Promise<Survey>;
  /** Activate a version (auto-deactivates the previous active one). */
  activateSurvey(appId: string, version: number): Promise<Survey>;
}

/**
 * Create a server-side admin Survey Desk client (secret key required).
 *
 * @example
 *   const admin = createSurveyAdminClient({ endpoint, secretKey })
 *   const list = await admin.listResponses('demo', { limit: 50 })
 *   const survey = await admin.createSurvey('demo', { title: 'NPS', questions: [...] })
 */
export function createSurveyAdminClient(
  opts: SurveyAdminClientOptions,
): SurveyAdminClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    secretKey: opts.secretKey,
  });

  const base = (appId: string): string =>
    `/api/admin/surveys/${encodeURIComponent(appId)}`;

  return {
    listResponses: (appId, params) =>
      t.get<SurveyResponseList>(`${base(appId)}/responses`, {
        query: { offset: params?.offset, limit: params?.limit },
      }),
    getSummary: (appId) => t.get<SurveySummary>(`${base(appId)}/summary`),
    listSurveys: (appId) => t.get<Survey[]>(base(appId)),
    getSurvey: (appId, version) => t.get<Survey>(`${base(appId)}/${version}`),
    createSurvey: (appId, input) =>
      t.post<Survey>(base(appId), { body: input }),
    updateSurvey: (appId, version, input) =>
      t.put<Survey>(`${base(appId)}/${version}`, { body: input }),
    activateSurvey: (appId, version) =>
      t.post<Survey>(`${base(appId)}/${version}/activate`),
  };
}
