import { branding as defaultBranding, type BrandingConfig } from "@/config/branding";
import { supabase } from "@/lib/supabase";

type TenantRecord = {
  branding: BrandingConfig | null;
  is_active: boolean | null;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

export function resolveTenantSlug() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const queryTenant = url.searchParams.get("tenant");
  if (queryTenant) return queryTenant.trim();

  const host = window.location.hostname;
  if (LOCAL_HOSTS.has(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return null;
  }

  const parts = host.split(".");
  if (host.endsWith(".localhost")) return parts[0] ?? null;
  if (parts.length < 3) return null;
  return parts[0];
}

export function resolveRootHost() {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (LOCAL_HOSTS.has(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return host;
  }
  if (host.endsWith(".localhost")) return "localhost";

  const parts = host.split(".");
  if (parts.length <= 2) return host;
  return parts.slice(1).join(".");
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
