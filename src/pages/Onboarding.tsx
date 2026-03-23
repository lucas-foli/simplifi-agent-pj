import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, MessageCircle, Receipt, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import InputMask from "react-input-mask";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { createWhatsAppLink, type WhatsAppLinkResponse } from "@/lib/whatsapp";
// import { branding } from "@/config/branding";

const steps = [
  { number: 1, title: "Bem-vindo" },
  { number: 2, title: "Responsável" },
  { number: 3, title: "Empresa" },
  { number: 4, title: "Custos Fixos" },
  { number: 5, title: "WhatsApp" },
];

type FixedCost = { id: string; name: string; value: string };

const Onboarding = () => {
  const navigate = useNavigate();
  const { signUp, refreshCompanyMemberships } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");
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
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    cnpj: "",
    monthlyRevenue: "",
    fixedCosts: [] as FixedCost[],
  });

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailChange = (value: string) => {
    setFormData((prev) => ({ ...prev, email: value }));
    setEmailError(value && !validateEmail(value) ? "Email inválido" : "");
    if (verificationSent) resetVerification();
  };

  const handleCNPJChange = (value: string) => {
    setFormData((prev) => ({ ...prev, cnpj: value }));
    const clean = value.replace(/\D/g, "");
    setCnpjError(clean && clean.length !== 14 ? "CNPJ deve conter 14 dígitos" : "");
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
      setPasswordError("A senha deve ter pelo menos 6 caracteres");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError("As senhas não coincidem");
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
      setEmailError("Email inválido");
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
        toast.success("Código reenviado para seu email.");
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
        toast.success("Autenticação concluída!");
        return;
      }

      toast.success("Enviamos um código para seu email.");
    } catch (error) {
      console.error("Erro ao enviar código:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao enviar código";
      toast.error(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (authLoading) return;
    if (!verificationCode.trim()) {
      setVerificationError("Informe o código recebido");
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
        toast.success("Conta confirmada com sucesso!");
      } else {
        throw new Error("Não foi possível confirmar o código.");
      }
    } catch (error) {
      console.error("Erro ao validar código:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao validar código";
      setVerificationError(errorMessage);
      toast.error(errorMessage);
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
        setEmailError("Email inválido");
        return;
      }
      if (!authVerified) {
        toast.error("Confirme o código enviado para continuar.");
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
        toast.error("Confirme o código de autenticação antes de continuar.");
        return;
      }

      const cleanedCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, "") : undefined;
      const monthlyRevenueValue = parseFloat(formData.monthlyRevenue || "0") || 0;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Sessão inválida. Confirme o código novamente.");
        return;
      }

      const profileUpdate: Record<string, any> = {
        full_name: formData.name,
        user_type: "pessoa_juridica",
        company_name: formData.companyName,
      };

      if (cleanedCnpj) {
        const { data: encryptedCnpj, error: encryptError } = await supabase.rpc("encrypt_sensitive", {
          data: cleanedCnpj,
        });
        if (encryptError) throw encryptError;
        profileUpdate.cnpj_encrypted = encryptedCnpj;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);

      if (profileError) throw profileError;

      const { data: ensuredCompanyId, error: ensureError } = await supabase.rpc("pg_ensure_company_for_user", {
        payload: {
          company_name: formData.companyName || formData.name,
          cnpj: cleanedCnpj || null,
          monthly_revenue: monthlyRevenueValue,
        },
      });

      if (ensureError) throw ensureError;

      if (ensuredCompanyId) {
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
            console.error("Erro ao criar custo fixo empresarial:", companyCostError);
          }
        }
      }

      await refreshCompanyMemberships();
      toast.success("Conta criada com sucesso!");
      setCompletedCompanyId(ensuredCompanyId ?? null);
      setStep(5);
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao criar conta";
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
        throw new Error("Não foi possível identificar a empresa para vincular o WhatsApp.");
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed?.session) {
          throw new Error("Sessão expirada. Faça login novamente.");
        }
      }

      const link = await createWhatsAppLink(completedCompanyId);
      setWhatsappLink(link);
      toast.success("Código gerado! Envie no WhatsApp para concluir o vínculo.");
    } catch (error) {
      console.error("Erro ao gerar código WhatsApp:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao gerar código";
      if (isInvalidJwtError(error)) {
        const message = error instanceof Error ? error.message : "JWT inválido";
        setWhatsappError(
          "JWT inválido para este projeto. Verifique VITE_SUPABASE_URL/ANON_KEY do PJ."
        );
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
    toast.error("Sessão expirada. Faça login novamente.");
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
  const whatsappExpiryLabel = whatsappLink?.expiresAt
    ? new Date(whatsappLink.expiresAt).toLocaleString("pt-BR")
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao SimplifiQA!</h2>
                {/* <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao {branding.brandName}!</h2> */}
                <p className="text-muted-foreground mb-6">
                  Este fluxo é dedicado a negócios que desejam organizar suas finanças com mais clareza.
                </p>

                <div className="flex items-center gap-4 p-4 rounded-lg border-2 border-primary bg-primary/5">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <div className="font-semibold text-foreground">Perfil empresarial</div>
                    <div className="text-sm text-muted-foreground">
                      Configure o acesso do responsável, cadastre os dados da empresa e seus custos recorrentes.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-8">
                  <Button onClick={goToNextStep} className="gap-2">
                    Continuar
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Dados do responsável</h2>
                <p className="text-muted-foreground mb-6">Essas informações serão usadas para o acesso ao sistema.</p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Seu nome"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="seu@email.com"
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
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="********"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirme a senha</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="********"
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
                      {verificationSent ? "Reenviar código" : "Enviar código"}
                    </Button>
                    {authVerified && (
                      <span className="text-sm text-success">Código confirmado ✔</span>
                    )}
                  </div>

                  {verificationSent && !authVerified && (
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">Código de autenticação</Label>
                      <Input
                        id="verificationCode"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Digite o código recebido"
                      />
                      {verificationError && (
                        <div className="flex items-center gap-2 text-xs text-danger">
                          <AlertCircle className="h-3 w-3" />
                          {verificationError}
                        </div>
                      )}
                      <Button type="button" variant="secondary" onClick={handleVerifyCode} disabled={authLoading}>
                        Validar código
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={goToNextStep} className="gap-2" disabled={!authVerified}>
                    Avançar
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Informações da empresa</h2>
                <p className="text-muted-foreground mb-6">
                  Preencha os dados básicos do negócio para personalizar a experiência.
                </p>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="companyName">Nome da empresa</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Minha Empresa LTDA"
                    />
                  </div>

                  <div>
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <InputMask
                      mask="99.999.999/9999-99"
                      value={formData.cnpj}
                      onChange={(e) => handleCNPJChange(e.target.value)}
                    >
                      {(inputProps: any) => (
                        <Input
                          {...inputProps}
                          id="cnpj"
                          placeholder="00.000.000/0000-00"
                          className={cnpjError ? "border-danger" : ""}
                        />
                      )}
                    </InputMask>
                    {cnpjError && (
                      <div className="flex items-center gap-2 text-xs text-danger mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {cnpjError}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="monthlyRevenue">Faturamento médio mensal (R$)</Label>
                    <Input
                      id="monthlyRevenue"
                      type="text"
                      value={formatDecimalToDisplay(formData.monthlyRevenue)}
                      onChange={(e) => handleMonthlyRevenueChange(e.target.value)}
                      placeholder="10.000,00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Usamos essa informação para estimar metas e projeções financeiras.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={goToNextStep} className="gap-2">
                    Avançar
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Custos fixos</h2>
                <p className="text-muted-foreground mb-4">
                  Adicione os compromissos recorrentes da empresa. Você pode importar de um CSV com colunas{" "}
                  <span className="font-semibold">descrição</span> e <span className="font-semibold">valor</span>.
                </p>

                <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Importar de CSV</p>
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
                            toast.error("CSV inválido. Use colunas descrição e valor.");
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
                          toast.success(`${newCosts.length} custo(s) importado(s)!`);
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
                      Importar CSV
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Formato: descrição,valor (ex: Aluguel,1500.00)</p>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 -mr-2 scrollbar-thin">
                  {formData.fixedCosts.map((cost, index) => (
                    <div key={cost.id} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          value={cost.name}
                          onChange={(e) => updateFixedCost(index, "name", e.target.value)}
                          placeholder="Nome (ex: Aluguel)"
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="text"
                          value={formatDecimalToDisplay(cost.value)}
                          onChange={(e) => updateFixedCost(index, "value", e.target.value)}
                          placeholder="0,00"
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
                  Adicionar custo fixo
                </Button>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={goToPreviousStep} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleComplete} className="gap-2" disabled={loading}>
                      {loading ? "Criando conta..." : "Pular e finalizar"}
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
                      {loading ? "Criando conta..." : "Finalizar"}
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
                <h2 className="text-2xl font-bold text-foreground mb-2">Conectar WhatsApp</h2>
                <p className="text-muted-foreground mb-6">
                  Gere um código de pareamento e envie no WhatsApp do SimplifiQA para concluir a conexão.
                </p>

                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="h-6 w-6 text-primary mt-1" />
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>1) Clique em “Gerar código”.</p>
                      <p>
                        2) Envie o código para o nosso WhatsApp:{' '}
                        <a
                          href="https://wa.me/556132462163"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline"
                        >
                          +55 61 3246-2163
                        </a>
                      </p>
                      <p>3) Aguarde a confirmação automática.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {whatsappLink ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <p className="text-xs text-muted-foreground mb-1">Seu código</p>
                      <div className="text-2xl font-mono tracking-widest text-primary">
                        {whatsappLink.code}
                      </div>
                      {whatsappExpiryLabel && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Expira em {whatsappExpiryLabel}.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum código gerado ainda.
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
                    {whatsappLoading ? "Gerando..." : whatsappLink ? "Gerar novo código" : "Gerar código"}
                  </Button>
                  <Button variant="outline" onClick={handleFinishOnboarding}>
                    Ir para o painel
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
