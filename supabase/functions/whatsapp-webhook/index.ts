import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.45.1';
import { buildCorsHeaders, corsOptionsResponse } from '../_shared/cors.ts';
import { buildSystemPrompt, AI_CONFIG, type FinancialContext } from '../chat-assistant/prompt.ts';
import { checkRateLimit, createErrorResponse } from '../_shared/validation.ts';

const token = Deno.env.get('META_WHATSAPP_TOKEN');
const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID');
const apiVersion = Deno.env.get('META_WHATSAPP_API_VERSION') ?? 'v20.0';
const verifyToken = Deno.env.get('META_WHATSAPP_VERIFY_TOKEN');
const appSecret = Deno.env.get('META_WHATSAPP_APP_SECRET');

if (!token || !phoneNumberId) {
  console.warn('[WhatsApp] Missing META_WHATSAPP_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID.');
}
if (!appSecret) {
  console.warn('[WhatsApp] Missing META_WHATSAPP_APP_SECRET for webhook signature validation.');
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return corsOptionsResponse(req);
  }

  if (req.method === 'GET' || req.method === 'POST') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const challenge = url.searchParams.get('hub.challenge');
    const providedToken = url.searchParams.get('hub.verify_token');

    if (mode === 'subscribe' && challenge && verifyToken && providedToken === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    if (mode === 'subscribe') {
      return new Response('Verification failed', { status: 403 });
    }
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    if (!appSecret) {
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-hub-signature-256')
      ?? req.headers.get('X-Hub-Signature-256');
    const signatureValid = await verifyMetaSignature(rawBody, signatureHeader, appSecret);
    if (!signatureValid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter by phone_number_id to prevent cross-app message processing.
    const EXPECTED_PHONE_NUMBER_ID =
      Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID') ?? '987723767755820';
    const incomingPhoneNumberId = extractPhoneNumberId(payload);
    if (incomingPhoneNumberId && incomingPhoneNumberId !== EXPECTED_PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'phone_number_id mismatch' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const messages = extractMessages(payload);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const message of messages) {
      try {
        await handleInboundMessage(supabase, message as WhatsAppMessage);
      } catch (error) {
        console.error('[WhatsApp] Failed to handle message:', error);
      }
    }

    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return createErrorResponse(error, corsHeaders);
  }
});

type WhatsAppTextMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'text';
  text: {
    body: string;
  };
};

type WhatsAppImageMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'image';
  image: {
    id: string;
    mime_type: string;
    caption?: string;
  };
};

type WhatsAppAudioMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'audio';
  audio: {
    id: string;
    mime_type: string;
  };
};

type WhatsAppDocumentMessage = {
  id: string;
  from: string;
  timestamp: string;
  type: 'document';
  document: {
    id: string;
    mime_type: string;
    filename?: string;
    caption?: string;
  };
};

type WhatsAppMessage = WhatsAppTextMessage | WhatsAppImageMessage | WhatsAppAudioMessage | WhatsAppDocumentMessage;

async function handleInboundMessage(supabase: any, message: WhatsAppMessage) {
  const from = normalizePhoneNumber(message.from);

  if (!from) {
    return;
  }

  const isImage = message.type === 'image';
  const isAudio = message.type === 'audio';
  const isDocument = message.type === 'document';
  const isMedia = isImage || isAudio || isDocument;

  const body = isImage
    ? (message as WhatsAppImageMessage).image?.caption?.trim() ?? ''
    : isDocument
    ? (message as WhatsAppDocumentMessage).document?.caption?.trim() ?? ''
    : isAudio
    ? ''
    : (message as WhatsAppTextMessage).text?.body?.trim() ?? '';

  // Text messages require a body; media messages can proceed without caption
  if (!isMedia && !body) {
    return;
  }

  const recorded = await recordInboundEvent(supabase, message.id, from, message);
  if (!recorded) {
    return;
  }

  const linked = await findLinkedAccount(supabase, from);
  if (!linked) {
    if (isMedia) {
      await sendWhatsAppText(
        from,
        'Para conectar seu WhatsApp ao SimplifiQA, gere um código no app e envie aqui.'
      );
    } else {
      await handleUnlinkedMessage(supabase, from, body);
    }
    return;
  }

  checkRateLimit(linked.profile_id, { maxRequests: 30, windowMs: 60_000 });

  const conversationId = await ensureConversation(supabase, linked, from);
  const userMessageText = isImage
    ? `[Imagem recebida]${body ? ` ${body}` : ''}`
    : isAudio
    ? '[Áudio recebido]'
    : isDocument
    ? `[Documento recebido: ${(message as WhatsAppDocumentMessage).document?.filename ?? 'PDF'}]${body ? ` ${body}` : ''}`
    : body;
  await saveConversationMessage(supabase, conversationId, 'user', userMessageText);

  // Check for pending action (undo/edit/confirm flow) — text only
  // Skip if the message looks like a new transaction (user wants to log something new)
  if (!isMedia && body) {
    const isPendingCommand = isAffirmation(body) || isRejection(body)
      || parseEditCommand(body) !== null || parseRemoveCommand(body) !== null;
    const isNewTransaction = !isPendingCommand && looksLikeTransaction(body);

    if (!isNewTransaction) {
      const pending = await getLatestPendingAction(supabase, linked.profile_id, from);
      if (pending) {
        // If it's not a recognized command either, auto-close the pending and proceed
        if (!isPendingCommand) {
          await supabase.from('whatsapp_pending_actions').update({ status: 'executed' }).eq('id', pending.id);
        } else {
          const reply = await handlePendingConfirmation(supabase, linked, from, body, pending);
          const outId = await sendWhatsAppText(from, reply);
          await saveConversationMessage(supabase, conversationId, 'assistant', reply);
          if (outId) await recordOutboundEvent(supabase, outId, from, { text: reply });
          return;
        }
      }
    } else {
      // New transaction — auto-close any existing pending action
      const pending = await getLatestPendingAction(supabase, linked.profile_id, from);
      if (pending) {
        await supabase.from('whatsapp_pending_actions').update({ status: 'executed' }).eq('id', pending.id);
      }
    }
  }

  let transactionResult: TransactionResult | null = null;
  let audioTranscription = '';

  if (isImage) {
    transactionResult = await handleImageTransaction(supabase, linked, message as WhatsAppImageMessage);
  } else if (isAudio) {
    const audioResult = await handleAudioTransaction(supabase, linked, message as WhatsAppAudioMessage, from);
    transactionResult = audioResult.transactionResult;
    audioTranscription = audioResult.transcription;
  } else if (isDocument) {
    transactionResult = await handleDocumentTransaction(supabase, linked, message as WhatsAppDocumentMessage);
  } else {
    transactionResult = await maybeSaveTransaction(supabase, linked, body, from);
  }

  const context = linked.company_id
    ? await fetchCompanyFinancialContext(supabase, linked.profile_id, linked.company_id)
    : await fetchFinancialContext(supabase, linked.profile_id);

  // For media messages, only add assistant response if no transactions were extracted
  const shouldAddAssistant = !isMedia || !transactionResult;
  const assistantInput = isAudio && !transactionResult
    ? (audioTranscription || 'Recebi um áudio')
    : body || (isImage ? 'Recebi uma imagem' : isDocument ? 'Recebi um documento' : '');
  const assistantMessage = shouldAddAssistant
    ? await buildAssistantResponse(assistantInput, context)
    : null;

  const combinedResponse = [transactionResult?.confirmation, assistantMessage]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!combinedResponse) {
    return;
  }

  const outboundId = await sendWhatsAppText(from, combinedResponse);
  await saveConversationMessage(supabase, conversationId, 'assistant', combinedResponse);

  if (outboundId) {
    await recordOutboundEvent(supabase, outboundId, from, { text: combinedResponse });
  }
}

