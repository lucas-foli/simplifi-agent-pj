import { useState } from "react";
import InputMask from "react-input-mask";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, DollarSign, Receipt, ArrowRight, ArrowLeft, Check, AlertCircle, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSetMonthlyIncome, useCreateFixedCost } from "@/hooks/useFinancialData";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<"pf" | "pj">("pf");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    cnpj: "",
    monthlyIncome: "",
    fixedCosts: [] as { name: string; value: string }[],
  });
  const [emailError, setEmailError] = useState("");
  const [cnpjError, setCnpjError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, refreshCompanyMemberships } = useAuth();
  const setMonthlyIncome = useSetMonthlyIncome();
  const createFixedCost = useCreateFixedCost();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/\D/g, "");
    return cleanCNPJ.length === 14;
  };

  const handleEmailChange = (value: string) => {
    setFormData({ ...formData, email: value });
    if (value && !validateEmail(value)) {
      setEmailError("Email inválido");
    } else {
      setEmailError("");
    }
  };

  const handleCNPJChange = (value: string) => {
    setFormData({ ...formData, cnpj: value });
    if (value && !validateCNPJ(value)) {
      setCnpjError("CNPJ deve conter 14 dígitos");
    } else {
      setCnpjError("");
    }
  };

  // Format raw numbers (e.g., "12345") to display (e.g., "123,45")
  const formatCurrencyInput = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "";
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse raw numbers to decimal string (e.g., "12345" -> "123.45")
  const parseCurrencyToDecimal = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return "0";
    return (parseFloat(numbers) / 100).toString();
  };

  // Format decimal string to display (e.g., "123.45" -> "123,45")
  const formatDecimalToDisplay = (decimal: string): string => {
    if (!decimal || decimal === "0") return "";
    const amount = parseFloat(decimal);
    return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleMonthlyIncomeChange = (value: string) => {
    setFormData({ ...formData, monthlyIncome: parseCurrencyToDecimal(value) });
  };

  const addFixedCost = () => {
    setFormData(prev => ({
      ...prev,
      fixedCosts: [...prev.fixedCosts, { name: "", value: "0" }]
    }));
  };

  const updateFixedCost = (index: number, field: "name" | "value", value: string) => {
    if (field === "value") {
      // Store as decimal string (e.g., "123.45")
      setFormData(prev => ({
        ...prev,
        fixedCosts: prev.fixedCosts.map((cost, i) => 
          i === index ? { ...cost, [field]: parseCurrencyToDecimal(value) } : cost
        )
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        fixedCosts: prev.fixedCosts.map((cost, i) => 
          i === index ? { ...cost, [field]: value } : cost
        )
      }));
    }
  };

  const removeFixedCost = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fixedCosts: prev.fixedCosts.filter((_, i) => i !== index)
    }));
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const cleanedCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, "") : undefined;
      const monthlyRevenueRaw = formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : 0;
      const monthlyRevenueValue = Number.isFinite(monthlyRevenueRaw) ? monthlyRevenueRaw : 0;

      // Create user account
      const result = await signUp(formData.email, formData.password, {
        name: formData.name,
        user_type: userType,
        company_name: userType === "pj" ? formData.companyName : undefined,
        cnpj: userType === "pj" ? cleanedCnpj : undefined,
        monthly_revenue: userType === "pj" ? monthlyRevenueValue : undefined,
      });

      // Check if email confirmation is required
      if (!result) {
        toast.success('Verifique seu email para confirmar a conta!');
        navigate('/login');
        return;
      }

      // Wait for the session to be established and triggers to execute
      // (profile creation + default categories creation)
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (userType === "pf") {
        // Save monthly income to profile
        try {
          console.log('Salvando receita mensal:', formData.monthlyIncome);
          await setMonthlyIncome.mutateAsync(parseFloat(formData.monthlyIncome));

          // Save fixed costs
          console.log('Salvando custos fixos:', formData.fixedCosts);
          for (const cost of formData.fixedCosts) {
            if (cost.name && cost.value && parseFloat(cost.value) > 0) {
              console.log('Criando custo fixo:', { description: cost.name, amount: parseFloat(cost.value) });
              await createFixedCost.mutateAsync({
                description: cost.name,
                amount: parseFloat(cost.value),
              });
            }
          }
          console.log('Todos os custos fixos foram salvos com sucesso');
        } catch (dataError) {
          console.error('Erro ao salvar dados:', dataError);
          // Continue anyway, user can add data later
          toast.warning('Conta criada, mas alguns dados não foram salvos');
        }
      } else if (userType === "pj") {
        try {
          const { data: ensuredCompanyId, error: ensureError } = await supabase.rpc('pg_ensure_company_for_user', {
            payload: {
              company_name: formData.companyName || formData.name,
              cnpj: cleanedCnpj || null,
              monthly_revenue: monthlyRevenueValue,
            },
          });

          if (ensureError) throw ensureError;

          if (ensuredCompanyId) {
            console.log('Empresa vinculada ao usuário:', ensuredCompanyId);

            for (const cost of formData.fixedCosts) {
              if (cost.name && cost.value && parseFloat(cost.value) > 0) {
                console.log('Criando custo fixo empresarial:', { description: cost.name, amount: parseFloat(cost.value) });
                const { error: companyCostError } = await supabase
                  .from('company_fixed_costs')
                  .insert({
                    company_id: ensuredCompanyId,
                    description: cost.name,
                    amount: parseFloat(cost.value),
                  });

                if (companyCostError) {
                  console.error('Erro ao criar custo fixo empresarial:', companyCostError);
                }
              }
            }
          }

          await refreshCompanyMemberships();
        } catch (companyDataError) {
          console.error('Erro ao configurar dados da empresa:', companyDataError);
          toast.warning('Conta criada, mas alguns dados da empresa não foram salvos');
        }
      }

      toast.success('Conta criada com sucesso!');
      navigate(userType === "pj" ? "/company/dashboard" : "/dashboard");
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conta';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = () => {
    if (formData.password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const steps = [
    { number: 1, title: "Tipo de Conta" },
    { number: 2, title: "Informações" },
    { number: 3, title: "Receita Mensal" },
    { number: 4, title: "Custos Fixos" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold transition-smooth ${
                    step > s.number ? "bg-success text-success-foreground" :
                    step === s.number ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {step > s.number ? <Check className="h-5 w-5" /> : s.number}
                  </div>
                  <span className="text-xs mt-2 text-center hidden sm:block">{s.title}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`h-1 flex-1 mx-2 transition-smooth ${
                    step > s.number ? "bg-success" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <Card className="p-8 shadow-lg">
          <AnimatePresence mode="wait">
            {/* Step 1: User Type */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo ao SimplifiQA!</h2>
                <p className="text-muted-foreground mb-6">Selecione o tipo de conta que deseja criar</p>
                
                <RadioGroup value={userType} onValueChange={(v) => setUserType(v as "pf" | "pj")}>
                  <div className="space-y-4">
                    <Label
                      htmlFor="pf"
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-smooth ${
                        userType === "pf" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="pf" id="pf" />
                      <User className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">Pessoa Física</div>
                        <div className="text-sm text-muted-foreground">
                          Para controle financeiro pessoal
                        </div>
                      </div>
                    </Label>

                    <Label
                      htmlFor="pj"
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-smooth ${
                        userType === "pj" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <RadioGroupItem value="pj" id="pj" />
                      <Building2 className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">Pessoa Jurídica</div>
                        <div className="text-sm text-muted-foreground">
                          Para empresas, MEI, LTDA
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                <div className="flex justify-end mt-8">
                  <Button onClick={() => setStep(2)} className="gap-2">
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Information */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">Informações Básicas</h2>
                <p className="text-muted-foreground mb-6">Preencha seus dados para começar</p>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">{userType === "pf" ? "Nome Completo" : "Nome do Responsável"}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      <div className="flex items-center gap-1 mt-1 text-danger text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>{emailError}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className={passwordError ? "border-danger" : ""}
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Digite a senha novamente"
                      className={passwordError ? "border-danger" : ""}
                    />
                    {passwordError && (
                      <div className="flex items-center gap-1 mt-1 text-danger text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                  </div>

                  {userType === "pj" && (
                    <>
                      <div>
                        <Label htmlFor="companyName">Nome da Empresa</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                          placeholder="Razão social"
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
                          <div className="flex items-center gap-1 mt-1 text-danger text-xs">
                            <AlertCircle className="h-3 w-3" />
                            <span>{cnpjError}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (validatePassword()) {
                        setStep(3);
                      }
                    }} 
                    className="gap-2" 
                    disabled={
                      !formData.name || 
                      !formData.email || 
                      !formData.password ||
                      !formData.confirmPassword ||
                      !!emailError ||
                      (userType === "pj" && (!formData.companyName || !formData.cnpj || !!cnpjError))
                    }
                  >
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Monthly Income */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">Receita Mensal</h2>
                <p className="text-muted-foreground mb-6">
                  {userType === "pf" 
                    ? "Qual é sua renda mensal?" 
                    : "Qual é o faturamento mensal médio da empresa?"}
                </p>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="monthlyIncome">Valor Mensal (R$)</Label>
                    <div className="relative transition-transform duration-200 focus-within:scale-105">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none z-10">R$</span>
                      <Input
                        id="monthlyIncome"
                        type="text"
                        value={formatDecimalToDisplay(formData.monthlyIncome)}
                        onChange={(e) => handleMonthlyIncomeChange(e.target.value)}
                        placeholder="5.000,00"
                        className="pl-10 focus-visible:scale-100"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use vírgula para decimais (ex: 5.000,00)
                    </p>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={() => setStep(4)} className="gap-2" disabled={!formData.monthlyIncome}>
                    Continuar
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Fixed Costs */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">Custos Fixos</h2>
                <p className="text-muted-foreground mb-4">
                  {userType === "pf" 
                    ? "Adicione suas despesas fixas mensais (aluguel, contas, etc.)" 
                    : "Adicione os custos fixos da empresa"}
                </p>
                
                {/* Import CSV Option */}
                <div className="mb-4 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Importar de CSV</p>
                    <input
                      type="file"
                      accept=".csv"
                      id="onboarding-csv-upload"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const text = event.target?.result as string;
                          const lines = text.split('\n').filter(l => l.trim());
                          
                          if (lines.length < 2) return;
                          
                          const header = lines[0].split(/[,;]/).map(h => h.toLowerCase().trim());
                          const descIdx = header.findIndex(h => h.includes('descri') || h.includes('nome'));
                          const amountIdx = header.findIndex(h => h.includes('valor') || h.includes('amount'));
                          
                          if (descIdx === -1 || amountIdx === -1) {
                            toast.error('CSV inválido. Use: descrição,valor');
                            return;
                          }
                          
                          const newCosts: { name: string; value: string }[] = [];
                          for (let i = 1; i < lines.length; i++) {
                            const row = lines[i].split(/[,;]/);
                            const name = row[descIdx]?.trim();
                            const value = row[amountIdx]?.trim().replace(/[^\d,.-]/g, '').replace(',', '.');
                            if (name && value) {
                              newCosts.push({ name, value });
                            }
                          }
                          
                          setFormData(prev => ({
                            ...prev,
                            fixedCosts: [...prev.fixedCosts, ...newCosts]
                          }));
                          toast.success(`${newCosts.length} custo(s) importado(s)!`);
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('onboarding-csv-upload')?.click()}
                    >
                      <Upload className="h-3 w-3 mr-2" />
                      Importar CSV
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: descrição,valor (ex: Aluguel,1500.00)
                  </p>
                </div>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 -mr-2 scrollbar-thin">
                  {formData.fixedCosts.map((cost, index) => (
                    <div key={index} className="flex gap-2">
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
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeFixedCost(index)}
                        className="flex-shrink-0"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={addFixedCost}
                  className="w-full mt-4 gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Adicionar Custo Fixo
                </Button>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep(3)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleComplete} 
                    className="gap-2"
                    disabled={loading}
                  >
                    {loading ? 'Criando conta...' : 'Pular e Finalizar'}
                  </Button>
                  <Button 
                    onClick={handleComplete} 
                    className="gap-2"
                    disabled={
                      loading ||
                      formData.fixedCosts.length === 0 || 
                      formData.fixedCosts.some(cost => !cost.name.trim() || parseFloat(cost.value) === 0)
                    }
                  >
                    {loading ? 'Criando conta...' : 'Finalizar'}
                    {!loading && <Check className="h-4 w-4" />}
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
