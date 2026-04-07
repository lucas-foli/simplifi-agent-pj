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

function daysToReminderType(days: number): ReminderType {
  if (days === 5) return '5_days';
  if (days === 3) return '3_days';
  return '1_day';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

/**
 * Compute the next due date for a given due_day relative to today.
 * If the due_day has already passed this month, it returns the due_day
 * for this month still (since we look at days_until which could be negative).
 * We always consider the current month's occurrence.
 */
function getDueDateThisMonth(dueDay: number, today: Date): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  // Clamp to actual last day of month (e.g. due_day=31 in February → 28/29)
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(dueDay, lastDay);
  return new Date(year, month, clampedDay);
}

function buildReminderMessage(
  costDescription: string,
  amount: number,
  daysUntil: number,
  dueDay: number,
): string {
  const formattedAmount = formatCurrency(amount);
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

    // Use America/Sao_Paulo so reminders align with the user's local date,
    // not the UTC date of the server.
    const nowInBrazil = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
    );
    const today = new Date(nowInBrazil.getFullYear(), nowInBrazil.getMonth(), nowInBrazil.getDate());

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

    // 2. For each cost, check if today matches a reminder day
    type PendingReminder = {
      cost: typeof fixedCosts[number];
      daysUntil: number;
      reminderType: ReminderType;
      dueDate: Date;
    };

    const pendingReminders: PendingReminder[] = [];

    for (const cost of fixedCosts) {
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

    // Check which reminders were already sent
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
    const companyIds = [...new Set(unsent.map((r) => r.cost.company_id))];
    const { data: whatsappLinks } = await supabase
      .from('whatsapp_links')
      .select('company_id, phone')
      .in('company_id', companyIds)
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

      const message = buildReminderMessage(
        reminder.cost.description,
        reminder.cost.amount,
        reminder.daysUntil,
        reminder.cost.due_day,
      );

      for (const phone of phones) {
        const messageId = await sendWhatsAppText(phone, message);

        // Log the reminder regardless of send success to avoid retrying forever
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
          `[Reminders] ${messageId ? 'Sent' : 'Failed'} ${reminder.reminderType} reminder for "${reminder.cost.description}" to ${phone}`,
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