async function handleUnlinkedMessage(supabase: any, from: string, body: string) {
  const pairingCode = extractPairingCode(body);

  if (!pairingCode) {
    await sendWhatsAppText(
      from,
      'Para conectar seu WhatsApp ao SimplifiQA, gere um código no app e envie aqui.'
    );
    return;
  }

  const { data: pendingLink } = await supabase
    .from('whatsapp_links')
    .select('*')
    .eq('pairing_code', pairingCode)
    .eq('status', 'pending')
    .gt('pairing_expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingLink) {
    await sendWhatsAppText(from, 'Código inválido ou expirado. Gere um novo código no app.');
    return;
  }

  const conversationId = await createConversation(supabase, pendingLink.profile_id, from);

  const { error } = await supabase
    .from('whatsapp_links')
    .update({
      phone: from,
      status: 'linked',
      verified_at: new Date().toISOString(),
      conversation_id: conversationId,
    })
    .eq('id', pendingLink.id);

  if (error) {
    if (error.code === '23505') {
      await sendWhatsAppText(from, 'Este número já está vinculado a outra conta.');
      return;
    }
    console.error('[WhatsApp] Failed to link phone:', error);
    await sendWhatsAppText(from, 'Não consegui completar a conexão. Tente gerar um novo código.');
    return;
  }

  await sendWhatsAppText(from, 'Tudo certo! Seu WhatsApp foi conectado ao SimplifiQA.');
}

async function findLinkedAccount(supabase: any, phone: string) {
  const { data } = await supabase
    .from('whatsapp_links')
    .select('id, profile_id, company_id, conversation_id, status')
    .eq('phone', phone)
    .eq('status', 'linked')
    .maybeSingle();

  return data ?? null;
}

async function ensureConversation(supabase: any, link: any, phone: string): Promise<string> {
  if (link.conversation_id) {
    return link.conversation_id;
  }

  const conversationId = await createConversation(supabase, link.profile_id, phone);
  await supabase
    .from('whatsapp_links')
    .update({ conversation_id: conversationId })
    .eq('id', link.id);

  return conversationId;
}

async function createConversation(supabase: any, userId: string, phone: string): Promise<string> {
  const title = `WhatsApp (${formatPhoneForTitle(phone)})`;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function saveConversationMessage(
  supabase: any,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
    });
}

async function recordInboundEvent(supabase: any, messageId: string, phone: string, payload: any) {
  const { error } = await supabase
    .from('whatsapp_events')
    .insert({
      message_id: messageId,
      phone,
      direction: 'inbound',
      payload,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }
    console.error('[WhatsApp] Failed to record inbound event:', error);
  }

  return true;
}

async function recordOutboundEvent(supabase: any, messageId: string, phone: string, payload: any) {
  const { error } = await supabase
    .from('whatsapp_events')
    .insert({
      message_id: messageId,
      phone,
      direction: 'outbound',
      payload,
    });

  if (error && error.code !== '23505') {
    console.error('[WhatsApp] Failed to record outbound event:', error);
  }
}

async function sendWhatsAppText(to: string, message: string): Promise<string | null> {
  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp] Missing API credentials, cannot send message.');
    return null;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[WhatsApp] Failed to send message:', errorData);
    return null;
  }

  const data = await response.json();
  return data?.messages?.[0]?.id ?? null;
}

type TransactionResult = {
  confirmation: string;
};

// ============================================================================
// Image Processing (WhatsApp → OpenAI Vision → Transactions)
// ============================================================================

async function downloadWhatsAppMedia(mediaId: string): Promise<{ data: ArrayBuffer; mimeType: string }> {
  if (!token) {
    throw new Error('Missing META_WHATSAPP_TOKEN');
  }

  // Step 1: Get the media URL from Meta API
  const metaUrl = `https://graph.facebook.com/${apiVersion}/${mediaId}`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaResponse.ok) {
    const err = await metaResponse.text().catch(() => '');
    console.error('[WhatsApp] Failed to get media URL:', metaResponse.status, err);
    throw new Error('Failed to retrieve media info');
  }

  const metaData = await metaResponse.json();
  const downloadUrl = metaData.url;
  const mimeType = metaData.mime_type ?? 'image/jpeg';

  if (!downloadUrl) {
    throw new Error('No download URL in media response');
  }

  // Step 2: Download the actual media file
  const mediaResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media: ${mediaResponse.status}`);
  }

  const data = await mediaResponse.arrayBuffer();
  return { data, mimeType };
}

async function extractTransactionsFromImage(
  imageData: ArrayBuffer,
  mimeType: string,
  openaiKey: string
): Promise<Array<{ date: string; description: string; amount: number }>> {
  const uint8Array = new Uint8Array(imageData);

  // Check file size (max 5MB)
  const sizeMB = uint8Array.length / (1024 * 1024);
  if (sizeMB > 5) {
    throw new Error(`Imagem muito grande: ${sizeMB.toFixed(1)}MB (máx 5MB)`);
  }

  // Convert to base64 in chunks
  let base64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode(...chunk);
  }
  base64 = btoa(base64);

  const normalizedMime = mimeType.includes('png') ? 'image/png' : 'image/jpeg';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extraia TODAS as transações desta imagem (comprovante, extrato, nota fiscal, etc.).
Retorne APENAS um array JSON no formato:
[{"date": "YYYY-MM-DD", "description": "texto", "amount": number}]

Regras:
- Use números negativos para despesas/pagamentos
- Use números positivos para receitas/créditos
- Se a data não estiver visível, use "${new Date().toISOString().split('T')[0]}"
- Descrição deve ser clara e concisa
- Retorne APENAS o JSON, sem nenhum outro texto`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${normalizedMime};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => '');
    console.error('[WhatsApp] OpenAI Vision error:', response.status, errorData);
    throw new Error('Falha ao processar imagem');
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? '[]';

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  return JSON.parse(jsonMatch[0]);
}

