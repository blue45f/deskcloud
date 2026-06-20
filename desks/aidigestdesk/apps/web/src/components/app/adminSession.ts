const ADMIN_SESSION_STORAGE_KEY = "aidigestdesk.adminSession.v1";

export type AdminSession = {
  email: string;
  role: "콘텐츠 관리자";
  signedInAt: string;
};

export function getInitialAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    return parsed.email && parsed.role === "콘텐츠 관리자"
      ? {
          email: parsed.email,
          role: "콘텐츠 관리자",
          signedInAt: parsed.signedInAt ?? new Date().toISOString(),
        }
      : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ADMIN_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
}
