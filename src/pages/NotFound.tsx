import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { branding } from "@/config/branding";
import { useAuth } from "@/hooks/useAuth";
import LogoutButton from "@/components/LogoutButton";

const NotFound = () => {
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <Card className="p-8 text-center space-y-6">
          <div className="space-y-3">
            <img
              src={branding.logo.horizontal}
              alt={`${branding.brandName} logotipo`}
              className="mx-auto h-8 w-auto object-contain"
            />
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">404</h1>
              <p className="mt-2 text-lg text-foreground">Não encontramos esta página</p>
              <p className="text-sm text-muted-foreground mt-1">
                O endereço <span className="font-medium text-foreground">{location.pathname}</span> não existe.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {loading ? (
              <Button variant="outline" disabled className="w-full sm:w-auto">
                Verificando sessão...
              </Button>
            ) : user ? (
              <>
                <Link to="/company/dashboard" className="w-full sm:w-auto">
                  <Button className="w-full">Voltar ao dashboard</Button>
                </Link>
                <LogoutButton className="w-full sm:w-auto" />
              </>
            ) : (
              <>
                <Link to="/" className="w-full sm:w-auto">
                  <Button className="w-full">Ir para a home</Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full">
                    Fazer login
                  </Button>
                </Link>
              </>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default NotFound;