async function handleImageTransaction(
  supabase: any,
  link: any,
  message: WhatsAppImageMessage
): Promise<TransactionResult | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return { confirmation: 'Processamento de imagens indisponível no momento.' };
  }

  const mediaId = message.image?.id;
  if (!mediaId) {
    return { confirmation: 'Não consegui acessar a imagem. Tente enviar novamente.' };
  }

  let imageData: ArrayBuffer;
  let mimeType: string;
  try {
    const media = await downloadWhatsAppMedia(mediaId);
    imageData = media.data;
    mimeType = media.mimeType;
  } catch (error) {
    console.error('[WhatsApp] Media download failed:', error);
    return { confirmation: 'Não consegui baixar a imagem. Tente enviar novamente.' };
  }

  let rawTransactions: Array<{ date: string; description: string; amount: number }>;
  try {
    rawTransactions = await extractTransactionsFromImage(imageData, mimeType, openaiKey);
  } catch (error) {
    console.error('[WhatsApp] Image extraction failed:', error);
    return { confirmation: 'Não consegui extrair transações da imagem. Tente enviar uma foto mais nítida.' };
  }

  if (rawTransactions.length === 0) {
    return { confirmation: 'Não encontrei transações nesta imagem. Envie uma foto de um comprovante, extrato ou nota fiscal.' };
  }

  const confirmations: string[] = [];
  const savedTransactions: Array<{ id: string; description: string; amount: number; type: string; date: string }> = [];
  let savedCount = 0;
  const tableName = link.company_id ? 'company_transactions' : 'transactions';

  for (const raw of rawTransactions) {
    const rawAmount = typeof raw.amount === 'number' ? raw.amount : parseFloat(String(raw.amount));
    if (Number.isNaN(rawAmount) || rawAmount === 0) continue;

    const amount = Math.abs(rawAmount);
    const type: 'receita' | 'despesa' = rawAmount > 0 ? 'receita' : 'despesa';
    const description = raw.description || 'Transação via imagem';
    const date = raw.date || new Date().toISOString().split('T')[0];

    const categoryName = classifyCategory(description);
    const categoryId = categoryName
      ? await findCategoryId(supabase, link, categoryName)
      : null;

    const insert = link.company_id
      ? {
          company_id: link.company_id,
          description,
          amount,
          type,
          date,
          category_id: categoryId,
          created_by: link.profile_id,
        }
      : {
          user_id: link.profile_id,
          description,
          amount,
          type,
          date,
          category_id: categoryId,
        };

    const { data, error } = await supabase
      .from(tableName)
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error(`[WhatsApp] Failed to insert ${tableName} from image:`, error);
      continue;
    }

    savedCount++;
    savedTransactions.push({ id: data.id, description, amount, type, date });
    const typeLabel = type === 'receita' ? 'Receita' : 'Despesa';
    const categoryLabel = categoryName ? ` • ${categoryName}` : '';
    confirmations.push(`  ${savedCount}. ${typeLabel}: ${formatCurrency(amount)} - ${description}${categoryLabel}`);
  }

  if (savedCount === 0) {
    return { confirmation: 'Encontrei dados na imagem mas não consegui salvar as transações. Tente novamente.' };
  }

  // Create pending action for undo/edit
  const from = normalizePhoneNumber(message.from);
  const pendingPayload = savedTransactions.length === 1
    ? {
        saved_transaction_id: savedTransactions[0].id,
        table: tableName,
        ...savedTransactions[0],
      }
    : {
        transactions: savedTransactions.map((t) => ({
          saved_transaction_id: t.id,
          ...t,
        })),
        saved_transaction_ids: savedTransactions.map((t) => t.id),
        table: tableName,
      };

  await supabase.from('whatsapp_pending_actions').insert({
    profile_id: link.profile_id,
    company_id: link.company_id ?? null,
    phone: from,
    kind: 'create_transaction',
    payload: pendingPayload,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const undoHint = '\n\n_Responda *não* para desfazer, *editar* para corrigir._';

  const header = savedCount === 1
    ? '✅ Transação extraída da imagem:'
    : `✅ ${savedCount} transações extraídas da imagem:`;

  return { confirmation: `${header}\n${confirmations.join('\n')}${undoHint}` };
}

// ============================================================================
// Audio Processing (WhatsApp → OpenAI Whisper → Text → Transactions)
// ============================================================================

async function transcribeAudio(
  audioData: ArrayBuffer,
  mimeType: string,
  openaiKey: string
): Promise<string> {
  const uint8Array = new Uint8Array(audioData);

  const sizeMB = uint8Array.length / (1024 * 1024);
  if (sizeMB > 25) {
    throw new Error(`Áudio muito grande: ${sizeMB.toFixed(1)}MB (máx 25MB)`);
  }

  // Map WhatsApp MIME types to file extensions Whisper accepts
  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'mp4',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/amr': 'amr',
  };
  const ext = extMap[mimeType.split(';')[0].trim()] ?? 'ogg';

  const blob = new Blob([uint8Array], { type: mimeType });
  const formData = new FormData();
  formData.append('file', blob, `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.text().catch(() => '');
    console.error('[WhatsApp] Whisper transcription error:', response.status, errorData);
    throw new Error('Falha ao transcrever áudio');
  }

  const result = await response.json();
  return result.text ?? '';
}

async function handleAudioTransaction(
  supabase: any,
  link: any,
  message: WhatsAppAudioMessage,
  from: string
): Promise<{ transcription: string; transactionResult: TransactionResult | null }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return {
      transcription: '',
      transactionResult: { confirmation: 'Processamento de áudio indisponível no momento.' },
    };
  }

  const mediaId = message.audio?.id;
  if (!mediaId) {
    return {
      transcription: '',
      transactionResult: { confirmation: 'Não consegui acessar o áudio. Tente enviar novamente.' },
    };
  }

  let audioData: ArrayBuffer;
  let mimeType: string;
  try {
    const media = await downloadWhatsAppMedia(mediaId);
    audioData = media.data;
    mimeType = media.mimeType;
  } catch (error) {
    console.error('[WhatsApp] Audio download failed:', error);
    return {
      transcription: '',
      transactionResult: { confirmation: 'Não consegui baixar o áudio. Tente enviar novamente.' },
    };
  }

  let transcription: string;
  try {
    transcription = await transcribeAudio(audioData, mimeType, openaiKey);
  } catch (error) {
    console.error('[WhatsApp] Audio transcription failed:', error);
    return {
      transcription: '',
      transactionResult: { confirmation: 'Não consegui transcrever o áudio. Tente enviar novamente.' },
    };
  }

  if (!transcription.trim()) {
    return {
      transcription: '',
      transactionResult: { confirmation: 'Não consegui entender o áudio. Tente falar mais claramente.' },
    };
  }

  // Process the transcribed text as a regular transaction
  const transactionResult = await maybeSaveTransaction(supabase, link, transcription, from);
  return { transcription, transactionResult };
}

// ============================================================================
// Document/PDF Processing (WhatsApp → Gemini → Transactions)
// ============================================================================

async function extractTransactionsFromPdf(
  pdfData: ArrayBuffer,
  geminiKey: string
): Promise<Array<{ date: string; description: string; amount: number }>> {
  const uint8Array = new Uint8Array(pdfData);

  const sizeMB = uint8Array.length / (1024 * 1024);
  if (sizeMB > 10) {
    throw new Error(`PDF muito grande: ${sizeMB.toFixed(1)}MB (máx 10MB)`);
  }

  // Convert to base64 in chunks
  let base64 = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode(...chunk);
  }
  base64 = btoa(base64);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extraia TODAS as transações deste PDF (extrato bancário, fatura, nota fiscal, etc.).
Retorne APENAS um array JSON no formato:
[{"date": "YYYY-MM-DD", "description": "texto", "amount": number}]

Regras:
- Use números negativos para despesas/pagamentos
- Use números positivos para receitas/créditos
- Se a data não estiver visível, use "${new Date().toISOString().split('T')[0]}"
- Descrição deve ser clara e concisa
- Retorne APENAS o JSON, sem nenhum outro texto`,
              },
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.text().catch(() => '');
    console.error('[WhatsApp] Gemini PDF error:', response.status, errorData);
    throw new Error('Falha ao processar PDF');
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  // Extract JSON from response (remove markdown if present)
  let jsonText = content.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }

  const startIdx = jsonText.indexOf('[');
  if (startIdx === -1) {
    return [];
  }

  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < jsonText.length; i++) {
    if (jsonText[i] === '[') depth++;
    if (jsonText[i] === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }

  if (endIdx === -1) {
    console.error('[WhatsApp] Incomplete JSON in Gemini response (possibly truncated)');
    return [];
  }

  const jsonStr = jsonText.substring(startIdx, endIdx);
  return JSON.parse(jsonStr);
}

