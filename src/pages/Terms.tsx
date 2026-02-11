import { Link } from "react-router-dom";
import { branding } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const lastUpdated = "11 de fevereiro de 2026";
const supportEmail = "contato@seu-dominio.com";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={branding.logo.horizontal}
              alt={`${branding.brandName} logotipo`}
              className="h-7 w-auto object-contain"
            />
            <span className="text-lg font-semibold text-foreground">{branding.brandName}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/privacidade">
              <Button variant="outline" size="sm">Política de Privacidade</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Entrar</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <Card className="p-6 sm:p-8 md:p-10 space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Termos de Uso</h1>
            <p className="text-sm text-muted-foreground">Última atualização: {lastUpdated}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Aceitação dos termos</h2>
            <p className="text-muted-foreground">
              Ao acessar ou utilizar o {branding.brandName}, você concorda com estes Termos de Uso. Se não
              concordar, não utilize o serviço.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Descrição do serviço</h2>
            <p className="text-muted-foreground">
              O {branding.brandName} é um assistente financeiro conversacional para empresas (PJ) que permite
              registrar movimentações, organizar custos e acompanhar indicadores, inclusive por meio de
              integrações com WhatsApp e chat.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Cadastro e conta</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
              <li>Você é responsável por manter a confidencialidade das credenciais de acesso.</li>
              <li>Você responde por todas as atividades realizadas em sua conta.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Uso do WhatsApp e mensagens</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Ao enviar mensagens, você autoriza o processamento para extrair informações financeiras.</li>
              <li>Você declara ter autorização para compartilhar dados de terceiros eventualmente incluídos nas mensagens.</li>
              <li>O uso do WhatsApp está sujeito também aos termos e políticas da Meta/WhatsApp.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Uso permitido</h2>
            <p className="text-muted-foreground">Você se compromete a não:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Utilizar o serviço para fins ilícitos ou que violem normas aplicáveis.</li>
              <li>Tentar acessar áreas restritas ou comprometer a segurança do sistema.</li>
              <li>Inserir conteúdo malicioso, enganoso ou que viole direitos de terceiros.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Limitações e isenções</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>O serviço é fornecido "como está" e pode sofrer indisponibilidades temporárias.</li>
              <li>O {branding.brandName} não substitui consultoria contábil, fiscal ou financeira profissional.</li>
              <li>Não garantimos que o serviço atenderá a todas as suas necessidades específicas.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Propriedade intelectual</h2>
            <p className="text-muted-foreground">
              O conteúdo, marcas, logotipos e funcionalidades do {branding.brandName} são protegidos por direitos
              de propriedade intelectual e não podem ser usados sem autorização.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Privacidade</h2>
            <p className="text-muted-foreground">
              O tratamento de dados pessoais é regido pela nossa {" "}
              <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Suspensão e encerramento</h2>
            <p className="text-muted-foreground">
              Podemos suspender ou encerrar o acesso em caso de violação destes termos, uso indevido ou exigência
              legal. Você pode encerrar sua conta a qualquer momento, solicitando pelo canal de suporte.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Alterações nos termos</h2>
            <p className="text-muted-foreground">
              Podemos atualizar estes Termos. Quando houver mudanças relevantes, publicaremos a nova versão com
              a data de atualização.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Contato</h2>
            <p className="text-muted-foreground">
              Em caso de dúvidas, fale conosco em {" "}
              <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">{supportEmail}</a>.
            </p>
          </section>
        </Card>
      </main>
    </div>
  );
};

export default Terms;
