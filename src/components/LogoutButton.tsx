import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface LogoutButtonProps {
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  label?: string;
  showIcon?: boolean;
}

const LogoutButton = ({
  variant = 'outline',
  size = 'sm',
  className,
  label = 'Sair',
  showIcon = true,
}: LogoutButtonProps) => {
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await signOut();
      toast.success('Você saiu da sua conta.');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Não foi possível sair da sua conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
      disabled={isLoading}
    >
      {showIcon && <LogOut className="h-4 w-4" />}
      {isLoading ? 'Saindo...' : label}
    </Button>
  );
};

export default LogoutButton;