async function handleDocumentTransaction(
  supabase: any,
  link: any,
  message: WhatsAppDocumentMessage
): Promise<TransactionResult | null> {
  const mimeType = message.document?.mime_type ?? '';
  if (!mimeType.includes('pdf')) {
    return { confirmation: 'No momento, só consigo processar documentos PDF. Envie um arquivo PDF.' };
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    // Fallback to OpenAI Vision if Gemini is not available
    return { confirmation: 'Processamento de documentos PDF indisponível no momento.' };
  }

  const mediaId = message.document?.id;
  if (!mediaId) {
    return { confirmation: 'Não consegui acessar o documento. Tente enviar novamente.' };
  }

  let docData: ArrayBuffer;
  try {
    const media = await downloadWhatsAppMedia(mediaId);
    docData = media.data;
  } catch (error) {
    console.error('[WhatsApp] Document download failed:', error);
    return { confirmation: 'Não consegui baixar o documento. Tente enviar novamente.' };
  }

  let rawTransactions: Array<{ date: string; description: string; amount: number }>;
  try {
    rawTransactions = await extractTransactionsFromPdf(docData, geminiKey);
  } catch (error) {
    console.error('[WhatsApp] PDF extraction failed:', error);
    return { confirmation: 'Não consegui extrair transações do PDF. Tente enviar um arquivo menor ou mais legível.' };
  }

  if (rawTransactions.length === 0) {
    return { confirmation: 'Não encontrei transações neste PDF. Envie um extrato bancário, fatura ou nota fiscal.' };
  }

  // Reuse the same save logic as image transactions
  const confirmations: string[] = [];
  const savedTransactions: Array<{ id: string; description: string; amount: number; type: string; date: string }> = [];
  let savedCount = 0;
  const tableName = link.company_id ? 'company_transactions' : 'transactions';

  for (const raw of rawTransactions) {
    const rawAmount = typeof raw.amount === 'number' ? raw.amount : parseFloat(String(raw.amount));
    if (Number.isNaN(rawAmount) || rawAmount === 0) continue;

    const amount = Math.abs(rawAmount);
    const type: 'receita' | 'despesa' = rawAmount > 0 ? 'receita' : 'despesa';
    const description = raw.description || 'Transação via PDF';
    const date = raw.date || new Date().toISOString().split('T')[0];

    const categoryName = classifyCategory(description);
    const categoryId = categoryName
      ? await findCategoryId(supabase, link, categoryName)
      : null;

    const insert = link.company_id
      ? {
          company_id: link.company_id,
          description,
          amount,
          type,
          date,
          category_id: categoryId,
          created_by: link.profile_id,
        }
      : {
          user_id: link.profile_id,
          description,
          amount,
          type,
          date,
          category_id: categoryId,
        };

    const { data, error } = await supabase
      .from(tableName)
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error(`[WhatsApp] Failed to insert ${tableName} from PDF:`, error);
      continue;
    }

    savedCount++;
    savedTransactions.push({ id: data.id, description, amount, type, date });
    const typeLabel = type === 'receita' ? 'Receita' : 'Despesa';
    const categoryLabel = categoryName ? ` • ${categoryName}` : '';
    confirmations.push(`  ${savedCount}. ${typeLabel}: ${formatCurrency(amount)} - ${description}${categoryLabel}`);
  }

  if (savedCount === 0) {
    return { confirmation: 'Encontrei dados no PDF mas não consegui salvar as transações. Tente novamente.' };
  }

  const from = normalizePhoneNumber(message.from);
  const pendingPayload = savedTransactions.length === 1
    ? {
        saved_transaction_id: savedTransactions[0].id,
        table: tableName,
        ...savedTransactions[0],
      }
    : {
        transactions: savedTransactions.map((t) => ({
          saved_transaction_id: t.id,
          ...t,
        })),
        saved_transaction_ids: savedTransactions.map((t) => t.id),
        table: tableName,
      };

  await supabase.from('whatsapp_pending_actions').insert({
    profile_id: link.profile_id,
    company_id: link.company_id ?? null,
    phone: from,
    kind: 'create_transaction',
    payload: pendingPayload,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const undoHint = '\n\n_Responda *não* para desfazer, *editar* para corrigir._';

  const header = savedCount === 1
    ? '✅ Transação extraída do PDF:'
    : `✅ ${savedCount} transações extraídas do PDF:`;

  return { confirmation: `${header}\n${confirmations.join('\n')}${undoHint}` };
}

// ============================================================================
// Two-Stage Transaction Extraction (Heuristic + AI Refinement)
// ============================================================================

type TransactionProposal = {
  amount: number;
  description: string;
  type: 'despesa' | 'receita';
  date: string;
  category_name: string | null;
};

function looksLikeTransaction(text: string): boolean {
  const lower = text.toLowerCase();
  const hasMoney = /\b(r\$)\s*\d/.test(lower) || /\b\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})\b/.test(lower);
  const keywords = ['gastei', 'paguei', 'comprei', 'pix', 'debitei', 'cartão', 'cartao', 'recebi', 'ganhei', 'vendi'];
  return hasMoney || keywords.some((k) => lower.includes(k));
}

