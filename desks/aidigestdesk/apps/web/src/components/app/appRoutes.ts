export type AppRoute =
  | "portal"
  | "models"
  | "tools"
  | "deals"
  | "resources"
  | "community"
  | "about"
  | "admin"
  | "account"
  | "support"
  | "terms"
  | "design"
  | "sitemap";

export const routePath: Record<AppRoute, string> = {
  portal: "/",
  models: "/models",
  tools: "/tools",
  deals: "/deals",
  resources: "/resources",
  community: "/community",
  about: "/about",
  admin: "/admin",
  account: "/account",
  support: "/support",
  terms: "/terms",
  design: "/design",
  sitemap: "/sitemap",
};

export const routeTitles: Record<AppRoute, string> = {
  portal: "포털 대시보드",
  models: "모델·벤치마크·비용",
  tools: "AI 도구·확장",
  deals: "LLM 할인·혜택",
  resources: "강좌·자료",
  community: "커뮤니티",
  about: "소개·사용 가이드",
  admin: "관리자 콘솔",
  account: "내 계정",
  support: "문의",
  terms: "약관·정책",
  design: "디자인 시스템",
  sitemap: "사이트맵",
};

export function getCurrentRoute(): AppRoute {
  if (typeof window === "undefined") return "portal";
  const { pathname } = window.location;
  if (pathname.startsWith("/models")) return "models";
  if (pathname.startsWith("/tools")) return "tools";
  if (pathname.startsWith("/deals")) return "deals";
  if (pathname.startsWith("/resources")) return "resources";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/about")) return "about";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/support")) return "support";
  if (pathname.startsWith("/terms")) return "terms";
  if (pathname.startsWith("/design")) return "design";
  if (pathname.startsWith("/sitemap")) return "sitemap";
  return "portal";
}
