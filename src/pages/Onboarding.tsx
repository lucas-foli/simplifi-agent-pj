import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Check, Receipt, Upload } from "lucide-react";
import { useState } from "react";
import InputMask from "react-input-mask";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
// import { branding } from "@/config/branding";

const steps = [
  { number: 1, title: "Bem-vindo" },
  { number: 2, title: "Responsável" },
  { number: 3, title: "Empresa" },
  { number: 4, title: "Custos Fixos" },
];

type FixedCost = { name: string; value: string };

const Onboarding = () => {
  const navigate = useNavigate();
  const { signUp, refreshCompanyMemberships } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

  const addFixedCost = () => {
    setFormData((prev) => ({
      ...prev,
      fixedCosts: [...prev.fixedCosts, { name: "", value: "0" }],
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

  const goToNextStep = () => {
    if (step === 2 && !validatePassword()) {
      return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length));
  };

  const goToPreviousStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const cleanedCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, "") : undefined;
      const monthlyRevenueValue = parseFloat(formData.monthlyRevenue || "0") || 0;

      const result = await signUp(formData.email, formData.password, {
        name: formData.name,
        company_name: formData.companyName,
        cnpj: cleanedCnpj,
        monthly_revenue: monthlyRevenueValue,
      });

      if (!result) {
        toast.success("Verifique seu email para confirmar a conta!");
        navigate("/login");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

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
      navigate("/company/dashboard");
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao criar conta";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
                              newCosts.push({ name, value });
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
                    <div key={`${cost.name}-${index}`} className="flex gap-2">
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
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
