import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
  payment_method?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { filePath, fileType, userId } = await req.json();

    if (!filePath || !fileType || !userId) {
      throw new Error("Missing required parameters");
    }

    // Rate limiting: 10 uploads per hour per user
    checkRateLimit(userId, { maxRequests: 10, windowMs: 3600000 }); // 1 hour

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("uploads")
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Process based on file type
    let transactions: Transaction[] = [];

    if (fileType.includes("csv") || fileType.includes("spreadsheet")) {
      transactions = await parseCSV(fileData);
    } else if (fileType.includes("json")) {
      transactions = await parseJSON(fileData);
    } else if (fileType.includes("ofx") || fileType.includes("x-ofx")) {
      transactions = await parseOFX(fileData);
    } else if (fileType.includes("image")) {

      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        transactions = await extractWithAI(fileData, fileType, openaiKey);
      } else {
        throw new Error("Document processing temporarily unavailable");
      }
    } else if (fileType.includes("pdf")) {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        transactions = await extractPDFWithClaude(fileData, anthropicKey);
      } else {
        throw new Error("Document processing temporarily unavailable");
      }
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Categorize transactions with AI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (openaiKey && transactions.length > 0) {
      transactions = await categorizeTransactions(transactions, openaiKey);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactions,
        count: transactions.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing upload:", error);

    // Generic error message for users (don't expose implementation details)
    const userMessage = error.message?.includes("Rate limit")
      ? error.message
      : "Failed to process document. Please try again or contact support.";

    return new Response(
      JSON.stringify({
        success: false,
        error: userMessage,
      }),
      {
        status: error.message?.includes("Rate limit") ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================================================
// CSV Parser
// ============================================================================
async function parseCSV(fileData: Blob): Promise<Transaction[]> {
  const text = await fileData.text();
  const lines = text.split("\n").filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid");
  }

  // Parse header
  const header = lines[0].split(/[,;]/);
  const headerLower = header.map((h) => h.toLowerCase().trim());

  // Find column indices
  const dateIdx = findColumnIndex(headerLower, ["data", "date", "dia"]);
  const descIdx = findColumnIndex(headerLower, [
    "descricao",
    "description",
    "desc",
    "historico",
  ]);
  const amountIdx = findColumnIndex(headerLower, [
    "valor",
    "amount",
    "value",
    "total",
  ]);
  const categoryIdx = findColumnIndex(headerLower, [
    "categoria",
    "category",
    "tipo",
  ]);

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error(
      "Could not identify required columns (date, description, amount)"
    );
  }

  // Parse rows
  const transactions: Transaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(/[,;]/);

    try {
      const dateStr = row[dateIdx]?.trim();
      const description = row[descIdx]?.trim();
      const amountStr = row[amountIdx]
        ?.trim()
        .replace(/[^\d,.-]/g, "")
        .replace(",", ".");

      if (!dateStr || !description || !amountStr) continue;

      const date = parseDate(dateStr);
      const amount = Math.abs(parseFloat(amountStr));

      transactions.push({
        date: date.toISOString().split("T")[0],
        description,
        amount,
        category: categoryIdx !== -1 ? row[categoryIdx]?.trim() : undefined,
        payment_method: "imported",
      });
    } catch (err) {
      console.error(`Error parsing row ${i}:`, err);
      continue;
    }
  }

  return transactions;
}

// ============================================================================
// JSON Parser
// ============================================================================
async function parseJSON(fileData: Blob): Promise<Transaction[]> {
  const text = await fileData.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    throw new Error("JSON must be an array of transactions");
  }

  return data.map((item) => ({
    date: item.date || item.data,
    description: item.description || item.descricao || item.desc,
    amount: Math.abs(parseFloat(item.amount || item.valor)),
    category: item.category || item.categoria,
    payment_method: item.payment_method || "imported",
  }));
}

// ============================================================================
// OFX Parser
// ============================================================================
async function parseOFX(fileData: Blob): Promise<Transaction[]> {
  const text = await fileData.text();
  const transactions: Transaction[] = [];

  // Simple OFX parsing (STMTTRN tags)
  const stmtRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = stmtRegex.exec(text)) !== null) {
    const txn = match[1];

    const dateMatch = txn.match(/<DTPOSTED>(\d{8})/);
    const amountMatch = txn.match(/<TRNAMT>([-\d.]+)/);
    const memoMatch = txn.match(/<MEMO>(.*?)(?:<|$)/);

    if (dateMatch && amountMatch) {
      const dateStr = dateMatch[1];
      const date = `${dateStr.substring(0, 4)}-${dateStr.substring(
        4,
        6
      )}-${dateStr.substring(6, 8)}`;
      const amount = Math.abs(parseFloat(amountMatch[1]));
      const description = memoMatch ? memoMatch[1].trim() : "Transaction";

      transactions.push({
        date,
        description,
        amount,
        payment_method: "imported",
      });
    }
  }

  return transactions;
}

