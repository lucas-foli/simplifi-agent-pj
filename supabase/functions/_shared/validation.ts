/**
 * Shared validation utilities for Edge Functions
 * Uses Zod for runtime type validation
 */

// Note: Using npm: prefix to import from npm in Deno
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Common schemas
export const UUIDSchema = z.string().uuid('Invalid UUID format');

export const MessageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(5000, 'Message too long (max 5000 characters)')
  .trim();

export const DescriptionSchema = z.string()
  .min(1, 'Description cannot be empty')
  .max(500, 'Description too long (max 500 characters)')
  .trim();

export const CategorySchema = z.enum([
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Moradia',
  'Vestuário',
  'Serviços',
  'Outros',
]);

export const AmountSchema = z.number()
  .positive('Amount must be positive')
  .max(1000000, 'Amount too large')
  .finite('Amount must be a valid number');

// Request schemas for each Edge Function
export const ChatRequestSchema = z.object({
  message: MessageSchema,
  userId: UUIDSchema,
});

export const ClassifyTransactionRequestSchema = z.object({
  description: DescriptionSchema,
  userId: UUIDSchema,
  amount: AmountSchema.optional(),
});

export const SavePatternRequestSchema = z.object({
  description: DescriptionSchema,
  category: CategorySchema,
  userId: UUIDSchema,
});

// Generic validation helper
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new ValidationError(messages);
    }
    throw error;
  }
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Rate limiting using Supabase as storage
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60000, // 1 minute
};

/**
 * Check rate limit for a user
 * 
 * Implementation: In-memory Map (resets on cold start)
 * - Works well for serverless with reasonable traffic
 * - Automatic cleanup every 5 minutes
 * - For high-traffic production, consider:
 *   - Upstash Redis (serverless-friendly)
 *   - Supabase Edge Functions KV (when available)
 *   - Database table (adds latency but persists)
 * 
 * Current limits: 20 requests/minute per user
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): void {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or create new window
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    console.log(`[Rate Limit] New window for user ${userId.slice(0, 8)}... (1/${config.maxRequests})`);
    return;
  }

  if (userLimit.count >= config.maxRequests) {
    const remainingMs = userLimit.resetAt - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    console.warn(`[Rate Limit] ⛔ User ${userId.slice(0, 8)}... exceeded limit (${userLimit.count}/${config.maxRequests})`);
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${remainingSec} seconds.`
    );
  }

  userLimit.count++;
  console.log(`[Rate Limit] User ${userId.slice(0, 8)}... request count: ${userLimit.count}/${config.maxRequests}`);
}

// Cleanup old entries periodically (optional, for memory management)
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimitMap.entries()) {
    if (now > limit.resetAt) {
      rateLimitMap.delete(userId);
    }
  }
}, 300000); // Clean every 5 minutes

/**
 * Generic error response handler
 * Sanitizes error messages to avoid exposing internal details
 */
export function createErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>
): Response {
  console.error('Edge function error:', error);

  let status = 500;
  let message = 'An unexpected error occurred. Please try again later.';

  if (error instanceof ValidationError) {
    status = 400;
    message = `Validation error: ${error.message}`;
  } else if (error instanceof RateLimitError) {
    status = 429;
    message = error.message;
  } else if (error instanceof Error) {
    // Log full error server-side, but don't expose to client
    console.error('Detailed error:', error.message, error.stack);
  }

  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Validate authorization header
 */
export function validateAuthHeader(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
}
