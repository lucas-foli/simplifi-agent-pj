import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { buildCorsHeaders, corsOptionsResponse } from '../_shared/cors.ts';
import {
  validateRequest,
  createErrorResponse,
} from '../_shared/validation.ts';

// Email validation with RFC 5322 compliance
const EmailSchema = z.string()
  .email('Email inválido')
  .min(5, 'Email muito curto')
  .max(254, 'Email muito longo')
  .toLowerCase();

// CNPJ validation (14 digits with proper validation algorithm)
const CNPJSchema = z.string()
  .regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos')
  .refine(validateCNPJ, { message: 'CNPJ inválido' });

// Password validation - strong requirements
const PasswordSchema = z.string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .max(128, 'Senha muito longa')
  .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve conter pelo menos um número')
  .regex(/[^a-zA-Z0-9]/, 'Senha deve conter pelo menos um caractere especial');

const OnboardingRequestSchema = z.object({
  email: EmailSchema,
  cnpj: CNPJSchema.optional(),
  password: PasswordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsOptionsResponse(req);
  }

  try {
    const requestData = await req.json();
    const validated = validateRequest(OnboardingRequestSchema, requestData);

    // Additional business logic validations
    const warnings: string[] = [];

    // Check if email domain is suspicious
    const emailDomain = validated.email.split('@')[1];
    const suspiciousDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    if (suspiciousDomains.includes(emailDomain)) {
      warnings.push('Domínio de email temporário detectado');
    }

    // Check password strength score (optional)
    const passwordStrength = calculatePasswordStrength(validated.password);
    if (passwordStrength < 3) {
      warnings.push('Senha considerada fraca. Considere usar uma senha mais forte.');
    }

    return new Response(
      JSON.stringify({
        valid: true,
        warnings,
        data: {
          email: validated.email,
          cnpj: validated.cnpj,
          // Never return password back to client
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

/**
 * Validate CNPJ using official algorithm
 * https://www.geradorcnpj.com/algoritmo_do_cnpj.htm
 */
function validateCNPJ(cnpj: string): boolean {
  // Remove non-digits
  const digits = cnpj.replace(/\D/g, '');

  if (digits.length !== 14) return false;

  // Check for known invalid CNPJs (all same digit)
  if (/^(\d)\1+$/.test(digits)) return false;

  // Validate first check digit
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit !== parseInt(digits[12])) return false;

  // Validate second check digit
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (checkDigit !== parseInt(digits[13])) return false;

  return true;
}

/**
 * Calculate password strength (0-5)
 * Based on length, character variety, and common patterns
 */
function calculatePasswordStrength(password: string): number {
  let strength = 0;

  // Length bonus
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;

  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  // Penalty for common patterns
  const commonPatterns = [
    /^123/,
    /abc/i,
    /password/i,
    /qwerty/i,
    /(.)\1{2,}/, // repeated characters
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      strength = Math.max(0, strength - 1);
      break;
    }
  }

  return strength;
}
