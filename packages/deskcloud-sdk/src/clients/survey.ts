/**
 * @heejun/deskcloud — Survey Desk BROWSER client (publishable `pk_` key).
 *
 * Covers ONLY the public (unauthenticated / publishable-key) surface a browser
 * widget needs: fetch the active survey for an app, and submit a response.
 *
 * Maps to SurveyDesk's public controller (`@Controller('surveys/:appId')`,
 * global prefix `/api`):
 *   - GET  /api/surveys/:appId/active     → getActive
 *   - POST /api/surveys/:appId/responses  → submit
 *
 * All DTO types are duplicated here (derived from SurveyDesk's
 * `packages/shared`) so the SDK is self-contained with zero deps on the Desk.
 */

import { createDeskTransport } from "../core/http.js";

// ── Domain types (mirrored from @surveydesk/shared) ─────────────────────────

/** Question type — drives widget rendering, answer validation, aggregation. */
export type SurveyQuestionType =
  | "rating" // 1–5 integer
  | "nps" // 0–10 integer
  | "single_choice"
  | "multi_choice"
  | "text";

/** Length variant for `text` questions (UI hint + validation bound). */
export type SurveyTextVariant = "short" | "long";

/** A choice option for single_choice / multi_choice questions. */
export interface SurveyOption {
  /** Stable key stored in answers. */
  value: string;
  /** Human-readable label. */
  label: string;
}

/** A single survey question definition. */
export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  required: boolean;
  /** Only meaningful for `text` questions. */
  variant?: SurveyTextVariant;
  /** Present for single_choice / multi_choice. */
  options?: SurveyOption[];
}

/** A survey as served to the widget / dashboard. */
export interface Survey {
  appId: string;
  version: number;
  title: string;
  intro: string | null;
  questions: SurveyQuestion[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A single answer value (detailed validation is done server-side). */
export type SurveyAnswerValue = number | string | string[] | boolean;

/** Optional context the widget can attach to a submission. */
export interface SurveyResponseMeta {
  pageUrl?: string;
  userAgent?: string;
  referrer?: string;
}

/** Optional respondent attribution (logged-in users). */
export interface SurveyRespondent {
  userId?: string;
  email?: string;
}

/** Body for a public response submission. */
export interface SubmitSurveyResponseInput {
  /** Map of questionId → answer value. */
  answers: Record<string, SurveyAnswerValue>;
  respondent?: SurveyRespondent;
  meta?: SurveyResponseMeta;
}

/** Receipt returned to the submitter (body is not echoed back). */
export interface SurveyResponseReceipt {
  id: string;
  appId: string;
  surveyVersion: number;
  createdAt: string;
}

// ── Client surface ──────────────────────────────────────────────────────────

/** Options for {@link createSurveyClient}. */
export interface SurveyClientOptions {
  /** Base URL of the Survey Desk. */
  endpoint: string;
  /** Publishable key (`pk_…`). Optional to allow the pk_demo/unauthenticated path. */
  publishableKey?: string;
}

/** Public (browser-safe) Survey Desk client. */
export interface SurveyClient {
  /**
   * Fetch the active survey for an app (for rendering the widget).
   * Throws DeskError(404) if there is no active survey.
   */
  getActive(appId: string): Promise<Survey>;
  /**
   * Submit a survey response. Returns a minimal receipt (no body echo).
   * Throttled + validated server-side against the active survey.
   */
  submit(
    appId: string,
    input: SubmitSurveyResponseInput,
  ): Promise<SurveyResponseReceipt>;
}

/**
 * Create a browser-safe Survey Desk client (publishable key only).
 *
 * @example
 *   const survey = createSurveyClient({ endpoint, publishableKey })
 *   const active = await survey.getActive('demo')
 *   await survey.submit('demo', { answers: { q1: 5 } })
 */
export function createSurveyClient(opts: SurveyClientOptions): SurveyClient {
  const t = createDeskTransport({
    endpoint: opts.endpoint,
    publishableKey: opts.publishableKey,
  });

  return {
    getActive: (appId) =>
      t.get<Survey>(`/api/surveys/${encodeURIComponent(appId)}/active`),
    submit: (appId, input) =>
      t.post<SurveyResponseReceipt>(
        `/api/surveys/${encodeURIComponent(appId)}/responses`,
        {
          body: input,
        },
      ),
  };
}
