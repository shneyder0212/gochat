export type ScamVerdict = {
  risky: boolean;
  title: string;
  detail: string;
};

const PATTERNS: { re: RegExp; title: string; detail: string }[] = [
  {
    re: /bit\.ly|tinyurl|t\.me\/|wa\.me\/|whatsapp\.com\/join/i,
    title: "Enlace acortado o de chat externo",
    detail: "Los estafadores esconden páginas falsas detrás de enlaces cortos. Ábrelo solo si conoces a quien escribe.",
  },
  {
    re: /transfer(e|encia)|western union|gift ?card|tarjeta de (regalo|prepago)|cripto|bitcoin|usdt|binance|seed phrase|frase semilla/i,
    title: "Pedido de dinero o cripto",
    detail: "GoChat nunca te pedirá pagar. Si alguien urge a enviar dinero, es muy probable que sea una estafa.",
  },
  {
    re: /c[oó]digo de verificaci[oó]n|otp|password|contrase[nñ]a|pin bancario|cvv|clave (dinamica|dinámica)/i,
    title: "Piden un código o contraseña",
    detail: "Nadie de un banco o de GoChat te pedirá códigos por chat. No los compartas.",
  },
  {
    re: /urgente|en 5 minutos|cuenta (bloqueada|suspendida)|verifica (tu|su) (identidad|cuenta)|has ganado|premio|loter[ií]a/i,
    title: "Urgencia o premio falso",
    detail: "Las estafas aprietan el tiempo para que no pienses. Pausa y comprueba por otro canal.",
  },
  {
    re: /soy (el |la )?(gerente|soporte|administrador|agente fiscal|polic[ií]a)|hacienda|sat\b|fiscal[ií]a/i,
    title: "Suplantación de autoridad",
    detail: "Un chat no es un canal oficial. Desconfía de cargos, bancos o soporte que escriben primero.",
  },
];

export function inspectText(text: string): ScamVerdict | null {
  const value = text.trim();
  if (!value) return null;
  for (const rule of PATTERNS) {
    if (rule.re.test(value)) {
      return { risky: true, title: rule.title, detail: rule.detail };
    }
  }
  const urls = value.match(/https?:\/\/[^\s]+/gi) ?? [];
  if (urls.some((url) => /login|verify|wallet|seed|password|account/i.test(url))) {
    return {
      risky: true,
      title: "Enlace con pinta de phishing",
      detail: "El enlace habla de login, cuenta o wallet. No introduzcas datos.",
    };
  }
  return null;
}
