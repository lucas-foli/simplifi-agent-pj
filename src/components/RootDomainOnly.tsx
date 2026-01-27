import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { resolveRootHost, resolveTenantSlug } from "@/lib/tenant";

interface RootDomainOnlyProps {
  children: ReactNode;
}

const RootDomainOnly = ({ children }: RootDomainOnlyProps) => {
  const location = useLocation();
  const tenantSlug = useMemo(() => resolveTenantSlug(), [
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    if (!tenantSlug) return;
    const rootHost = resolveRootHost();
    if (!rootHost) return;

    const url = new URL(window.location.href);
    url.hostname = rootHost;
    url.searchParams.delete("tenant");
    url.pathname = location.pathname;
    url.hash = location.hash;
    window.location.replace(url.toString());
  }, [tenantSlug, location.pathname, location.hash]);

  if (tenantSlug) return null;
  return <>{children}</>;
};

export default RootDomainOnly;
