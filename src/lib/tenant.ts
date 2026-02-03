import { branding as defaultBranding, type BrandingConfig } from "@/config/branding";
import { supabase } from "@/lib/supabase";

type TenantRecord = {
  branding: BrandingConfig | null;
  is_active: boolean | null;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const VERCEL_APP_SUFFIX = ".vercel.app";
const DEFAULT_TENANT_SLUG = (import.meta.env.VITE_DEFAULT_TENANT_SLUG ?? "").trim();
const ADMIN_HOSTS = (import.meta.env.VITE_ADMIN_HOSTS ?? import.meta.env.VITE_ADMIN_HOST ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const TENANT_URL_MODE = (import.meta.env.VITE_TENANT_URL_MODE ?? "").trim().toLowerCase();

const isAdminHost = (host: string) => ADMIN_HOSTS.includes(host.toLowerCase());
const isIpAddress = (host: string) => /^\d+\.\d+\.\d+\.\d+$/.test(host);
const isLocalRootHost = (host: string) => LOCAL_HOSTS.has(host) || isIpAddress(host);
const isLocalSubdomainHost = (host: string) => host.toLowerCase().endsWith(".localhost");
const isVercelAppHost = (host: string) => host.toLowerCase().endsWith(VERCEL_APP_SUFFIX);

const resolveSubdomainSlug = () => {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (isLocalRootHost(host)) {
    return null;
  }
  if (isAdminHost(host)) return null;
  const parts = host.split(".");
  if (isLocalSubdomainHost(host)) return parts[0] ?? null;
  if (isVercelAppHost(host) && parts.length === 3) return null;
  if (parts.length < 3) return null;
  return parts[0];
};

export function resolveTenantSlug(options?: { allowDefault?: boolean }) {
  if (typeof window === "undefined") return null;
  const allowDefault = options?.allowDefault !== false;
  const url = new URL(window.location.href);
  const queryTenant = url.searchParams.get("tenant");
  if (queryTenant) return queryTenant.trim();

  const subdomain = resolveSubdomainSlug();
  if (subdomain) return subdomain;
  if (!allowDefault) return null;
  return DEFAULT_TENANT_SLUG || null;
}

export function resolveRootHost() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (isLocalRootHost(host)) {
    return host;
  }
  if (isAdminHost(host)) return host;
  if (ADMIN_HOSTS.length > 0) return ADMIN_HOSTS[0];
  if (isLocalSubdomainHost(host)) return "localhost";

  const parts = host.split(".");
  if (isVercelAppHost(host) && parts.length === 3) return host;
  if (parts.length <= 2) return host;
  return parts.slice(1).join(".");
}

export function isSubdomainRequest() {
  return Boolean(resolveSubdomainSlug());
}

export function resolveTenantUrlMode(): "query" | "subdomain" {
  if (TENANT_URL_MODE === "query" || TENANT_URL_MODE === "subdomain") {
    return TENANT_URL_MODE;
  }
  if (typeof window === "undefined") return "subdomain";
  const host = window.location.hostname;
  const rootHost = resolveRootHost() ?? host;
  if (isLocalRootHost(host) || isVercelAppHost(rootHost)) {
    return "query";
  }
  return "subdomain";
}

export function buildTenantAccessUrl(slug: string) {
  if (typeof window === "undefined") return null;
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const rootHost = resolveRootHost();
  if (!rootHost) return null;

  const url = new URL(window.location.href);
  const mode = resolveTenantUrlMode();

  if (mode === "query") {
    url.hostname = rootHost;
    url.pathname = "/";
    url.searchParams.set("tenant", normalizedSlug);
    url.hash = "";
    return url.toString();
  }

  url.hostname = `${normalizedSlug}.${rootHost}`;
  url.pathname = "/";
  url.searchParams.delete("tenant");
  url.hash = "";
  return url.toString();
}

function mergeBranding(overrides?: Partial<BrandingConfig> | null): BrandingConfig {
  if (!overrides) return defaultBranding;
  return {
    ...defaultBranding,
    ...overrides,
    logo: {
      ...defaultBranding.logo,
      ...overrides.logo,
    },
    colors: {
      ...defaultBranding.colors,
      ...overrides.colors,
    },
    images: {
      ...(defaultBranding as any).images,
      ...(overrides as any).images,
    },
    cssVars: {
      ...(defaultBranding as any).cssVars,
      ...(overrides as any).cssVars,
    },
    dashboard: {
      ...(defaultBranding as any).dashboard,
      ...(overrides as any).dashboard,
    },
  };
}

export async function loadTenantBranding(): Promise<BrandingConfig | null> {
  const slug = resolveTenantSlug();
  if (!slug) return null;

  const { data, error } = await supabase
    .from("tenants" as any)
    .select("branding, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load tenant branding:", error);
    return null;
  }

  const tenant = data as unknown as TenantRecord | null;
  if (!tenant || tenant.is_active === false) return null;

  return mergeBranding(tenant.branding ?? undefined);
}
