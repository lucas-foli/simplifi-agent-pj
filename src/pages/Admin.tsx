import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildTenantAccessUrl, resolveTenantUrlMode } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ADMIN_EMAILS } from "@/config/admin";

const ALLOWED_EMAILS = new Set(ADMIN_EMAILS);

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  branding: Record<string, any> | null;
  is_active: boolean;
};

type TenantFormState = {
  slug: string;
  name: string;
  isActive: boolean;
  brandName: string;
  favicon: string;
  logoHorizontal: string;
  logoHorizontalInverted: string;
  logoMark: string;
  imageHero: string;
  imageLogin: string;
  imageOnboarding: string;
  imageDashboard: string;
  primary: string;
  primaryForeground: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  warning: string;
  destructive: string;
  muted: string;
  mutedForeground: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  shadowPrimary: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  ring: string;
  dashboardPrimary: string;
  dashboardSecondary: string;
  dashboardBackground: string;
  dashboardForeground: string;
  extraCssVarsJson: string;
  extraBrandingJson: string;
};

const EMPTY_FORM: TenantFormState = {
  slug: "",
  name: "",
  isActive: true,
  brandName: "",
  favicon: "",
  logoHorizontal: "",
  logoHorizontalInverted: "",
  logoMark: "",
  imageHero: "",
  imageLogin: "",
  imageOnboarding: "",
  imageDashboard: "",
  primary: "",
  primaryForeground: "",
  primaryLight: "",
  primaryDark: "",
  secondary: "",
  secondaryForeground: "",
  accent: "",
  accentForeground: "",
  success: "",
  warning: "",
  destructive: "",
  muted: "",
  mutedForeground: "",
  chart1: "",
  chart2: "",
  chart3: "",
  chart4: "",
  chart5: "",
  shadowPrimary: "",
  background: "",
  foreground: "",
  card: "",
  cardForeground: "",
  border: "",
  ring: "",
  dashboardPrimary: "",
  dashboardSecondary: "",
  dashboardBackground: "",
  dashboardForeground: "",
  extraCssVarsJson: "",
  extraBrandingJson: "",
};

const COLOR_FIELDS = [
  "primary",
  "primaryForeground",
  "primaryLight",
  "primaryDark",
  "secondary",
  "secondaryForeground",
  "accent",
  "accentForeground",
  "success",
  "warning",
  "destructive",
  "muted",
  "mutedForeground",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
  "shadowPrimary",
];

const BASE_VAR_FIELDS = ["background", "foreground", "card", "cardForeground", "border", "ring"];

const DASHBOARD_FIELDS = [
  "dashboardPrimary",
  "dashboardSecondary",
  "dashboardBackground",
  "dashboardForeground",
];

const safeJsonParse = (value: string) => {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const cleanObject = (obj: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== "" && value !== null && value !== undefined),
  );

const isHexColor = (value: string) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value.trim());