async function maybeSaveTransaction(supabase: any, link: any, message: string, phone: string): Promise<TransactionResult | null> {
  if (!looksLikeTransaction(message)) {
    return null;
  }

  const now = new Date();
  const candidates = extractTransactionCandidates(message);
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const categoryNames = Object.keys(CATEGORY_KEYWORDS);

  let proposals: TransactionProposal[];

  if (candidates.length > 1) {
    const heuristics = candidates
      .map((c) => extractTransactionHeuristic(c, now))
      .filter((h) => h.amount > 0 && h.description);
    proposals = openaiKey
      ? await extractTransactionsWithAI(openaiKey, message, categoryNames, heuristics)
      : heuristics;
  } else {
    const heuristic = extractTransactionHeuristic(message, now);
    const single = openaiKey
      ? await extractTransactionWithAI(openaiKey, message, categoryNames, heuristic)
      : heuristic;
    proposals = [single];
  }

  const valid = proposals.filter((p) => p.amount > 0 && p.description);
  if (valid.length === 0) {
    return null;
  }

  const savedTransactions: Array<{ id: string; proposal: TransactionProposal; categoryName: string | null }> = [];
  const confirmations: string[] = [];
  let savedCount = 0;

  for (const proposal of valid.slice(0, 10)) {
    const categoryName = proposal.category_name || classifyCategory(proposal.description);
    const categoryId = categoryName
      ? await findCategoryId(supabase, link, categoryName)
      : null;

    const table = link.company_id ? 'company_transactions' : 'transactions';
    const insert = link.company_id
      ? {
          company_id: link.company_id,
          description: proposal.description,
          amount: proposal.amount,
          type: proposal.type,
          date: proposal.date,
          category_id: categoryId,
          created_by: link.profile_id,
        }
      : {
          user_id: link.profile_id,
          description: proposal.description,
          amount: proposal.amount,
          type: proposal.type,
          date: proposal.date,
          category_id: categoryId,
        };

    const { data, error } = await supabase
      .from(table)
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      console.error(`[WhatsApp] Failed to insert ${table}:`, error);
      continue;
    }

    savedCount++;
    savedTransactions.push({ id: data.id, proposal, categoryName });

    const typeLabel = proposal.type === 'receita' ? 'Receita' : 'Despesa';
    const categoryLabel = categoryName ? ` • ${categoryName}` : '';
    if (valid.length === 1) {
      confirmations.push(`✅ ${typeLabel} registrada: ${formatCurrency(proposal.amount)} - ${proposal.description}${categoryLabel}.`);
    } else {
      confirmations.push(`  ${savedCount}. ${typeLabel}: ${formatCurrency(proposal.amount)} - ${proposal.description}${categoryLabel}`);
    }
  }

  if (savedCount === 0) {
    return null;
  }

  // Create pending action for undo/edit
  const pendingPayload = savedTransactions.length === 1
    ? {
        saved_transaction_id: savedTransactions[0].id,
        table: link.company_id ? 'company_transactions' : 'transactions',
        ...savedTransactions[0].proposal,
      }
    : {
        transactions: savedTransactions.map((t) => ({
          saved_transaction_id: t.id,
          ...t.proposal,
        })),
        saved_transaction_ids: savedTransactions.map((t) => t.id),
        table: link.company_id ? 'company_transactions' : 'transactions',
        original_text: message,
      };

  await supabase.from('whatsapp_pending_actions').insert({
    profile_id: link.profile_id,
    company_id: link.company_id ?? null,
    phone,
    kind: 'create_transaction',
    payload: pendingPayload,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });

  const undoHint = '\n\n_Responda *não* para desfazer, *editar* para corrigir._';

  if (valid.length > 1) {
    const header = `✅ ${savedCount} transações registradas:`;
    return { confirmation: `${header}\n${confirmations.join('\n')}${undoHint}` };
  }

  return { confirmation: confirmations[0] + undoHint };
}

// ============================================================================
// Pending Actions (Undo / Edit / Confirm)
// ============================================================================

async function getLatestPendingAction(supabase: any, profileId: string, phone: string) {
  const { data } = await supabase
    .from('whatsapp_pending_actions')
    .select('*')
    .eq('profile_id', profileId)
    .eq('phone', phone)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as any | null;
}

function isAffirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ['sim', 'confirmar', 'confirmo', 'ok', 'isso', 'isso mesmo', '1'].includes(t);
}

function isRejection(text: string): boolean {
  const t = text.trim().toLowerCase();
  return ['não', 'nao', 'cancelar', 'cancela', 'desfazer', '2'].includes(t);
}

function parseEditCommand(text: string): { index: number | null; text: string } | null {
  const trimmed = text.trim();
  // "editar 2 Internet 350,00"
  const withIndex = trimmed.match(/^(editar|edit)\s+(\d+)\s+([\s\S]+)$/i);
  if (withIndex) {
    return { index: Number(withIndex[2]), text: withIndex[3].trim() };
  }
  // "Editar Amazon Prime 1300 para Amazon Prime" → extract text after "para"
  const withPara = trimmed.match(/^(editar|edit)\s+.+\s+para\s+([\s\S]+)$/i);
  if (withPara) {
    return { index: null, text: withPara[2].trim() };
  }
  // "editar Internet"
  const single = trimmed.match(/^(editar|edit)\s+([\s\S]+)$/i);
  if (single) {
    return { index: null, text: single[2].trim() };
  }
  return null;
}

function parseRemoveCommand(text: string): { index: number; description: string | null } | null {
  const trimmed = text.trim();
  // "apagar 2" or "remover 3"
  const withIndex = trimmed.match(/^(remover|remova|excluir|apagar|delete)\s+(\d+)\s*$/i);
  if (withIndex) return { index: Number(withIndex[2]), description: null };
  // "apagar" alone → delete all (index 0)
  const single = trimmed.match(/^(remover|remova|excluir|apagar|delete)\s*$/i);
  if (single) return { index: 0, description: null };
  // "apagar Ajaw" or "remover Internet" → match by description
  const withDesc = trimmed.match(/^(remover|remova|excluir|apagar|delete)\s+(.+)$/i);
  if (withDesc) return { index: -1, description: withDesc[2].trim() };
  return null;
}

