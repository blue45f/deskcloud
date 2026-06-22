function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') return ''
  return trimTrailingSlash(ensureLeadingSlash(value))
}

export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL)

const apiBaseFromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
const siteUrlFromEnv = (import.meta.env.VITE_TERMSDESK_PUBLIC_URL as string | undefined)?.trim()

export const API_BASE_URL = apiBaseFromEnv ? trimTrailingSlash(apiBaseFromEnv) : APP_BASE_PATH

export const PUBLIC_SITE_URL = trimTrailingSlash(
  siteUrlFromEnv || 'https://desk-platform.vercel.app/termsdesk'
)

export function appPath(path = '/'): string {
  const normalizedPath = ensureLeadingSlash(path)
  if (!APP_BASE_PATH) return normalizedPath
  if (normalizedPath === APP_BASE_PATH || normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath
  }
  return `${APP_BASE_PATH}${normalizedPath}`
}

function stripAppBasePath(path: string): string {
  const normalizedPath = ensureLeadingSlash(path)
  if (!APP_BASE_PATH) return normalizedPath
  if (normalizedPath === APP_BASE_PATH) return '/'
  if (normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
    return normalizedPath.slice(APP_BASE_PATH.length) || '/'
  }
  return normalizedPath
}

export function publicSiteUrl(path = '/'): string {
  const cleanPath = stripAppBasePath(path).replace(/^\/+/, '')
  return cleanPath ? `${PUBLIC_SITE_URL}/${cleanPath}` : `${PUBLIC_SITE_URL}/`
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}/api/${path.replace(/^\//, '')}`
}
