import { Button } from '@/components/ui/button';
import { type AppLanguage, LANGUAGES } from '@/i18n/i18n';
import { useTranslation } from 'react-i18next';

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current: AppLanguage = i18n.resolvedLanguage === 'en-US' ? 'en-US' : 'pt-BR';
  const next: AppLanguage = current === 'pt-BR' ? 'en-US' : 'pt-BR';

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-base px-2"
      onClick={() => i18n.changeLanguage(next)}
      title={LANGUAGES[next].label}
    >
      {LANGUAGES[current].flag}
    </Button>
  );
}
