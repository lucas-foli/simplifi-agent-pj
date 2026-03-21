const AUTH_ERROR_MAP: [RegExp, string][] = [
  [/email rate limit exceeded/i, 'Limite de envio de e-mail atingido. Tente novamente em instantes.'],
  [/invalid login credentials/i, 'Email ou senha incorretos.'],
  [/email not confirmed/i, 'Email não confirmado. Verifique sua caixa de entrada.'],
  [/user already registered/i, 'Este email já está cadastrado. Tente fazer login.'],
  [/password should be at least/i, 'A senha deve ter pelo menos 6 caracteres.'],
  [/token has expired or is invalid/i, 'Código inválido ou expirado. Solicite um novo código.'],
  [/for security purposes, you can only request this after/i, 'Por segurança, aguarde alguns instantes antes de reenviar.'],
  [/new password should be different/i, 'A nova senha deve ser diferente da anterior.'],
  [/unable to validate email address/i, 'Endereço de e-mail inválido.'],
  [/signups not allowed/i, 'Cadastro temporariamente indisponível. Tente novamente mais tarde.'],
];

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  for (const [pattern, translation] of AUTH_ERROR_MAP) {
    if (pattern.test(lower)) {
      return translation;
    }
  }
  return message;
}
