import { type ReactNode, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { isSubdomainRequest, resolveRootHost } from "@/lib/tenant";

interface RootDomainOnlyProps {
  children: ReactNode;
}

const RootDomainOnly = ({ children }: RootDomainOnlyProps) => {
  const location = useLocation();
  const isSubdomain = useMemo(() => isSubdomainRequest(), [
    location.pathname,
    location.search,
  ]);

  useEffect(() => {
    if (!isSubdomain) return;
    const rootHost = resolveRootHost();
    if (!rootHost) return;

    const url = new URL(window.location.href);
    url.hostname = rootHost;
    url.searchParams.delete("tenant");
    url.pathname = location.pathname;
    url.hash = location.hash;
    window.location.replace(url.toString());
  }, [isSubdomain, location.pathname, location.hash]);

  if (isSubdomain) return null;
  return <>{children}</>;
};

export default RootDomainOnly;