async function handlePendingConfirmation(
  supabase: any,
  link: any,
  phone: string,
  text: string,
  pending: any,
): Promise<string> {
  const payload = pending.payload ?? {};
  const batch = Array.isArray(payload.transactions) ? payload.transactions : null;
  const table = payload.table || (link.company_id ? 'company_transactions' : 'transactions');
  const editCommand = parseEditCommand(text);
  const removeCmd = parseRemoveCommand(text);

  // ── Batch path ──
  if (batch?.length) {
    if (isAffirmation(text)) {
      await supabase.from('whatsapp_pending_actions').update({ status: 'executed' }).eq('id', pending.id);
      return 'Ok, mantidos ✅';
    }

    if (isRejection(text)) {
      const ids = (payload.saved_transaction_ids ?? batch.map((t: any) => t.saved_transaction_id)).filter(Boolean);
      if (ids.length) {
        await supabase.from(table).delete().in('id', ids);
      }
      await supabase.from('whatsapp_pending_actions').update({ status: 'canceled' }).eq('id', pending.id);
      return 'Apagado ✅';
    }

    if (removeCmd !== null) {
      if (removeCmd.index === 0) {
        // Delete all
        const ids = (payload.saved_transaction_ids ?? batch.map((t: any) => t.saved_transaction_id)).filter(Boolean);
        if (ids.length) await supabase.from(table).delete().in('id', ids);
        await supabase.from('whatsapp_pending_actions').update({ status: 'canceled' }).eq('id', pending.id);
        return 'Apagado ✅';
      }

      // Resolve index: by number or by description match
      let resolvedIndex = removeCmd.index;
      if (removeCmd.index === -1 && removeCmd.description) {
        const descLower = removeCmd.description.toLowerCase();
        resolvedIndex = batch.findIndex((t: any) => t.description?.toLowerCase().includes(descLower));
        if (resolvedIndex === -1) {
          return `Não encontrei item "${removeCmd.description}". Use *remover* N com o número do item.`;
        }
        resolvedIndex += 1; // convert to 1-based
      }

      if (resolvedIndex < 1 || resolvedIndex > batch.length) {
        return `Item inválido. Informe um número entre 1 e ${batch.length}.`;
      }
      const target = batch[resolvedIndex - 1];
      if (target.saved_transaction_id) {
        await supabase.from(table).delete().eq('id', target.saved_transaction_id);
      }
      const updatedBatch = batch.filter((_: any, idx: number) => idx !== resolvedIndex - 1);
      if (!updatedBatch.length) {
        await supabase.from('whatsapp_pending_actions').update({ status: 'canceled' }).eq('id', pending.id);
        return 'Apagado ✅';
      }
      await supabase.from('whatsapp_pending_actions')
        .update({
          payload: {
            ...payload,
            transactions: updatedBatch,
            saved_transaction_ids: updatedBatch.map((t: any) => t.saved_transaction_id).filter(Boolean),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', pending.id);
      return `Removido ✅ ${target.description ?? `item ${resolvedIndex}`}.`;
    }

    if (editCommand) {
      // Resolve index: by number or by description match
      let editIndex = editCommand.index;
      if (editIndex === null) {
        // Try to match by description text
        const descLower = editCommand.text.toLowerCase();
        const matched = batch.findIndex((t: any) => t.description?.toLowerCase().includes(descLower));
        if (matched === -1) {
          return 'Qual item? Envie: *editar* 2 <novo texto>';
        }
        editIndex = matched + 1;
      }
      if (editIndex < 1 || editIndex > batch.length) {
        return `Item inválido. Informe um número entre 1 e ${batch.length}.`;
      }
      const target = batch[editIndex - 1];
      const updatedFields = await parseEditFields(editCommand.text, target);
      if (target.saved_transaction_id) {
        await supabase.from(table).update(updatedFields).eq('id', target.saved_transaction_id);
      }
      const updatedBatch = [...batch];
      updatedBatch[editIndex - 1] = { ...target, ...updatedFields };
      await supabase.from('whatsapp_pending_actions')
        .update({ payload: { ...payload, transactions: updatedBatch }, updated_at: new Date().toISOString() })
        .eq('id', pending.id);
      return `Atualizado ✅ ${formatCurrency(updatedFields.amount)} · ${updatedFields.description}`;
    }

    // Unrecognized — show summary again
    const lines = batch.map((t: any, i: number) => `${i + 1}) ${formatCurrency(t.amount)} · ${t.description}`).join('\n');
    return `${lines}\n\n_Responda *sim* para manter, *não* para apagar, *editar* N <texto>, ou *remover* N._`;
  }

  // ── Single transaction path ──

  if (isAffirmation(text)) {
    await supabase.from('whatsapp_pending_actions').update({ status: 'executed' }).eq('id', pending.id);
    return 'Ok, mantido ✅';
  }

  if (isRejection(text)) {
    if (payload.saved_transaction_id) {
      await supabase.from(table).delete().eq('id', payload.saved_transaction_id);
    }
    await supabase.from('whatsapp_pending_actions').update({ status: 'canceled' }).eq('id', pending.id);
    return 'Apagado ✅';
  }

  if (editCommand) {
    const updatedFields = await parseEditFields(editCommand.text, payload);
    if (payload.saved_transaction_id) {
      await supabase.from(table).update(updatedFields).eq('id', payload.saved_transaction_id);
    }
    await supabase.from('whatsapp_pending_actions')
      .update({ payload: { ...payload, ...updatedFields, saved_transaction_id: payload.saved_transaction_id }, updated_at: new Date().toISOString() })
      .eq('id', pending.id);
    return `Atualizado ✅ ${formatCurrency(updatedFields.amount)} · ${updatedFields.description}`;
  }

  if (removeCmd !== null) {
    if (payload.saved_transaction_id) {
      await supabase.from(table).delete().eq('id', payload.saved_transaction_id);
    }
    await supabase.from('whatsapp_pending_actions').update({ status: 'canceled' }).eq('id', pending.id);
    return 'Apagado ✅';
  }

  // Unrecognized — show summary
  return `${formatCurrency(payload.amount)} · ${payload.description}\n\n_Responda *sim* para manter, *não* para apagar, ou *editar* <novo texto>._`;
}

async function parseEditFields(
  text: string,
  original: any,
): Promise<{ description: string; amount: number; type: 'despesa' | 'receita'; date: string }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  if (openaiKey) {
    try {
      const nowIso = new Date().toISOString().slice(0, 10);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          messages: [
            {
              role: 'system',
              content: `O usuário está editando uma transação existente. A transação atual é:
- Descrição: "${original.description}"
- Valor: ${original.amount}
- Tipo: ${original.type}
- Data: ${original.date ?? nowIso}

O usuário enviou uma correção. Extraia os novos valores. Se o usuário só informou descrição, mantenha o valor original. Se só informou valor, mantenha a descrição original.

Retorne APENAS JSON: {"description": string, "amount": number, "type": "despesa"|"receita", "date": "YYYY-MM-DD"}`,
            },
            { role: 'user', content: text },
          ],
          temperature: 0,
          max_tokens: 150,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return {
            description: String(parsed.description || original.description).slice(0, 500),
            amount: Number(parsed.amount) || original.amount,
            type: parsed.type === 'receita' ? 'receita' : 'despesa',
            date: parsed.date || original.date || nowIso,
          };
        }
      }
    } catch {
      // Fall through to heuristic
    }
  }

  // Heuristic fallback
  const now = new Date();
  const parsed = extractTransactionHeuristic(text, now);
  return {
    description: parsed.description && parsed.description !== 'Transação via WhatsApp'
      ? parsed.description : original.description,
    amount: parsed.amount > 0 ? parsed.amount : original.amount,
    type: parsed.amount > 0 ? parsed.type : original.type,
    date: parsed.date || original.date,
  };
}

// ── Heuristic extraction ──

function extractTransactionHeuristic(text: string, now: Date): TransactionProposal {
  const amount = parseBRLAmount(text) ?? 0;
  const lower = text.toLowerCase();
  const type: 'despesa' | 'receita' =
    (lower.includes('recebi') || lower.includes('ganhei') || lower.includes('vendi'))
      ? 'receita'
      : 'despesa';
  const date = inferDate(text, now);
  const description = inferDescription(text);
  const category_name = classifyCategory(description);

  return { amount, description, type, date, category_name };
}

function parseBRLAmount(text: string): number | null {
  const normalized = text.replace(/\s+/g, ' ');

  // "R$ 1.234,56" or "R$ 13000" — R$ prefix makes any number an amount
  const m1 = normalized.match(/r\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{1,2})?)/i);
  if (m1) return brNumberToFloat(m1[1]);

  // "1.234,56" or "123,45" — comma decimals are clearly BRL amounts
  const m2 = normalized.match(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{1,2})\b/);
  if (m2) return brNumberToFloat(m2[1]);

  // Whole numbers only when preceded by a separator: "- 13000", "– 500"
  const m3 = normalized.match(/[-–—]\s*([0-9]{2,})\s*$/);
  if (m3) return Number(m3[1]);

  return null;
}

function brNumberToFloat(value: string): number {
  const v = value.replace(/\./g, '').replace(',', '.');
  return Number(v);
}

function inferDate(text: string, now: Date): string {
  const lower = text.toLowerCase();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  if (lower.includes('ontem')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (lower.includes('hoje')) return today.toISOString().slice(0, 10);

  const dmy = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const yearRaw = dmy[3] ? Number(dmy[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return today.toISOString().slice(0, 10);
}

function inferDescription(text: string): string {
  const cleaned = text
    .replace(/^\s*(gastei|paguei|comprei|recebi|ganhei|vendi|saquei)\s+/i, '')
    .replace(/r\$\s*[0-9.,\s]+/gi, '')
    // Strip BRL-formatted amounts: "500,32", "3.250,00", "299,9"
    .replace(/\b\d{1,3}(?:\.\d{3})*(?:,[0-9]{1,2})\b/g, '')
    // Strip separator + whole number at end: "- 13000"
    .replace(/[-–—]\s*\d{2,}\s*$/, '')
    .replace(/\b(hoje|ontem)\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, '')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .replace(/^(no|na|em|para|por|de)\s+/i, '')
    .trim();
  if (cleaned.length < 3) return 'Transação via WhatsApp';
  return capitalizeSentence(cleaned.slice(0, 500));
}

// ── Multiple transaction detection ──

function extractTransactionCandidates(text: string): string[] {
  // Check for numbered items: "1) ...", "2. ..."
  const numbered = extractNumberedItems(text);
  let candidates = numbered.length > 1 ? numbered : text.split(/\n+/);

  // Try semicolons
  if (candidates.length <= 1 && text.includes(';')) {
    candidates = text.split(';');
  }

  const cleaned = candidates
    .map((c) => c.replace(/^\s*[-•]\s+/, '').trim())
    .filter(Boolean);

  const withAmount = cleaned.filter((c) => parseBRLAmount(c) !== null);
  if (withAmount.length > 1) {
    return Array.from(new Set(withAmount));
  }

  return [text];
}

function extractNumberedItems(text: string): string[] {
  const items: string[] = [];
  const regex = /(?:^|\n)\s*\d+[.)]\s+([\s\S]*?)(?=(?:\n\s*\d+[.)]\s+|$))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    items.push(match[1].trim());
  }
  return items;
}

