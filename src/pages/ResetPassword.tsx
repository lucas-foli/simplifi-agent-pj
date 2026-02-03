import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { branding } from '@/config/branding';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const ResetPassword = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setIsChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!password) {
      setError('Informe a nova senha.');
      return;
    }

    if (password.length < 8) {
      setError('Use uma senha com pelo menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!session) {
      setError('O link de recuperação é inválido ou expirou.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      toast.success('Senha atualizada com sucesso.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Update password error:', err);
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar a senha.';
      setError(message);
      toast.error('Erro ao atualizar a senha.');
    } finally {
      setLoading(false);
    }
  };

  const shouldShowForm = !isChecking && !!session;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="p-8">
          <div className="text-center mb-8 space-y-2">
            <img
              src={branding.logo.horizontal}
              alt={`${branding.brandName} logotipo`}
              className="mx-auto h-10 w-auto object-contain"
            />
            <h1 className="text-3xl font-bold text-foreground">Redefinir senha</h1>
            <p className="text-muted-foreground text-sm">
              Escolha uma nova senha para acessar sua conta.
            </p>
          </div>

          {isChecking && (
            <div className="text-center text-sm text-muted-foreground">
              Validando seu link de recuperação...
            </div>
          )}

          {!isChecking && !session && (
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                Link inválido ou expirado. Solicite um novo.
              </div>
              <Link to="/forgot-password" className="inline-flex w-full">
                <Button className="w-full" variant="default">
                  Solicitar novo link
                </Button>
              </Link>
            </div>
          )}

          {shouldShowForm && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <KeyRound className="h-4 w-4" />
                {loading ? 'Atualizando...' : 'Atualizar senha'}
              </Button>
            </form>
          )}

          {shouldShowForm && (
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Use uma senha forte para manter sua conta protegida.
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
