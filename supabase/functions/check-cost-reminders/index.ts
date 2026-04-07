import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

/**
 * Edge Function: check-cost-reminders
 *
 * Designed to run on a schedule (e.g. daily via pg_cron or external cron).
 * For each company fixed cost that has a due_day set, it checks whether today
 * is 5, 3, or 1 day(s) before the due date. If so, and a reminder hasn't
 * already been sent for that period, it sends a WhatsApp message to all linked
 * phones for the company and logs the reminder.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const META_WHATSAPP_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
const META_WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
const META_WHATSAPP_API_VERSION = Deno.env.get('META_WHATSAPP_API_VERSION') ?? 'v20.0';

const REMINDER_DAYS = [5, 3, 1] as const;

type ReminderType = '5_days' | '3_days' | '1_day';
type CurrencyCode = 'BRL' | 'USD' | 'CAD';

const CURRENCY_CONFIG: Record<CurrencyCode, { locale: string; lang: 'pt' | 'en' }> = {
  BRL: { locale: 'pt-BR', lang: 'pt' },
  USD: { locale: 'en-US', lang: 'en' },
  CAD: { locale: 'en-CA', lang: 'en' },
};

function daysToReminderType(days: number): ReminderType {
  if (days === 5) return '5_days';
  if (days === 3) return '3_days';
  return '1_day';
}

function formatCurrency(amount: number, currency: CurrencyCode): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.BRL;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

function getDueDateThisMonth(dueDay: number, today: Date): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(dueDay, lastDay);
  return new Date(year, month, clampedDay);
}

function buildReminderMessage(
  costDescription: string,
  formattedAmount: string,
  daysUntil: number,
  dueDay: number,
  lang: 'pt' | 'en',
): string {
  if (lang === 'en') {
    if (daysUntil === 1) {
      return (
        `⚠️ *Fixed cost reminder*\n\n` +
        `*${costDescription}* of *${formattedAmount}* is due *tomorrow* (day ${dueDay}).\n\n` +
        `Don't forget to make the payment!`
      );
    }
    return (
      `📋 *Fixed cost reminder*\n\n` +
      `*${costDescription}* of *${formattedAmount}* is due in *${daysUntil} days* (day ${dueDay}).\n\n` +
      `Plan ahead for the payment!`
    );
  }

  // Portuguese (default)
  if (daysUntil === 1) {
    return (
      `⚠️ *Lembrete de custo fixo*\n\n` +
      `O custo *${costDescription}* no valor de *${formattedAmount}* vence *amanhã* (dia ${dueDay}).\n\n` +
      `Não se esqueça de efetuar o pagamento!`
    );
  }
  return (
    `📋 *Lembrete de custo fixo*\n\n` +
    `O custo *${costDescription}* no valor de *${formattedAmount}* vence em *${daysUntil} dias* (dia ${dueDay}).\n\n` +
    `Organize-se para o pagamento!`
  );
}

async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?from=BRL&to=USD,CAD');
    if (!response.ok) return {};
    const data = await response.json();
    return { BRL: 1, ...data.rates };
  } catch {
    console.warn('[Reminders] Could not fetch exchange rates, using BRL.');
    return { BRL: 1 };
  }
}

async function sendWhatsAppText(phone: string, message: string): Promise<string | null> {
  if (!META_WHATSAPP_TOKEN || !META_WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[Reminders] WhatsApp credentials not configured, skipping send.');
    return null;
  }

  const normalizedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
  const url = `https://graph.facebook.com/${META_WHATSAPP_API_VERSION}/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error(`[Reminders] Failed to send to ${normalizedPhone}:`, data);
    return null;
  }

  return data.messages?.[0]?.id ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all fixed costs that have a due_day set
    const { data: fixedCosts, error: costsError } = await supabase
      .from('company_fixed_costs')
      .select('id, company_id, description, amount, due_day')
      .not('due_day', 'is', null);

    if (costsError) {
      throw new Error(`Failed to fetch fixed costs: ${costsError.message}`);
    }

    if (!fixedCosts || fixedCosts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No fixed costs with due_day configured.', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1b. Fetch timezone for each company involved
    const companyIds = [...new Set(fixedCosts.map((c) => c.company_id))];
    let timezoneByCompany = new Map<string, string>();

    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('id, timezone')
      .in('id', companyIds);

    if (!companiesError && companiesData) {
      timezoneByCompany = new Map(
        companiesData.map((c: { id: string; timezone?: string }) => [
          c.id,
          c.timezone ?? 'America/Sao_Paulo',
        ]),
      );
    } else {
      console.warn('[Reminders] Could not fetch company timezones, using default:', companiesError?.message);
    }

    // 1c. Fetch display_currency for each company's owner/creator
    const { data: membersData } = await supabase
      .from('company_members')
      .select('company_id, profile_id, role')
      .in('company_id', companyIds)
      .eq('role', 'owner');

    const ownerProfileIds = [...new Set((membersData ?? []).map((m: any) => m.profile_id))];
    let currencyByCompany = new Map<string, CurrencyCode>();

    if (ownerProfileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_currency')
        .in('id', ownerProfileIds);

      const currencyByProfile = new Map<string, CurrencyCode>(
        (profilesData ?? []).map((p: any) => [p.id, p.display_currency ?? 'BRL']),
      );

      for (const member of membersData ?? []) {
        const currency = currencyByProfile.get(member.profile_id) ?? 'BRL';
        currencyByCompany.set(member.company_id, currency as CurrencyCode);
      }
    }

    // 1d. Fetch exchange rates if any company uses non-BRL currency
    const needsConversion = [...currencyByCompany.values()].some((c) => c !== 'BRL');
    const exchangeRates = needsConversion ? await fetchExchangeRates() : { BRL: 1 };

    // 2. For each cost, compute "today" in the company's timezone and check reminder days
    type PendingReminder = {
      cost: typeof fixedCosts[number];
      daysUntil: number;
      reminderType: ReminderType;
      dueDate: Date;
    };

    const pendingReminders: PendingReminder[] = [];

    for (const cost of fixedCosts) {
      const tz = timezoneByCompany.get(cost.company_id) ?? 'America/Sao_Paulo';
      const nowLocal = new Date(
        new Date().toLocaleString('en-US', { timeZone: tz }),
      );
      const today = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());

      const dueDate = getDueDateThisMonth(cost.due_day, today);
      const diffMs = dueDate.getTime() - today.getTime();
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if ((REMINDER_DAYS as readonly number[]).includes(daysUntil)) {
        pendingReminders.push({
          cost,
          daysUntil,
          reminderType: daysToReminderType(daysUntil),
          dueDate,
        });
      }
    }

    if (pendingReminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No reminders due today.', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Filter out already-sent reminders
    const dueDateStr = (d: Date) => d.toISOString().split('T')[0];

    const lookupConditions = pendingReminders.map((r) => ({
      fixed_cost_id: r.cost.id,
      reminder_type: r.reminderType,
      due_date: dueDateStr(r.dueDate),
    }));

    const { data: existingLogs } = await supabase
      .from('cost_reminder_logs')
      .select('fixed_cost_id, reminder_type, due_date')
      .in('fixed_cost_id', lookupConditions.map((c) => c.fixed_cost_id));

    const sentSet = new Set(
      (existingLogs ?? []).map(
        (log: { fixed_cost_id: string; reminder_type: string; due_date: string }) =>
          `${log.fixed_cost_id}|${log.reminder_type}|${log.due_date}`,
      ),
    );

    const unsent = pendingReminders.filter(
      (r) => !sentSet.has(`${r.cost.id}|${r.reminderType}|${dueDateStr(r.dueDate)}`),
    );

    if (unsent.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All reminders already sent.', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Get linked WhatsApp phones per company
    const unsentCompanyIds = [...new Set(unsent.map((r) => r.cost.company_id))];
    const { data: whatsappLinks } = await supabase
      .from('whatsapp_links')
      .select('company_id, phone')
      .in('company_id', unsentCompanyIds)
      .eq('status', 'linked')
      .not('phone', 'is', null);

    const phonesByCompany = new Map<string, string[]>();
    for (const link of whatsappLinks ?? []) {
      if (!link.phone || !link.company_id) continue;
      const phones = phonesByCompany.get(link.company_id) ?? [];
      phones.push(link.phone);
      phonesByCompany.set(link.company_id, phones);
    }

    // 5. Send reminders and log them
    let sentCount = 0;

    for (const reminder of unsent) {
      const phones = phonesByCompany.get(reminder.cost.company_id);
      if (!phones || phones.length === 0) {
        console.log(
          `[Reminders] No linked WhatsApp for company ${reminder.cost.company_id}, skipping "${reminder.cost.description}".`,
        );
        continue;
      }

      // Convert amount to user's display currency
      const currency = currencyByCompany.get(reminder.cost.company_id) ?? 'BRL';
      const rate = exchangeRates[currency] ?? 1;
      const convertedAmount = reminder.cost.amount * rate;
      const formattedAmount = formatCurrency(convertedAmount, currency);
      const lang = CURRENCY_CONFIG[currency]?.lang ?? 'pt';

      const message = buildReminderMessage(
        reminder.cost.description,
        formattedAmount,
        reminder.daysUntil,
        reminder.cost.due_day,
        lang,
      );

      for (const phone of phones) {
        const messageId = await sendWhatsAppText(phone, message);

        await supabase.from('cost_reminder_logs').insert({
          fixed_cost_id: reminder.cost.id,
          company_id: reminder.cost.company_id,
          phone,
          reminder_type: reminder.reminderType,
          due_date: dueDateStr(reminder.dueDate),
          message_id: messageId,
        });

        if (messageId) sentCount++;

        console.log(
          `[Reminders] ${messageId ? 'Sent' : 'Failed'} ${reminder.reminderType} reminder for "${reminder.cost.description}" to ${phone} (${currency})`,
        );
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed reminders.`, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[Reminders] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