// ── AI-enhanced extraction ──

async function extractTransactionWithAI(
  apiKey: string,
  text: string,
  allowedCategories: string[],
  fallback: TransactionProposal,
): Promise<TransactionProposal> {
  const nowIso = new Date().toISOString().slice(0, 10);
  const system = `Você extrai UMA transação a partir do texto do usuário.
Retorne APENAS um JSON válido (sem markdown) seguindo este schema:
{
  "amount": number,
  "description": string,
  "type": "despesa"|"receita",
  "date": "YYYY-MM-DD",
  "category_name"?: string
}
Regras:
- amount em reais (ex.: 42.9 para R$ 42,90)
- Se data não aparecer, use hoje (${nowIso})
- category_name deve ser uma destas (se fizer sentido): ${allowedCategories.join(', ')}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return fallback;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return fallback;

    const parsed = JSON.parse(content);
    if (!parsed.amount || !parsed.description) return fallback;

    return {
      amount: Number(parsed.amount),
      description: String(parsed.description).slice(0, 500),
      type: parsed.type === 'receita' ? 'receita' : 'despesa',
      date: parsed.date ?? nowIso,
      category_name: parsed.category_name ?? null,
    };
  } catch {
    return fallback;
  }
}

async function extractTransactionsWithAI(
  apiKey: string,
  text: string,
  allowedCategories: string[],
  fallback: TransactionProposal[],
): Promise<TransactionProposal[]> {
  const nowIso = new Date().toISOString().slice(0, 10);
  const system = `Você extrai UMA OU MAIS transações a partir do texto do usuário.
Retorne APENAS um JSON válido (sem markdown) com um array de objetos seguindo este schema:
[
  {
    "amount": number,
    "description": string,
    "type": "despesa"|"receita",
    "date": "YYYY-MM-DD",
    "category_name"?: string
  }
]
Regras:
- amount em reais (ex.: 42.9 para R$ 42,90)
- Se data não aparecer, use hoje (${nowIso})
- category_name deve ser uma destas (se fizer sentido): ${allowedCategories.join(', ')}
- Se houver só uma transação, retorne um array com 1 item.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 500,
      }),
    });

    if (!response.ok) return fallback;
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return fallback;

    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .filter((item: any) => item.amount && item.description)
      .map((item: any) => ({
        amount: Number(item.amount),
        description: String(item.description).slice(0, 500),
        type: item.type === 'receita' ? 'receita' : 'despesa',
        date: item.date ?? nowIso,
        category_name: item.category_name ?? null,
      }));
  } catch {
    return fallback;
  }
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Alimentação': [
    'mercado', 'supermercado', 'padaria', 'restaurante', 'lanchonete',
    'ifood', 'rappi', 'uber eats', 'delivery', 'café', 'bar',
    'açougue', 'feira', 'hortifruti', 'pizza', 'hamburguer'
  ],
  'Transporte': [
    'uber', 'taxi', '99', 'gasolina', 'combustível', 'estacionamento',
    'pedágio', 'ônibus', 'metrô', 'trem', 'passagem', 'ipva',
    'mecânico', 'oficina', 'lava-jato', 'app transporte'
  ],
  'Saúde': [
    'farmácia', 'drogaria', 'médico', 'hospital', 'clínica',
    'dentista', 'exame', 'laboratório', 'plano de saúde',
    'remédio', 'consulta', 'fisioterapia', 'academia'
  ],
  'Educação': [
    'escola', 'faculdade', 'universidade', 'curso', 'livro',
    'material escolar', 'mensalidade', 'matrícula', 'papelaria'
  ],
  'Lazer': [
    'cinema', 'teatro', 'show', 'ingresso', 'netflix', 'spotify',
    'streaming', 'jogo', 'game', 'viagem', 'hotel', 'turismo',
    'parque', 'balada', 'festa', 'bar', 'pub'
  ],
  'Moradia': [
    'aluguel', 'condomínio', 'água', 'luz', 'energia', 'gás',
    'internet', 'iptu', 'reforma', 'material construção',
    'móveis', 'decoração', 'limpeza'
  ],
  'Vestuário': [
    'roupa', 'calça', 'camisa', 'sapato', 'tênis', 'loja',
    'shopping', 'moda', 'boutique', 'calçado'
  ],
  'Serviços': [
    'telefone', 'celular', 'banco', 'taxa', 'tarifa', 'cartório',
    'seguro', 'advogado', 'contador', 'assinatura'
  ],
};

function classifyCategory(description: string): string | null {
  const descLower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => descLower.includes(keyword))) {
      return category;
    }
  }
  return null;
}

async function findCategoryId(supabase: any, link: any, categoryName: string): Promise<string | null> {
  if (link.company_id) {
    const { data } = await supabase
      .from('company_categories')
      .select('id')
      .eq('company_id', link.company_id)
      .eq('name', categoryName)
      .maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', link.profile_id)
    .eq('name', categoryName)
    .maybeSingle();

  return data?.id ?? null;
}

async function fetchFinancialContext(supabase: any, userId: string): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('monthly_income')
    .eq('id', userId)
    .single();

  const { data: costsData, count: fixedCostsCount } = await supabase
    .from('fixed_costs')
    .select('amount', { count: 'exact' })
    .eq('user_id', userId);

  const { data: transactionsData } = await supabase
    .from('transactions')
    .select('description, amount, category_id, date, categories(name)')
    .eq('user_id', userId)
    .gte('date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
    .order('date', { ascending: false })
    .limit(10);

  const monthlyIncome = profileData?.monthly_income ? Number(profileData.monthly_income) : 0;
  const fixedCosts = costsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;
  const hasFixedCosts = (fixedCostsCount ?? 0) > 0;
  const totalExpenses = transactionsData?.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0) || 0;
  const balance = monthlyIncome - fixedCosts - totalExpenses;

  return {
    type: 'personal',
    monthlyIncome,
    fixedCosts,
    hasFixedCosts,
    totalExpenses,
    balance,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.categories?.name || 'Sem categoria',
      date: tx.date,
    })) || [],
  };
}

