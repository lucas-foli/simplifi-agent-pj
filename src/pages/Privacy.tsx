import { Link } from "react-router-dom";
import { branding } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const lastUpdated = "11 de fevereiro de 2026";
const supportEmail = "contato@seu-dominio.com";

const Privacy = () => {
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
            <Link to="/termos">
              <Button variant="outline" size="sm">Termos de Uso</Button>
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
            <h1 className="text-3xl font-bold text-foreground">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Última atualização: {lastUpdated}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Quem somos</h2>
            <p className="text-muted-foreground">
              Esta Política descreve como o {branding.brandName} coleta, usa e compartilha dados pessoais quando
              você utiliza nosso aplicativo e integrações (incluindo WhatsApp).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Dados que coletamos</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Dados de cadastro: nome, e-mail, telefone e informações da empresa.</li>
              <li>Dados financeiros informados no app ou via mensagens (valores, categorias, descrições).</li>
              <li>Conteúdo de mensagens enviadas para registrar ou consultar informações.</li>
              <li>Dados técnicos: registros de acesso, IP, dispositivo e navegador.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Como usamos os dados</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Prestar o serviço, organizar movimentações e gerar relatórios financeiros.</li>
              <li>Autenticar usuários, proteger contas e prevenir fraudes.</li>
              <li>Melhorar o aplicativo, analisar desempenho e suporte ao cliente.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Base legal</h2>
            <p className="text-muted-foreground">
              Tratamos dados pessoais com base no cumprimento de contrato, no legítimo interesse para operar e
              melhorar o serviço e, quando aplicável, no seu consentimento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Compartilhamento</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Com provedores de infraestrutura e serviços necessários para operar o aplicativo.</li>
              <li>Com a Meta/WhatsApp para possibilitar o envio e recebimento de mensagens.</li>
              <li>Com autoridades, quando houver obrigação legal.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Retenção e segurança</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Guardamos os dados enquanto a conta estiver ativa ou conforme exigências legais.</li>
              <li>Adotamos medidas técnicas e organizacionais para proteger informações pessoais.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Seus direitos</h2>
            <p className="text-muted-foreground">Você pode solicitar:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Confirmação da existência de tratamento e acesso aos dados.</li>
              <li>Correção, atualização ou exclusão de informações.</li>
              <li>Portabilidade e revogação do consentimento, quando aplicável.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Crianças e adolescentes</h2>
            <p className="text-muted-foreground">
              O serviço é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Alterações nesta política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta Política e publicaremos a nova versão com a data de atualização.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Contato</h2>
            <p className="text-muted-foreground">
              Para exercer direitos ou tirar dúvidas, fale conosco em {" "}
              <a href={`mailto:${supportEmail}`} className="text-primary hover:underline">{supportEmail}</a>.
            </p>
          </section>
        </Card>
      </main>
    </div>
  );
};

export default Privacy;