const hexToHslString = (hex: string) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  if (expanded.length !== 6) return null;
  const num = parseInt(expanded, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const normalizeCssVarValue = (value: string) => {
  if (!value) return value;
  const trimmed = value.trim();
  if (isHexColor(trimmed)) {
    const hsl = hexToHslString(trimmed);
    return hsl ?? trimmed;
  }
  return trimmed;
};

const ColorInput = ({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-3">
      <input
        id={`${id}-picker`}
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 rounded-md border border-input bg-transparent p-1"
      />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#FFFFFF ou 210 16% 98%"
      />
    </div>
  </div>
);

const Admin = () => {
  const { user, loading } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const tenantUrlMode = useMemo(() => resolveTenantUrlMode(), []);
  const tenantAccessUrl = useMemo(() => buildTenantAccessUrl(form.slug), [form.slug]);

  const isAllowed = useMemo(() => {
    if (!user?.email) return false;
    return ALLOWED_EMAILS.has(user.email);
  }, [user?.email]);

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const { data, error } = await supabase
        .from("tenants" as any)
        .select("id, slug, name, branding, is_active")
        .order("slug");
      if (error) throw error;
      setTenants((data as TenantRow[]) ?? []);
    } catch (error) {
      console.error("Erro ao carregar tenants:", error);
      toast.error("Erro ao carregar tenants.");
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    if (isAllowed) {
      loadTenants();
    }
  }, [isAllowed]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSelectedTenantId(null);
  };

  const populateForm = (tenant: TenantRow) => {
    const branding = tenant.branding ?? {};
    const logo = branding.logo ?? {};
    const colors = branding.colors ?? {};
    const images = branding.images ?? {};
    const cssVars = branding.cssVars ?? {};
    const dashboard = branding.dashboard ?? {};

    const extraCssVars = { ...cssVars };
    BASE_VAR_FIELDS.forEach((field) => {
      delete extraCssVars[field];
    });

    const extraBranding = { ...branding };
    delete extraBranding.brandName;
    delete extraBranding.logo;
    delete extraBranding.colors;
    delete extraBranding.favicon;
    delete extraBranding.images;
    delete extraBranding.cssVars;
    delete extraBranding.dashboard;

    setForm({
      slug: tenant.slug,
      name: tenant.name,
      isActive: tenant.is_active ?? true,
      brandName: branding.brandName ?? "",
      favicon: branding.favicon ?? "",
      logoHorizontal: logo.horizontal ?? "",
      logoHorizontalInverted: logo.horizontalInverted ?? "",
      logoMark: logo.mark ?? "",
      imageHero: images.hero ?? "",
      imageLogin: images.login ?? "",
      imageOnboarding: images.onboarding ?? "",
      imageDashboard: images.dashboard ?? "",
      primary: colors.primary ?? "",
      primaryForeground: colors.primaryForeground ?? "",
      primaryLight: colors.primaryLight ?? "",
      primaryDark: colors.primaryDark ?? "",
      secondary: colors.secondary ?? "",
      secondaryForeground: colors.secondaryForeground ?? "",
      accent: colors.accent ?? "",
      accentForeground: colors.accentForeground ?? "",
      success: colors.success ?? "",
      warning: colors.warning ?? "",
      destructive: colors.destructive ?? "",
      muted: colors.muted ?? "",
      mutedForeground: colors.mutedForeground ?? "",
      chart1: colors.chart1 ?? "",
      chart2: colors.chart2 ?? "",
      chart3: colors.chart3 ?? "",
      chart4: colors.chart4 ?? "",
      chart5: colors.chart5 ?? "",
      shadowPrimary: colors.shadowPrimary ?? "",
      background: cssVars.background ?? "",
      foreground: cssVars.foreground ?? "",
      card: cssVars.card ?? "",
      cardForeground: cssVars.cardForeground ?? "",
      border: cssVars.border ?? "",
      ring: cssVars.ring ?? "",
      dashboardPrimary: dashboard.primary ?? "",
      dashboardSecondary: dashboard.secondary ?? "",
      dashboardBackground: dashboard.background ?? "",
      dashboardForeground: dashboard.foreground ?? "",
      extraCssVarsJson: Object.keys(extraCssVars).length
        ? JSON.stringify(extraCssVars, null, 2)
        : "",
      extraBrandingJson: Object.keys(extraBranding).length
        ? JSON.stringify(extraBranding, null, 2)
        : "",
    });
    setSelectedTenantId(tenant.id);
  };

  const handleChange = (field: keyof TenantFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildBrandingPayload = () => {
    const colors = cleanObject(
      Object.fromEntries(
        COLOR_FIELDS.map((field) => [field, (form as any)[field]]),
      ),
    );

    const cssVars = cleanObject(
      Object.fromEntries(
        BASE_VAR_FIELDS.map((field) => [field, normalizeCssVarValue((form as any)[field])]),
      ),
    );

    const dashboard = cleanObject(
      Object.fromEntries(
        DASHBOARD_FIELDS.map((field) => [
          field.replace("dashboard", "").replace(/^./, (c) => c.toLowerCase()),
          (form as any)[field],
        ]),
      ),
    );

    const images = cleanObject({
      hero: form.imageHero,
      login: form.imageLogin,
      onboarding: form.imageOnboarding,
      dashboard: form.imageDashboard,
    });

    const branding: Record<string, any> = cleanObject({
      brandName: form.brandName,
      favicon: form.favicon,
      logo: cleanObject({
        horizontal: form.logoHorizontal,
        horizontalInverted: form.logoHorizontalInverted,
        mark: form.logoMark,
      }),
      colors,
      images,
      cssVars,
      dashboard,
    });

    const extraCssVars = safeJsonParse(form.extraCssVarsJson);
    if (extraCssVars && typeof extraCssVars === "object") {
      branding.cssVars = {
        ...(branding.cssVars ?? {}),
        ...extraCssVars,
      };
    }

    const extraBranding = safeJsonParse(form.extraBrandingJson);
    if (extraBranding && typeof extraBranding === "object") {
      Object.assign(branding, extraBranding);
    }

    return branding;
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim()) {
      toast.error("Slug e nome são obrigatórios.");
      return;
    }

    const brandingPayload = buildBrandingPayload();
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        is_active: form.isActive,
        branding: brandingPayload,
      };

      const { data, error } = await supabase
        .from("tenants" as any)
        .upsert(payload, { onConflict: "slug" })
        .select("id");

      if (error) throw error;
      setSelectedTenantId(data?.[0]?.id ?? null);
      toast.success("Tenant salvo com sucesso!");
      await loadTenants();
    } catch (error) {
      console.error("Erro ao salvar tenant:", error);
      toast.error("Erro ao salvar tenant.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssetUpload = async (
    field:
      | "imageHero"
      | "imageLogin"
      | "imageOnboarding"
      | "imageDashboard"
      | "logoHorizontal"
      | "logoHorizontalInverted"
      | "logoMark"
      | "favicon",
    file: File,
  ) => {
    if (!form.slug.trim()) {
      toast.error("Defina o slug antes de enviar arquivos.");
      return;
    }
    setUploadingField(field);
    try {
      const ext = file.name.split(".").pop() || "png";
      const safeSlug = form.slug.trim().toLowerCase();
      const path = `${safeSlug}/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      handleChange(field, data.publicUrl);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar arquivo:", error);
      toast.error("Erro ao enviar arquivo.");
    } finally {
      setUploadingField(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este painel.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin de Tenants</h1>
            <p className="text-muted-foreground">
              {tenantUrlMode === "query"
                ? "Gerencie branding, logos e cores via parâmetro ?tenant."
                : "Gerencie branding, logos e cores via subdomínio."}
            </p>
          </div>
          <Button onClick={resetForm} variant="outline">
            Novo tenant
          </Button>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Tenants</h2>
              <Button variant="ghost" size="sm" onClick={loadTenants} disabled={loadingTenants}>
                {loadingTenants ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
            {tenants.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum tenant cadastrado.</p>
            )}
            <div className="space-y-2">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  className={`w-full text-left p-3 rounded-lg border transition-smooth ${
                    selectedTenantId === tenant.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => populateForm(tenant)}
                >
                  <div className="font-medium">{tenant.name}</div>
                  <div className="text-xs text-muted-foreground">{tenant.slug}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-8">
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="slug">
                    {tenantUrlMode === "query" ? "Slug (tenant)" : "Slug (subdomínio)"}
                  </Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => handleChange("slug", e.target.value)}
                    placeholder="ex.: acme"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="ACME Ltda"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tenantUrl">URL do tenant</Label>
                <Input
                  id="tenantUrl"
                  value={tenantAccessUrl ?? ""}
                  readOnly
                  placeholder="Defina o slug para gerar a URL"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {tenantUrlMode === "query"
                    ? "Ambientes vercel.app/localhost usam ?tenant= no endereço."
                    : "Use o subdomínio para acessar este tenant."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(value) => handleChange("isActive", value)}
                />
                <span className="text-sm text-muted-foreground">
                  Tenant ativo
                </span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="brandName">Nome da marca</Label>
                <Input
                  id="brandName"
                  value={form.brandName}
                  onChange={(e) => handleChange("brandName", e.target.value)}
                  placeholder="Nome exibido"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faviconFile">Favicon</Label>
                <Input
                  id="faviconFile"
                  type="file"
                  accept="image/x-icon,image/png,image/svg+xml"
                  disabled={uploadingField === "favicon"}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleAssetUpload("favicon", file);
                    }
                  }}
                />
                <Input
                  value={form.favicon}
                  readOnly
                  placeholder="URL será preenchida após upload"
                />
                {form.favicon && (
                  <img
                    src={form.favicon}
                    alt="Favicon"
                    className="h-10 w-10 object-contain rounded border bg-muted"
                  />
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { key: "logoHorizontal", label: "Logo horizontal", value: form.logoHorizontal },
                { key: "logoHorizontalInverted", label: "Logo invertida", value: form.logoHorizontalInverted },
                { key: "logoMark", label: "Logo mark", value: form.logoMark },
              ].map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label htmlFor={item.key}>{item.label}</Label>
                  <Input
                    id={item.key}
                    type="file"
                    accept="image/*"
                    disabled={uploadingField === item.key}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleAssetUpload(
                          item.key as "logoHorizontal" | "logoHorizontalInverted" | "logoMark",
                          file,
                        );
                      }
                    }}
                  />
                  <Input
                    value={item.value}
                    readOnly
                    placeholder="URL será preenchida após upload"
                  />
                  {item.value && (
                    <img
                      src={item.value}
                      alt={item.label}
                      className="h-16 w-full object-contain rounded-md border bg-muted"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { key: "imageHero", label: "Imagem hero", value: form.imageHero },
                { key: "imageLogin", label: "Imagem login", value: form.imageLogin },
                { key: "imageOnboarding", label: "Imagem onboarding", value: form.imageOnboarding },
                { key: "imageDashboard", label: "Imagem dashboard", value: form.imageDashboard },
              ].map((item) => (
                <div key={item.key} className="space-y-2">
                  <Label htmlFor={item.key}>{item.label}</Label>
                  <Input
                    id={item.key}
                    type="file"
                    accept="image/*"
                    disabled={uploadingField === item.key}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleAssetUpload(
                          item.key as "imageHero" | "imageLogin" | "imageOnboarding" | "imageDashboard",
                          file,
                        );
                      }
                    }}
                  />
                  <Input
                    value={item.value}
                    readOnly
                    placeholder="URL será preenchida após upload"
                  />
                  {item.value && (
                    <img
                      src={item.value}
                      alt={item.label}
                      className="h-24 w-full object-cover rounded-md border"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cores principais</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {COLOR_FIELDS.map((field) => (
                  <ColorInput
                    key={field}
                    id={field}
                    label={field}
                    value={(form as any)[field]}
                    onChange={(value) => handleChange(field as keyof TenantFormState, value)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Base do tema</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {BASE_VAR_FIELDS.map((field) => (
                  <ColorInput
                    key={field}
                    id={field}
                    label={field}
                    value={(form as any)[field]}
                    onChange={(value) => handleChange(field as keyof TenantFormState, value)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dashboard (opcional)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {DASHBOARD_FIELDS.map((field) => (
                  <ColorInput
                    key={field}
                    id={field}
                    label={field}
                    value={(form as any)[field]}
                    onChange={(value) => handleChange(field as keyof TenantFormState, value)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Avançado</h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="extraCssVarsJson">CSS variables extras (JSON)</Label>
                  <Textarea
                    id="extraCssVarsJson"
                    value={form.extraCssVarsJson}
                    onChange={(e) => handleChange("extraCssVarsJson", e.target.value)}
                    placeholder='{"sidebar": "210 16% 94%"}'
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="extraBrandingJson">Branding extra (JSON)</Label>
                  <Textarea
                    id="extraBrandingJson"
                    value={form.extraBrandingJson}
                    onChange={(e) => handleChange("extraBrandingJson", e.target.value)}
                    placeholder='{"customKey": "value"}'
                    rows={4}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={resetForm}>
                Limpar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar tenant"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;
