/**
 * Validates a Brazilian phone number and returns a normalized E.164 string or an error message.
 */
export function validateBrazilianPhone(raw: string): { valid: true; normalized: string } | { valid: false; error: string } {
  const digits = raw.replace(/[^\d]/g, "");

  if (!digits) {
    return { valid: false, error: "Informe um número de WhatsApp." };
  }

  // Accept with or without country code
  let withCountry = digits;
  if (!digits.startsWith("55")) {
    // Assume Brazilian if it looks like a local number (10 or 11 digits)
    if (digits.length === 10 || digits.length === 11) {
      withCountry = `55${digits}`;
    } else {
      return { valid: false, error: "Inclua o código do país (ex: 5511999999999)." };
    }
  }

  // Brazilian number: 55 + 2-digit area code + 8 or 9-digit number = 12 or 13 digits
  if (withCountry.length < 12 || withCountry.length > 13) {
    return { valid: false, error: "Número inválido. Verifique o DDD e os dígitos." };
  }

  const areaCode = withCountry.slice(2, 4);
  const localNumber = withCountry.slice(4);

  // Mobile numbers must have 9 digits (starting with 9).
  // 8-digit numbers starting with 9 are almost certainly missing the mobile prefix.
  if (localNumber.length === 8 && localNumber.startsWith("9")) {
    return {
      valid: false,
      error: `Parece que está faltando o 9 inicial. Tente 55${areaCode}9${localNumber}.`,
    };
  }

  if (localNumber.length === 9 && !localNumber.startsWith("9")) {
    return { valid: false, error: "Celulares brasileiros devem começar com 9 após o DDD." };
  }

  return { valid: true, normalized: `+${withCountry}` };
}
