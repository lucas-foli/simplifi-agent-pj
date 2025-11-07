import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { branding } from '@/config/branding';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
      navigate('/company/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(errorMessage);
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
		<div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
				className="w-full max-w-md">
				<Card className="p-8">
					<div className="text-center mb-8 space-y-3">
						<img
							src={branding.logo.horizontal}
							alt={`${branding.brandName} logotipo`}
							className="mx-auto h-12 w-auto object-contain scale-[10.75] pointer-events-none relative -z-1"
							style={{ transformOrigin: 'center center' }}
						/>
						<p className="text-muted-foreground">Faça login na sua conta empresarial</p>
					</div>

					<form onSubmit={handleSubmit} className="space-y-6">
						<div>
							<Label htmlFor="email">E-mail</Label>
							<Input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="seu@email.com"
								required
								disabled={loading}
							/>
						</div>

						<div>
							<Label htmlFor="password">Senha</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								required
								disabled={loading}
							/>
						</div>

						{error && (
							<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
								<AlertCircle className="h-4 w-4" />
								<span>{error}</span>
							</div>
						)}

						<Button type="submit" className="w-full" disabled={loading}>
							{loading ? 'Entrando...' : 'Entrar'}
						</Button>
					</form>

					<div className="mt-6 text-center text-sm">
						<span className="text-muted-foreground">Não tem uma conta? </span>
						<Link to="/onboarding" className="text-primary hover:underline font-medium">
							Criar conta
						</Link>
					</div>
				</Card>
			</motion.div>
		</div>
	);
};

export default Login;
