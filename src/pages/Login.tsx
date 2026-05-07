import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { branding } from '@/config/branding';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { translateAuthError } from '@/lib/authErrors';

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
      const translated = translateAuthError(errorMessage);
      setError(translated);
      toast.error(translated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070D] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid & Glow from Original Process */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(28,32,53,1)_1px,transparent_1px),linear-gradient(90deg,rgba(28,32,53,1)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_30%,transparent_100%)]" />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none bg-[radial-gradient(ellipse,rgba(0,240,168,0.1)_0%,transparent_65%)]" />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[430px] relative z-10"
      >
        <Card className="p-10 bg-[#0B0D16] border-slate-800/60 shadow-[0_40px_100px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] rounded-[22px]">
          <div className="text-center mb-10 space-y-4">
            <div className="w-14 h-11 bg-black rounded-lg flex items-center justify-center border border-slate-800/50 mx-auto shadow-lg">
              <svg width="24" height="19" viewBox="0 0 108 84" fill="white">
                <polygon points="2,4 33,4 27,20 0,20"/>
                <polygon points="1,30 31,30 25,46 0,46"/>
                <polygon points="3,56 33,56 27,72 2,72"/>
                <path d="M44,72 L54,4 L70,4 L84,72 L94,72 L104,4 L88,4 L78,50 L64,4 L44,4 Z" fillRule="evenodd"/>
              </svg>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">{branding.brandName}</h1>
              <p className="text-slate-500 text-sm">Controle financeiro inteligente</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-400 text-xs font-semibold uppercase tracking-wider">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
                className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Senha</Label>
                <Link to="/forgot-password" size="sm" className="text-xs text-primary hover:text-primary-light transition-colors font-medium">
                  Esqueceu a senha?
                </Link>
              </div>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="bg-slate-900/50 border-slate-800 text-white placeholder:text-slate-600 focus:border-primary/50 transition-all"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-primary text-black hover:bg-primary-light font-bold h-11 rounded-xl shadow-[0_10px_20px_-10px_rgba(0,240,168,0.3)] transition-all active:scale-[0.98]" 
              disabled={loading}
            >
              {loading ? 'Acessando...' : 'Acessar Conta'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
            <p className="text-slate-500 text-sm">
              Não tem uma conta?{' '}
              <Link to="/onboarding" className="text-white hover:text-primary transition-colors font-semibold">
                Começar agora
              </Link>
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
