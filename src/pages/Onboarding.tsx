import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, DollarSign, Receipt, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState<"pf" | "pj">("pf");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyName: "",
    cnpj: "",
    monthlyIncome: "",
    fixedCosts: [] as { name: string; value: string }[],
  });

  const addFixedCost = () => {
    setFormData(prev => ({
      ...prev,
      fixedCosts: [...prev.fixedCosts, { name: "", value: "" }]
    }));
  };

  const updateFixedCost = (index: number, field: "name" | "value", value: string) => {
    setFormData(prev => ({
      ...prev,
      fixedCosts: prev.fixedCosts.map((cost, i) => 
        i === index ? { ...cost, [field]: value } : cost
      )
    }));
  };

  const removeFixedCost = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fixedCosts: prev.fixedCosts.filter((_, i) => i !== index)
    }));
  };

  const handleComplete = () => {
    // Save to localStorage for demo
    localStorage.setItem("userType", userType);
    localStorage.setItem("onboardingData", JSON.stringify(formData));
    navigate("/dashboard");
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
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="seu@email.com"
                    />
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
                        <Input
                          id="cnpj"
                          value={formData.cnpj}
                          onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                          placeholder="00.000.000/0000-00"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between mt-8">
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} className="gap-2" disabled={!formData.name || !formData.email}>
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
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="monthlyIncome"
                        type="number"
                        value={formData.monthlyIncome}
                        onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                        placeholder="5000.00"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Você poderá ajustar este valor depois
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
                <p className="text-muted-foreground mb-6">
                  {userType === "pf" 
                    ? "Adicione suas despesas fixas mensais (aluguel, contas, etc.)" 
                    : "Adicione os custos fixos da empresa"}
                </p>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
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
                          type="number"
                          value={cost.value}
                          onChange={(e) => updateFixedCost(index, "value", e.target.value)}
                          placeholder="Valor"
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
                  <Button onClick={handleComplete} className="gap-2">
                    Finalizar
                    <Check className="h-4 w-4" />
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
