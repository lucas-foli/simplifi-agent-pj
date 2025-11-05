import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { branding } from "@/config/branding";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthGateway = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/company/dashboard", { replace: true });
    }
  }, [loading, navigate, user]);

  if (loading || user) {
    return null;
  }

  return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
			<Card className="w-full max-w-md p-8 space-y-6 text-center">
				<div className="space-y-2">
					<div className="mx-auto h-12 w-auto max-w-[220px]">
						<img
							src={branding.logo.horizontal}
							alt={`${branding.brandName} logotipo`}
							className="mx-auto h-12 w-auto object-contain scale-[5.75]"
							style={{ transformOrigin: 'center center' }}
						/>
					</div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Bem-vindo ao {branding.brandName}</h1>
					<p className="text-sm text-muted-foreground">
						Entre na sua conta ou crie uma nova para centralizar o financeiro da sua empresa com o {branding.brandName}.
					</p>
				</div>

				<div className="space-y-3">
					<Button className="w-full" size="lg" onClick={() => navigate('/login')}>
						Já tenho conta
					</Button>
					<Button className="w-full" size="lg" variant="outline" onClick={() => navigate('/onboarding')}>
						Criar nova conta
					</Button>
				</div>
			</Card>
		</div>
	);
};

export default AuthGateway;
