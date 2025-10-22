import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, MessageSquare, TrendingUp, Shield, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "Controle Conversacional",
      description: "Registre despesas via WhatsApp ou chat com linguagem natural"
    },
    {
      icon: TrendingUp,
      title: "Saldo em Tempo Real",
      description: "Veja quanto pode gastar considerando receitas e custos fixos"
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
    "Sem planilhas complexas",
    "Classificação automática de despesas",
    "Alertas inteligentes de gastos",
    "Suporte para pessoa física e jurídica",
    "Integração com WhatsApp",
    "Relatórios para contadores"
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
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">SimplifiQA</span>
          </motion.div>
          <nav className="hidden md:flex gap-6 text-sm">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Recursos</a>
            <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-smooth">Benefícios</a>
          </nav>
          <Link to="/onboarding">
            <Button variant="default" size="sm">
              Começar Agora
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Seu Contador Digital
              <span className="block text-primary mt-2">Simples e Conversacional</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Controle suas finanças com linguagem natural. Registre despesas via WhatsApp, 
              veja seu saldo restante e receba sugestões inteligentes sem planilhas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/onboarding">
                <Button size="lg" className="gap-2 shadow-primary">
                  Começar Gratuitamente
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline">
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
            <Card className="p-6 md:p-8 shadow-lg border-2">
              <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-background rounded-lg p-8 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="inline-flex items-center gap-3 bg-card px-6 py-3 rounded-full shadow-md mb-4">
                    <div className="h-3 w-3 bg-success rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Dashboard Preview</span>
                  </div>
                  <div className="text-4xl md:text-5xl font-mono font-bold text-success mb-2">
                    R$ 2.847,50
                  </div>
                  <p className="text-muted-foreground">Saldo restante do mês</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Recursos Poderosos
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para controlar suas finanças de forma simples e eficiente
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
      <section id="benefits" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Por Que Escolher SimplifiQA?
              </h2>
            </div>
            
            <Card className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-6">
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
      <section className="py-20 bg-gradient-to-r from-primary to-primary-light">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-primary-foreground">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Pronto para Simplificar suas Finanças?
              </h2>
              <p className="text-lg mb-8 text-primary-foreground/90">
                Comece agora e tenha controle total do seu dinheiro em minutos
              </p>
              <Link to="/onboarding">
                <Button size="lg" variant="secondary" className="gap-2 shadow-lg">
                  Criar Conta Gratuita
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">SimplifiQA</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 SimplifiQA. Seu contador digital.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