// ============================================================================
// AI Extraction (PDF/Images)
// ============================================================================
async function extractWithAI(
  fileData: Blob,
  fileType: string,
  apiKey: string
): Promise<Transaction[]> {
  // Check file size (max 5MB for vision API)
  const sizeMB = fileData.size / (1024 * 1024);
  if (sizeMB > 5) {
    throw new Error(
      `File too large for AI processing: ${sizeMB.toFixed(1)}MB (max 5MB)`
    );
  }

  // Convert to base64 in chunks to avoid stack overflow
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Convert in chunks of 8192 bytes
  let base64 = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode(...chunk);
  }
  base64 = btoa(base64);

  const mimeType = fileType.includes("png") ? "image/png" : "image/jpeg";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract ALL transactions from this invoice/statement. Return a JSON array with format:
[{"date": "YYYY-MM-DD", "description": "text", "amount": number}]
Only return the JSON array, no other text.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("API error:", errorData);
    throw new Error(`API error: ${response.statusText} - ${errorData}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "[]";

  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not extract transactions from image");
  }

  const transactions = JSON.parse(jsonMatch[0]);
  return transactions.map((t: any) => ({
    ...t,
    amount: Math.abs(parseFloat(t.amount)),
    payment_method: "imported",
  }));
}

// ============================================================================
// AI Categorization
// ============================================================================
async function categorizeTransactions(
  transactions: Transaction[],
  apiKey: string
): Promise<Transaction[]> {
  const descriptions = transactions.map((t) => t.description).join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a financial categorization AI. Categorize transactions into: Alimentação, Transporte, Saúde, Educação, Lazer, Casa, Vestuário, Outros.",
        },
        {
          role: "user",
          content: `Categorize these transactions. Return only a JSON array with categories in the same order:\n${descriptions}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    console.error("Failed to categorize transactions");
    return transactions;
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "[]";

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const categories = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return transactions.map((t, i) => ({
      ...t,
      category: categories[i] || t.category || "Outros",
    }));
  } catch {
    return transactions;
  }
}

// ============================================================================
// PDF Extraction
// ============================================================================
async function extractPDFWithClaude(
  fileData: Blob,
  apiKey: string
): Promise<Transaction[]> {
  // Check file size (max 10MB for Claude)
  const sizeMB = fileData.size / (1024 * 1024);
  if (sizeMB > 10) {
    throw new Error(`PDF too large: ${sizeMB.toFixed(1)}MB (max 10MB)`);
  }

  // Convert to base64
  const arrayBuffer = await fileData.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let base64 = "";
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    base64 += String.fromCharCode(...chunk);
  }
  base64 = btoa(base64);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract ALL transactions from this PDF invoice/statement. Return ONLY a JSON array with this exact format:
[{"date": "YYYY-MM-DD", "description": "text", "amount": number}]

Rules:
- Extract every transaction line
- Convert dates to YYYY-MM-DD format
- Amount should be positive number only
- Description should be clear and concise
- Return ONLY the JSON array, no markdown, no explanation`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("API error:", errorData);
    throw new Error(`API error: ${response.statusText} - ${errorData}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text || "[]";

  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Could not extract JSON from:", content);
    throw new Error("Could not extract transactions from PDF");
  }

  const transactions = JSON.parse(jsonMatch[0]);
  return transactions.map((t: any) => ({
    ...t,
    amount: Math.abs(parseFloat(t.amount)),
    payment_method: "imported",
  }));
}

// ============================================================================
// Helper Functions
// ============================================================================
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.findIndex((h) => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(dateStr: string): Date {
  // Try DD/MM/YYYY
  let match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return new Date(
      parseInt(match[3]),
      parseInt(match[2]) - 1,
      parseInt(match[1])
    );
  }

  // Try YYYY-MM-DD
  match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );
  }

  // Try parsing directly
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Could not parse date: ${dateStr}`);
}
