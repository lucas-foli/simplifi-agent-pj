import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, MessageCircle, Receipt, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import InputMask from "react-input-mask";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { translateAuthError } from "@/lib/authErrors";
import { createWhatsAppLink, type WhatsAppLinkResponse } from "@/lib/whatsapp";

const ONBOARDING_STORAGE_KEY = "simplifiqa_pj_onboarding";

type BusinessCountry = "BR" | "US";

const STEP_KEYS = ["welcome", "responsible", "company", "fixedCosts", "whatsapp"] as const;

const TAX_ID_CONFIG: Record<BusinessCountry, { key: string; mask: string; digits: number } | null> = {
  BR: { key: "cnpj", mask: "99.999.999/9999-99", digits: 14 },
  US: { key: "ein", mask: "99-9999999", digits: 9 },
};

type FixedCost = { id: string; name: string; value: string };

const Onboarding = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, companyMemberships, loading: authLoading_, signUp, refreshCompanyMemberships } = useAuth();

  const steps = STEP_KEYS.map((key, i) => ({
    number: i + 1,
    title: t(`onboarding.steps.${key}`),
  }));

  const savedState = (() => {
    try {
      const raw = sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const [step, setStep] = useState(savedState?.step ?? 1);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [taxIdError, setTaxIdError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [authVerified, setAuthVerified] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [completedCompanyId, setCompletedCompanyId] = useState<string | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<WhatsAppLinkResponse | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappError, setWhatsappError] = useState("");
  const [whatsappAutoAttempted, setWhatsappAutoAttempted] = useState(false);

  const [formData, setFormData] = useState({
    name: savedState?.name ?? "",
    email: savedState?.email ?? "",
    password: "",
    confirmPassword: "",
    companyName: savedState?.companyName ?? "",
    country: (savedState?.country as BusinessCountry) ?? ("BR" as BusinessCountry),
    taxId: savedState?.taxId ?? "",
    monthlyRevenue: savedState?.monthlyRevenue ?? "",
    fixedCosts: [] as FixedCost[],
  });

  useEffect(() => {
    if (!authLoading_ && user && companyMemberships.length > 0) {
      navigate("/company/dashboard", { replace: true });
    }
  }, [authLoading_, user, companyMemberships, navigate]);

  // Validate restored step: if step >= 3, verify session exists
  useEffect(() => {
    if (savedState?.step && savedState.step >= 3) {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          setStep(2);
        }
      });
    }
  }, []);

  // Persist safe form fields to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({
          step,
          name: formData.name,
          email: formData.email,
          companyName: formData.companyName,
          country: formData.country,
          taxId: formData.taxId,
          monthlyRevenue: formData.monthlyRevenue,
        }),
      );
    } catch {
      // sessionStorage full or unavailable
    }
  }, [step, formData.name, formData.email, formData.companyName, formData.country, formData.taxId, formData.monthlyRevenue]);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (value: string) => {
    setFormData((prev) => ({ ...prev, email: value }));
    setEmailError(value && !validateEmail(value) ? t("onboarding.responsible.emailInvalid") : "");
    if (verificationSent) resetVerification();
  };

  const handleCountryChange = (value: BusinessCountry) => {
    setFormData((prev) => ({ ...prev, country: value, taxId: "" }));
    setTaxIdError("");
  };

  const handleTaxIdChange = (value: string) => {
    setFormData((prev) => ({ ...prev, taxId: value }));
    const config = TAX_ID_CONFIG[formData.country];
    if (!config) {
      setTaxIdError("");
      return;
    }
    const clean = value.replace(/\D/g, "");
    if (clean && clean.length !== config.digits) {
      setTaxIdError(t(`onboarding.company.${config.key}Invalid`));
    } else {
      setTaxIdError("");
    }
  };

  const parseCurrencyToDecimal = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "0";
    return (parseFloat(numbers) / 100).toString();
  };

  const formatDecimalToDisplay = (decimal: string) => {
    if (!decimal || decimal === "0") return "";
    const amount = parseFloat(decimal);
    if (Number.isNaN(amount)) return "";
    return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleMonthlyRevenueChange = (value: string) => {
    setFormData((prev) => ({ ...prev, monthlyRevenue: parseCurrencyToDecimal(value) }));
  };

  const createFixedCost = (overrides?: Partial<FixedCost>): FixedCost => ({
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: "",
    value: "0",
    ...overrides,
  });

  const addFixedCost = () => {
    setFormData((prev) => ({
      ...prev,
      fixedCosts: [...prev.fixedCosts, createFixedCost()],
    }));
  };

  const updateFixedCost = (index: number, field: keyof FixedCost, value: string) => {
    setFormData((prev) => ({
      ...prev,
      fixedCosts: prev.fixedCosts.map((cost, i) =>
        i === index
          ? {
              ...cost,
              [field]: field === "value" ? parseCurrencyToDecimal(value) : value,
            }
          : cost,
      ),
    }));
  };

  const removeFixedCost = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      fixedCosts: prev.fixedCosts.filter((_, i) => i !== index),
    }));
  };

  const validatePassword = () => {
    if (formData.password.length < 6) {
      setPasswordError(t("onboarding.responsible.passwordMinLength"));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError(t("onboarding.responsible.passwordMismatch"));
      return false;
    }

    setPasswordError("");
    return true;
  };

  const resetVerification = () => {
    setVerificationCode("");
    setVerificationError("");
    setVerificationSent(false);
    setAuthVerified(false);
  };

  const handleSendVerification = async () => {
    if (authLoading) return;
    if (!validatePassword()) return;

    if (!formData.email || !validateEmail(formData.email)) {
      setEmailError(t("onboarding.responsible.emailInvalid"));
      return;
    }

    setAuthLoading(true);
    setVerificationError("");
    try {
      if (verificationSent && !authVerified) {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: formData.email,
        });
        if (error) throw error;
        toast.success(t("onboarding.responsible.codeResent"));
        return;
      }

      const result = await signUp(
        {
          email: formData.email,
          password: formData.password,
        },
        {
          name: formData.name,
        },
      );

      setVerificationSent(true);

      if (result?.session) {
        setAuthVerified(true);
        toast.success(t("onboarding.responsible.authComplete"));
        return;
      }

      toast.success(t("onboarding.responsible.codeSent"));
    } catch (error) {
      console.error("Verification send error:", error);
      const errorMessage = error instanceof Error ? error.message : t("onboarding.responsible.codeSendError");
      toast.error(translateAuthError(errorMessage));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (authLoading) return;
    if (!verificationCode.trim()) {
      setVerificationError(t("onboarding.responsible.verificationCodeRequired"));
      return;
    }

    setAuthLoading(true);
    setVerificationError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: verificationCode.trim(),
        type: "signup",
      });

      if (error) throw error;

      if (data?.session) {
        setAuthVerified(true);
        toast.success(t("onboarding.responsible.accountConfirmed"));
      } else {
        throw new Error(t("onboarding.responsible.codeValidationError"));
      }
    } catch (error) {
      console.error("Code validation error:", error);
      const errorMessage = error instanceof Error ? error.message : t("onboarding.responsible.codeValidationError");
      const translated = translateAuthError(errorMessage);
      setVerificationError(translated);
      toast.error(translated);
    } finally {
      setAuthLoading(false);
    }
  };

  const goToNextStep = () => {
    if (step === 2 && !validatePassword()) {
      return;
    }
    if (step === 2) {
      if (!formData.email || emailError) {
        setEmailError(t("onboarding.responsible.emailInvalid"));
        return;
      }
      if (!authVerified) {
        toast.error(t("onboarding.responsible.confirmCodeToContinue"));
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, steps.length));
  };

  const goToPreviousStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (!authVerified) {
        toast.error(t("onboarding.common.confirmCodeFirst"));
        return;
      }

      const cleanedTaxId = formData.taxId ? formData.taxId.replace(/\D/g, "") : undefined;
      const taxIdConfig = TAX_ID_CONFIG[formData.country];
      const monthlyRevenueValue = parseFloat(formData.monthlyRevenue || "0") || 0;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t("onboarding.common.sessionInvalid"));
        return;
      }

      const profileUpdate: Record<string, any> = {
        full_name: formData.name,
        user_type: "pessoa_juridica",
        company_name: formData.companyName,
      };

      if (cleanedTaxId && taxIdConfig) {
        const { data: encryptedTaxId, error: encryptError } = await supabase.rpc("encrypt_sensitive", {
          data: cleanedTaxId,
        });
        if (encryptError) throw encryptError;
        profileUpdate.cnpj_encrypted = encryptedTaxId;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      if (profileError) throw profileError;

      const { data: ensuredCompanyId, error: ensureError } = await supabase.rpc("pg_ensure_company_for_user", {
        payload: {
          company_name: formData.companyName || formData.name,
          cnpj: (formData.country === "BR" && cleanedTaxId) ? cleanedTaxId : null,
          monthly_revenue: monthlyRevenueValue,
        },
      });

      if (ensureError) throw ensureError;

      if (ensuredCompanyId) {
        // Save the browser timezone so cost reminders use the correct local date
        const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (browserTz) {
          await supabase
            .from('companies')
            .update({ timezone: browserTz })
            .eq('id', ensuredCompanyId);
        }

        for (const cost of formData.fixedCosts) {
          const parsedAmount = parseFloat(cost.value);
          if (!cost.name.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            continue;
          }

          const { error: companyCostError } = await supabase.from("company_fixed_costs").insert({
            company_id: ensuredCompanyId,
            description: cost.name,
            amount: parsedAmount,
          });

          if (companyCostError) {
            console.error("Fixed cost creation error:", companyCostError);
          }
        }
      }

      await refreshCompanyMemberships();
      toast.success(t("onboarding.common.accountCreated"));
      sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
      setCompletedCompanyId(ensuredCompanyId ?? null);
      setStep(5);
    } catch (error) {
      console.error("Account creation error:", error);
      const errorMessage = error instanceof Error ? error.message : t("onboarding.common.accountCreateError");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWhatsAppLink = async () => {
    if (whatsappLoading) return;
    setWhatsappLoading(true);
    setWhatsappError("");
    try {
      if (!completedCompanyId) {
        throw new Error(t("onboarding.whatsapp.companyNotFound"));
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed?.session) {
          throw new Error(t("onboarding.common.sessionExpired"));
        }
      }

      const link = await createWhatsAppLink(completedCompanyId);
      setWhatsappLink(link);
      toast.success(t("onboarding.whatsapp.codeGenerated"));
    } catch (error) {
      console.error("WhatsApp code generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Error";
      if (isInvalidJwtError(error)) {
        const message = error instanceof Error ? error.message : "Invalid JWT";
        setWhatsappError(t("onboarding.whatsapp.invalidJwt"));
        toast.error(message);
        return;
      }
      if (isAuthError(error)) {
        await handleAuthExpired();
        return;
      }
      setWhatsappError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleFinishOnboarding = () => {
    navigate("/company/dashboard");
  };

  const handleAuthExpired = async () => {
    await supabase.auth.signOut();
    toast.error(t("onboarding.common.sessionExpired"));
    navigate("/login");
  };

  const isInvalidJwtError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /invalid jwt/i.test(message);
  };

  const isAuthError = (error: unknown) => {
    if (isInvalidJwtError(error)) return false;
    const message = error instanceof Error ? error.message : String(error ?? "");
    return /jwt expired|not authenticated/i.test(message);
  };

  useEffect(() => {
    if (
      step === 5 &&
      completedCompanyId &&
      !whatsappLink &&
      !whatsappLoading &&
      !whatsappAutoAttempted
    ) {
      setWhatsappAutoAttempted(true);
      handleGenerateWhatsAppLink();
    }
  }, [
    step,
    completedCompanyId,
    whatsappLink,
    whatsappLoading,
    whatsappAutoAttempted,
  ]);

  const isPasswordValid = formData.password.length >= 6 && formData.password === formData.confirmPassword;
  const isContactValid = Boolean(formData.email) && !emailError;
  const taxIdConfig = TAX_ID_CONFIG[formData.country];
  const whatsappExpiryLabel = whatsappLink?.expiresAt
    ? new Date(whatsappLink.expiresAt).toLocaleString(formData.country === "BR" ? "pt-BR" : "en-US")
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((item, index) => (
              <div key={item.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-smooth ${
                      step > item.number
                        ? "bg-success text-success-foreground"
                        : step === item.number
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > item.number ? <Check className="h-5 w-5" /> : item.number}
                  </div>
                  <span className="text-xs mt-2 text-center hidden sm:block">{item.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 transition-smooth ${step > item.number ? "bg-success" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card className="p-8 shadow-lg">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.welcome.title")}</h2>
                <p className="text-muted-foreground mb-6">
                  {t("onboarding.welcome.description")}
                </p>

                <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <div className="font-semibold text-foreground">{t("onboarding.welcome.profileLabel")}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("onboarding.welcome.profileDescription")}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <Button onClick={goToNextStep} className="gap-2">
                    {t("onboarding.common.continue")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.responsible.title")}</h2>
                <p className="text-muted-foreground mb-6">{t("onboarding.responsible.description")}</p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">{t("onboarding.responsible.fullName")}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={t("onboarding.responsible.fullNamePlaceholder")}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">{t("onboarding.responsible.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder={t("onboarding.responsible.emailPlaceholder")}
                      className={emailError ? "border-danger" : ""}
                    />
                    {emailError && (
                      <div className="flex items-center gap-2 text-xs text-danger mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {emailError}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">{t("onboarding.responsible.password")}</Label>
                      <PasswordInput
                        id="password"
                        value={formData.password}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={t("onboarding.responsible.passwordPlaceholder")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">{t("onboarding.responsible.confirmPassword")}</Label>
                      <PasswordInput
                        id="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder={t("onboarding.responsible.passwordPlaceholder")}
                      />
                    </div>
                  </div>
                  {passwordError && (
                    <div className="flex items-center gap-2 text-xs text-danger">
                      <AlertCircle className="h-3 w-3" />
                      {passwordError}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <Button
                      type="button"
                      onClick={handleSendVerification}
                      disabled={!isPasswordValid || !isContactValid || authVerified || authLoading}
                      className="sm:w-auto"
                    >
                      {verificationSent ? t("onboarding.responsible.resendCode") : t("onboarding.responsible.sendCode")}
                    </Button>
                    {authVerified && (
                      <span className="text-sm text-success">{t("onboarding.responsible.codeConfirmed")} ✔</span>
                    )}
                  </div>

                  {verificationSent && !authVerified && (
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">{t("onboarding.responsible.verificationCode")}</Label>
                      <Input
                        id="verificationCode"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder={t("onboarding.responsible.verificationCodePlaceholder")}
                      />
                      {verificationError && (
                        <div className="flex items-center gap-2 text-xs text-danger">
                          <AlertCircle className="h-3 w-3" />
                          {verificationError}
                        </div>
                      )}
                      <Button type="button" variant="secondary" onClick={handleVerifyCode} disabled={authLoading}>
                        {t("onboarding.responsible.validateCode")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("onboarding.common.back")}
                  </Button>
                  <Button onClick={goToNextStep} className="gap-2" disabled={!authVerified}>
                    {t("onboarding.common.next")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.company.title")}</h2>
                <p className="text-muted-foreground mb-6">
                  {t("onboarding.company.description")}
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">{t("onboarding.company.companyName")}</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                      placeholder={t("onboarding.company.companyNamePlaceholder")}
                    />
                  </div>

                  <div>
                    <Label htmlFor="country">{t("onboarding.company.country")}</Label>
                    <Select value={formData.country} onValueChange={(v) => handleCountryChange(v as BusinessCountry)}>
                      <SelectTrigger id="country">
                        <SelectValue placeholder={t("onboarding.company.countryPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BR">{t("onboarding.company.countryBR")}</SelectItem>
                        <SelectItem value="US">{t("onboarding.company.countryUS")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {taxIdConfig && (
                    <div>
                      <Label htmlFor="taxId">
                        {t(`onboarding.company.${taxIdConfig.key}`)}{" "}
                        <span className="text-muted-foreground font-normal">{t("onboarding.company.taxIdOptional")}</span>
                      </Label>
                      <InputMask
                        mask={taxIdConfig.mask}
                        value={formData.taxId}
                        onChange={(e) => handleTaxIdChange(e.target.value)}
                      >
                        {(inputProps: any) => (
                          <Input
                            {...inputProps}
                            id="taxId"
                            placeholder={t(`onboarding.company.${taxIdConfig.key}Placeholder`)}
                            className={taxIdError ? "border-danger" : ""}
                          />
                        )}
                      </InputMask>
                      {taxIdError && (
                        <div className="flex items-center gap-2 text-xs text-danger mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {taxIdError}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="monthlyRevenue">
                      {t("onboarding.company.monthlyRevenue")} ({formData.country === "BR" ? "R$" : "$"})
                    </Label>
                    <Input
                      id="monthlyRevenue"
                      type="text"
                      value={formatDecimalToDisplay(formData.monthlyRevenue)}
                      onChange={(e) => handleMonthlyRevenueChange(e.target.value)}
                      placeholder={t("onboarding.company.monthlyRevenuePlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("onboarding.company.monthlyRevenueHint")}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("onboarding.common.back")}
                  </Button>
                  <Button onClick={goToNextStep} className="gap-2">
                    {t("onboarding.common.next")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.fixedCosts.title")}</h2>
                <p className="text-muted-foreground mb-4">
                  {t("onboarding.fixedCosts.description")}{" "}
                  <span className="font-semibold">{t("onboarding.fixedCosts.descriptionCol")}</span> e <span className="font-semibold">{t("onboarding.fixedCosts.valueCol")}</span>.
                </p>

                <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{t("onboarding.fixedCosts.importCsv")}</p>
                    <input
                      type="file"
                      accept=".csv"
                      id="onboarding-csv-upload"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (loadEvent) => {
                          const text = loadEvent.target?.result as string;
                          const lines = text.split("\n").filter((line) => line.trim());
                          if (lines.length < 2) return;

                          const header = lines[0].split(/[,;]/).map((column) => column.toLowerCase().trim());
                          const descIdx = header.findIndex((h) => h.includes("descri") || h.includes("nome"));
                          const amountIdx = header.findIndex((h) => h.includes("valor") || h.includes("amount"));

                          if (descIdx === -1 || amountIdx === -1) {
                            toast.error(t("onboarding.fixedCosts.importCsvInvalid"));
                            return;
                          }

                          const newCosts: FixedCost[] = [];
                          for (let i = 1; i < lines.length; i++) {
                            const row = lines[i].split(/[,;]/);
                            const name = row[descIdx]?.trim();
                            const value = row[amountIdx]?.trim().replace(/[^\d,.-]/g, "").replace(",", ".");
                            if (name && value) {
                              newCosts.push(createFixedCost({ name, value }));
                            }
                          }

                          setFormData((prev) => ({
                            ...prev,
                            fixedCosts: [...prev.fixedCosts, ...newCosts],
                          }));
                          toast.success(t("onboarding.fixedCosts.importCsvSuccess", { count: newCosts.length }));
                        };
                        reader.readAsText(file);
                        event.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("onboarding-csv-upload")?.click()}
                    >
                      <Upload className="h-3 w-3 mr-2" />
                      {t("onboarding.fixedCosts.importCsvButton")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("onboarding.fixedCosts.importCsvFormat")}</p>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 -mr-2 scrollbar-thin">
                  {formData.fixedCosts.map((cost, index) => (
                    <div key={cost.id} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          value={cost.name}
                          onChange={(e) => updateFixedCost(index, "name", e.target.value)}
                          placeholder={t("onboarding.fixedCosts.costNamePlaceholder")}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="text"
                          value={formatDecimalToDisplay(cost.value)}
                          onChange={(e) => updateFixedCost(index, "value", e.target.value)}
                          placeholder={t("onboarding.fixedCosts.costValuePlaceholder")}
                        />
                      </div>
                      <Button variant="outline" size="icon" onClick={() => removeFixedCost(index)} className="flex-shrink-0">
                        ×
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" onClick={addFixedCost} className="w-full mt-4 gap-2">
                  <Receipt className="h-4 w-4" />
                  {t("onboarding.fixedCosts.addFixedCost")}
                </Button>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    {t("onboarding.common.back")}
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleComplete} className="gap-2" disabled={loading}>
                      {loading ? t("onboarding.fixedCosts.creatingAccount") : t("onboarding.fixedCosts.skipAndFinish")}
                    </Button>
                    <Button
                      onClick={handleComplete}
                      className="gap-2"
                      disabled={
                        loading ||
                        formData.fixedCosts.length === 0 ||
                        formData.fixedCosts.some(
                          (cost) => !cost.name.trim() || Number.parseFloat(cost.value || "0") <= 0,
                        )
                      }
                    >
                      {loading ? t("onboarding.fixedCosts.creatingAccount") : t("onboarding.fixedCosts.finish")}
                      {!loading && <Check className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.whatsapp.title")}</h2>
                <p className="text-muted-foreground mb-6">
                  {t("onboarding.whatsapp.description")}
                </p>

                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="h-6 w-6 text-primary mt-1" />
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>{t("onboarding.whatsapp.step1")}</p>
                      <p>
                        {t("onboarding.whatsapp.step2")}{' '}
                        <a
                          href="https://wa.me/556132462163"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline"
                        >
                          +55 61 3246-2163
                        </a>
                      </p>
                      <p>{t("onboarding.whatsapp.step3")}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {whatsappLink ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">{t("onboarding.whatsapp.yourCode")}</p>
                      <div className="text-2xl font-mono tracking-widest text-primary">
                        {whatsappLink.code}
                      </div>
                      {whatsappExpiryLabel && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {t("onboarding.whatsapp.expiresAt", { time: whatsappExpiryLabel })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("onboarding.whatsapp.noCodeYet")}
                    </p>
                  )}

                  {whatsappError && (
                    <div className="flex items-center gap-2 text-xs text-danger">
                      <AlertCircle className="h-3 w-3" />
                      {whatsappError}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center mt-8">
                  <Button
                    onClick={handleGenerateWhatsAppLink}
                    disabled={whatsappLoading}
                    className="gap-2"
                  >
                    {whatsappLoading ? t("onboarding.whatsapp.generating") : whatsappLink ? t("onboarding.whatsapp.generateNew") : t("onboarding.whatsapp.generate")}
                  </Button>
                  <Button variant="outline" onClick={handleFinishOnboarding}>
                    {t("onboarding.whatsapp.goToDashboard")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
