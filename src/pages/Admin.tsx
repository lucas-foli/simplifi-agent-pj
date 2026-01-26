import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ALLOWED_EMAILS = new Set([
  "lucas.defoliveira@gmail.com",
  "diego.fjddf@gmail.com",
]);

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

const Admin = () => {
  const { user, loading } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [form, setForm] = useState<TenantFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);

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
        BASE_VAR_FIELDS.map((field) => [field, (form as any)[field]]),
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
              Gerencie branding, logos e cores via subdomínio.
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
                  <Label htmlFor="slug">Slug (subdomínio)</Label>
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
              <div>
                <Label htmlFor="favicon">Favicon (URL)</Label>
                <Input
                  id="favicon"
                  value={form.favicon}
                  onChange={(e) => handleChange("favicon", e.target.value)}
                  placeholder="https://.../favicon.ico"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="logoHorizontal">Logo horizontal</Label>
                <Input
                  id="logoHorizontal"
                  value={form.logoHorizontal}
                  onChange={(e) => handleChange("logoHorizontal", e.target.value)}
                  placeholder="https://.../logo-horizontal.svg"
                />
              </div>
              <div>
                <Label htmlFor="logoHorizontalInverted">Logo invertida</Label>
                <Input
                  id="logoHorizontalInverted"
                  value={form.logoHorizontalInverted}
                  onChange={(e) => handleChange("logoHorizontalInverted", e.target.value)}
                  placeholder="https://.../logo-horizontal-inverted.svg"
                />
              </div>
              <div>
                <Label htmlFor="logoMark">Logo mark</Label>
                <Input
                  id="logoMark"
                  value={form.logoMark}
                  onChange={(e) => handleChange("logoMark", e.target.value)}
                  placeholder="https://.../logo-mark.svg"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="imageHero">Imagem hero</Label>
                <Input
                  id="imageHero"
                  value={form.imageHero}
                  onChange={(e) => handleChange("imageHero", e.target.value)}
                  placeholder="https://.../hero.jpg"
                />
              </div>
              <div>
                <Label htmlFor="imageLogin">Imagem login</Label>
                <Input
                  id="imageLogin"
                  value={form.imageLogin}
                  onChange={(e) => handleChange("imageLogin", e.target.value)}
                  placeholder="https://.../login.jpg"
                />
              </div>
              <div>
                <Label htmlFor="imageOnboarding">Imagem onboarding</Label>
                <Input
                  id="imageOnboarding"
                  value={form.imageOnboarding}
                  onChange={(e) => handleChange("imageOnboarding", e.target.value)}
                  placeholder="https://.../onboarding.jpg"
                />
              </div>
              <div>
                <Label htmlFor="imageDashboard">Imagem dashboard</Label>
                <Input
                  id="imageDashboard"
                  value={form.imageDashboard}
                  onChange={(e) => handleChange("imageDashboard", e.target.value)}
                  placeholder="https://.../dashboard.jpg"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cores principais</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {COLOR_FIELDS.map((field) => (
                  <div key={field}>
                    <Label htmlFor={field}>{field}</Label>
                    <Input
                      id={field}
                      value={(form as any)[field]}
                      onChange={(e) => handleChange(field as keyof TenantFormState, e.target.value)}
                      placeholder="#FFFFFF ou 210 16% 98%"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Base do tema</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {BASE_VAR_FIELDS.map((field) => (
                  <div key={field}>
                    <Label htmlFor={field}>{field}</Label>
                    <Input
                      id={field}
                      value={(form as any)[field]}
                      onChange={(e) => handleChange(field as keyof TenantFormState, e.target.value)}
                      placeholder="ex.: 210 16% 98%"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dashboard (opcional)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {DASHBOARD_FIELDS.map((field) => (
                  <div key={field}>
                    <Label htmlFor={field}>{field}</Label>
                    <Input
                      id={field}
                      value={(form as any)[field]}
                      onChange={(e) => handleChange(field as keyof TenantFormState, e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
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