async function fetchCompanyFinancialContext(
  supabase: any,
  userId: string,
  companyId: string
): Promise<FinancialContext> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('company_id', companyId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error('Company access denied');

  const { data: companyData } = await supabase
    .from('companies')
    .select('monthly_revenue')
    .eq('id', companyId)
    .single();

  const monthlyRevenue = Number(companyData?.monthly_revenue ?? 0);

  const { data: fixedCostsData, count: companyFixedCostsCount } = await supabase
    .from('company_fixed_costs')
    .select('amount', { count: 'exact' })
    .eq('company_id', companyId);

  const fixedCosts = fixedCostsData?.reduce((sum: number, cost: any) => sum + Number(cost.amount), 0) || 0;
  const hasFixedCosts = (companyFixedCostsCount ?? 0) > 0;

  const startDate = new Date(currentYear, currentMonth - 1, 1);
  const endDate = new Date(currentYear, currentMonth, 0);

  const { data: transactionsData } = await supabase
    .from('company_transactions')
    .select('description, amount, type, date, company_categories(name)')
    .eq('company_id', companyId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(10);

  const expenses = transactionsData
    ?.filter((transaction: any) => transaction.type === 'despesa')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0) || 0;

  const transactionIncome = transactionsData
    ?.filter((transaction: any) => transaction.type === 'receita')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount), 0) || 0;

  const balance = monthlyRevenue + transactionIncome - fixedCosts - expenses;

  return {
    type: 'company',
    monthlyRevenue,
    fixedCosts,
    hasFixedCosts,
    expenses,
    transactionIncome,
    balance,
    recentTransactions: transactionsData?.map((tx: any) => ({
      description: tx.description,
      amount: Number(tx.amount),
      category: tx.company_categories?.name || 'Sem categoria',
      date: tx.date,
      type: tx.type,
    })) || [],
  };
}

async function buildAssistantResponse(message: string, context: FinancialContext): Promise<string> {
  const direct = getDirectResponse(message, context);
  if (direct) {
    return direct;
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    return 'Recebi sua mensagem. Se precisar, também posso registrar despesas e receitas por aqui.';
  }

  const systemPrompt = buildSystemPrompt(context);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[WhatsApp] OpenAI error:', errorData);
    return 'Tive um problema para responder agora. Tente novamente em instantes.';
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim()
    || 'Desculpe, não consegui processar sua mensagem.';
}

const balanceIntentRegex = /(saldo|quanto\s+(ainda\s+)?tenho|quanto\s+resta|dispon[ií]vel)/i;

function hasFixedCostsMention(text: string) {
  return /custo(s)?\s+fixo(s)?/i.test(text);
}

function buildFixedCostsNote(context: FinancialContext) {
  const fixedCostsNote = context.hasFixedCosts
    ? `Custos fixos: ${formatCurrency(context.fixedCosts)}.`
    : 'Não encontrei custos fixos cadastrados. Quer informar um valor para eu considerar?';
  const companyFixedCostsImpact = context.type === 'company' && context.hasFixedCosts
    ? `Saldo considerando custos fixos: ${formatCurrency(context.balance - context.fixedCosts)}.`
    : '';
  return [fixedCostsNote, companyFixedCostsImpact].filter(Boolean).join(' ');
}

function getDirectResponse(message: string, context: FinancialContext): string | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('custo fixo') || lowerMessage.includes('custos fixos') || lowerMessage.includes('consider')) {
    return null;
  }

  const isCompany = context.type === 'company';
  const totalExpenses = isCompany ? context.expenses : context.totalExpenses;
  const balanceLabel = isCompany ? 'saldo registrado' : 'saldo restante';
  const expensesLabel = isCompany ? 'despesas do mês' : 'despesas variáveis';
  const fixedCostsNote = context.hasFixedCosts
    ? ` Custos fixos: ${formatCurrency(context.fixedCosts)}.`
    : ' Não encontrei custos fixos cadastrados. Quer informar um valor para eu considerar?';
  const companyFixedCostsImpact = isCompany && context.hasFixedCosts
    ? ` Considerando custos fixos, o saldo fica ${formatCurrency(context.balance - context.fixedCosts)}.`
    : '';

  if (balanceIntentRegex.test(lowerMessage)) {
    return `Seu ${balanceLabel} este mês é de ${formatCurrency(context.balance)}. Você já registrou ${formatCurrency(totalExpenses)} em ${expensesLabel}.${fixedCostsNote}${companyFixedCostsImpact}`;
  }

  if (lowerMessage.includes('gasto') || lowerMessage.includes('gastei') || lowerMessage.includes('despesa')) {
    const topExpenses = context.recentTransactions.slice(0, 3);
    const expensesText = topExpenses.length
      ? topExpenses.map(tx => `${tx.category} (${formatCurrency(tx.amount)})`).join(', ')
      : 'sem categorias detalhadas no período.';
    return `Você gastou ${formatCurrency(totalExpenses)} este mês, distribuídos em: ${expensesText}.${fixedCostsNote}${companyFixedCostsImpact}`;
  }

  if (lowerMessage.includes('adicionar') || lowerMessage.includes('registrar')) {
    return 'Claro! Me envie o valor e a descrição que eu registro por aqui.';
  }

  return null;
}

function extractPairingCode(message: string): string | null {
  const match = message.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

function formatPhoneForTitle(value: string): string {
  if (value.length <= 4) return value;
  return `...${value.slice(-4)}`;
}

function capitalizeSentence(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

/**
 * Extract phone_number_id from the Meta webhook payload.
 * Supports the nested Meta structure (entry[].changes[].value.metadata.phone_number_id)
 * and a flat { metadata: { phone_number_id } } shape.
 */
function extractPhoneNumberId(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // { metadata: { phone_number_id: "..." } }
  if (obj.metadata && typeof obj.metadata === 'object') {
    const meta = obj.metadata as Record<string, unknown>;
    if (typeof meta.phone_number_id === 'string') return meta.phone_number_id;
  }

  // Full Meta webhook: { entry: [{ changes: [{ value: { metadata: { phone_number_id } } }] }] }
  if (Array.isArray(obj.entry)) {
    for (const entry of obj.entry) {
      if (entry && typeof entry === 'object' && Array.isArray((entry as any).changes)) {
        for (const change of (entry as any).changes) {
          const phoneId = change?.value?.metadata?.phone_number_id;
          if (typeof phoneId === 'string') return phoneId;
        }
      }
    }
  }

  return null;
}

function extractMessages(payload: any): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];

  // Official Meta webhook format
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value;
      collectMessages(value?.messages, messages);
    }
  }

  // Some brokers/webhooks forward only the "value" object
  collectMessages(payload?.messages, messages);

  // Some integrations wrap the original payload under "body"
  collectMessages(payload?.body?.messages, messages);

  return messages;
}

function collectMessages(source: any, target: WhatsAppMessage[]) {
  const eventMessages = Array.isArray(source) ? source : [];
  for (const msg of eventMessages) {
    if (msg?.type === 'text' && msg?.text?.body) {
      target.push(msg as WhatsAppTextMessage);
    } else if (msg?.type === 'image' && msg?.image?.id) {
      target.push(msg as WhatsAppImageMessage);
    } else if (msg?.type === 'audio' && msg?.audio?.id) {
      target.push(msg as WhatsAppAudioMessage);
    } else if (msg?.type === 'document' && msg?.document?.id) {
      target.push(msg as WhatsAppDocumentMessage);
    }
  }
}

async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    return false;
  }

  const [algo, signature] = signatureHeader.split('=');
  if (algo !== 'sha256' || !signature) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = toHex(mac);
  return timingSafeEqual(signature.toLowerCase(), expected.toLowerCase());
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
