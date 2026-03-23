import { Link } from "react-router-dom";
import { branding } from "@/config/branding";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const lastUpdated = "19 de março de 2026";
const privacyEmail = "privacidade@automafluxo.com.br";

const DeleteData = () => {
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
              <Button variant="outline" size="sm">Privacidade</Button>
            </Link>
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
            <h1 className="text-3xl font-bold text-foreground">Exclusão de Dados</h1>
            <p className="text-sm text-muted-foreground">Última atualização: {lastUpdated}</p>
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Seu direito à exclusão de dados</h2>
            <p className="text-muted-foreground">
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei n. 13.709/2018), você tem o direito
              de solicitar a exclusão dos seus dados pessoais armazenados pelo {branding.brandName} a qualquer momento.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Como solicitar a exclusão</h2>
            <p className="text-muted-foreground">
              Você pode solicitar a exclusão dos seus dados de duas formas:
            </p>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Opção A: Pelo aplicativo</h3>
                <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
                  <li>Faça login na sua conta no {branding.brandName}.</li>
                  <li>Acesse <strong>Configurações</strong>.</li>
                  <li>Clique em <strong>"Excluir minha conta"</strong>.</li>
                  <li>Confirme a solicitação.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">Opção B: Por e-mail</h3>
                <p className="text-muted-foreground">
                  Envie um e-mail para{" "}
                  <a href={`mailto:${privacyEmail}`} className="text-primary hover:underline">{privacyEmail}</a>{" "}
                  com o assunto <strong>"Solicitação de Exclusão de Dados"</strong>, informando o e-mail ou telefone
                  associado à sua conta.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. O que será excluído</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Dados de cadastro (nome, e-mail, telefone).</li>
              <li>Dados financeiros registrados na plataforma.</li>
              <li>Histórico de mensagens e interações.</li>
              <li>Dados de uso e preferências.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Prazo para exclusão</h2>
            <p className="text-muted-foreground">
              Após a confirmação da solicitacao, seus dados serão excluídos no prazo de ate <strong>30 dias</strong>.
              Você receberá uma confirmacao por e-mail quando o processo for concluído.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Exceções</h2>
            <p className="text-muted-foreground">
              Alguns dados poderão ser retidos por prazo superior quando houver obrigação legal ou regulatória,
              como registros fiscais ou de acesso exigidos pela legislacao brasileira. Nesses casos, os dados
              serão mantidos pelo prazo mínimo exigido e excluídos em seguida.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Contato</h2>
            <p className="text-muted-foreground">
              Em caso de dúvidas sobre a exclusão de dados ou sobre o tratamento das suas informações pessoais,
              entre em contato pelo e-mail{" "}
              <a href={`mailto:${privacyEmail}`} className="text-primary hover:underline">{privacyEmail}</a>.
            </p>
          </section>
        </Card>
      </main>
    </div>
  );
};

export default DeleteData;
