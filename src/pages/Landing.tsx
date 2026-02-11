import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { branding } from "@/config/branding";
import { ArrowRight, MessageSquare, TrendingUp, Shield, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "Controle Conversacional",
      description: "Registre receitas e despesas da empresa via WhatsApp ou chat com linguagem natural"
    },
    {
      icon: TrendingUp,
      title: "Saldo em Tempo Real",
      description: "Veja o impacto de cada gasto no fluxo de caixa da sua empresa, em tempo real"
    },
    {
      icon: Shield,
      title: "Seguro e Profissional",
      description: "Dados protegidos e relatórios prontos para contadores"
    },
    {
      icon: Zap,
      title: "Automação Inteligente",
      description: "Categorização automática e sugestões financeiras acionáveis"
    }
  ];

  const benefits = [
    "Sem planilhas complexas ou macros frágeis",
    "Classificação automática de despesas empresariais",
    "Alertas inteligentes de fluxo de caixa",
    "Integração com WhatsApp para toda a equipe",
    "Relatórios prontos para contadores e sócios",
    "Visão consolidada de contas a pagar e receber"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <img
              src={branding.logo.horizontal}
              alt={`${branding.brandName} logotipo`}
              className="h-8 w-auto object-contain"
            />
            <span className="text-xl font-bold text-foreground">{branding.brandName}</span>
          </motion.div>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Recursos</a>
            <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-smooth">Benefícios</a>
          </nav>
          <Link to="/auth">
            <Button variant="default" size="sm">
              Começar Agora
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight px-4">
              Seu Contador Digital
              <span className="block text-primary mt-2">Simples e Conversacional</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto px-4">
              Controle as finanças da sua empresa com linguagem natural. Registre movimentações via WhatsApp,
              acompanhe o caixa em tempo real e receba sugestões inteligentes sem depender de planilhas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-4">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="gap-2 shadow-primary w-full">
                  Começar Gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ver Demonstração
              </Button>
            </div>
          </motion.div>

          {/* Hero Image/Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16"
          >
            <Card className="p-4 sm:p-6 md:p-8 shadow-lg border-2">
              <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-background rounded-lg p-6 sm:p-8 min-h-[200px] sm:min-h-[250px] md:min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 sm:gap-3 bg-card px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-md mb-3 sm:mb-4">
                    <div className="h-2 w-2 sm:h-3 sm:w-3 bg-success rounded-full animate-pulse"></div>
                    <span className="text-xs sm:text-sm font-medium">Dashboard Preview</span>
                  </div>
                  <div className="text-3xl sm:text-4xl md:text-5xl font-mono font-bold text-success mb-2">
                    R$ 2.847,50
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground">Saldo restante do mês</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-12 sm:py-16 md:py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 px-4">
              Recursos Poderosos
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
              Tudo que você precisa para controlar suas finanças de forma simples e eficiente
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="p-6 h-full hover:shadow-lg transition-smooth hover:border-primary/50">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 sm:mb-10 md:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 px-4">
                Por Que Escolher {branding.brandName}?
              </h2>
            </div>
            
            <Card className="p-6 sm:p-8 md:p-12">
              <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-r from-primary to-primary-light">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 px-4">
                Pronto para Simplificar suas Finanças?
              </h2>
              <p className="text-base sm:text-lg mb-6 sm:mb-8 text-primary-foreground/90 px-4">
                Comece agora e tenha controle total do seu dinheiro em minutos
              </p>
              <Link to="/onboarding" className="inline-block w-full sm:w-auto px-4">
                <Button size="lg" variant="secondary" className="gap-2 shadow-lg w-full sm:w-auto">
                  Criar Conta Gratuita
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 sm:py-8 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <img
                src={branding.logo.mark}
                alt={`${branding.brandName} marca`}
                className="h-6 w-6 object-contain"
              />
              <span className="font-semibold text-foreground">{branding.brandName}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 text-sm text-muted-foreground">
              <Link to="/termos" className="hover:text-foreground transition-smooth">
                Termos de Uso
              </Link>
              <span className="hidden sm:inline">•</span>
              <Link to="/privacidade" className="hover:text-foreground transition-smooth">
                Política de Privacidade
              </Link>
              <span className="hidden sm:inline">•</span>
              <span>© {new Date().getFullYear()} {branding.brandName}. Seu contador digital.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
