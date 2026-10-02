/**
 * País e telefone — o DDI do telefone é a fonte da verdade (decisão de 02/10).
 * A geolocalização só entra quando o telefone não identifica o país.
 * Funções puras: testáveis sem servidor.
 */

// DDI → código ISO. Os mais longos vêm primeiro na busca.
const DDI: Record<string, string> = {
  "54": "AR", "598": "UY", "55": "BR", "56": "CL", "57": "CO", "52": "MX", "51": "PE",
  "595": "PY", "591": "BO", "593": "EC", "58": "VE", "506": "CR", "507": "PA", "502": "GT",
  "503": "SV", "504": "HN", "505": "NI", "53": "CU", "1": "US", "34": "ES", "351": "PT",
  "39": "IT", "33": "FR", "49": "DE", "44": "GB", "41": "CH", "61": "AU", "972": "IL",
};
const PREFIXOS = Object.keys(DDI).sort((a, b) => b.length - a.length);

export function digitos(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}

/** País pelo DDI, ou null se o número não começa com um DDI conhecido / é curto demais. */
export function paisDoTelefone(tel: unknown): string | null {
  const d = digitos(tel);
  if (d.length < 8) return null;
  const p = PREFIXOS.find((x) => d.startsWith(x));
  return p ? DDI[p] : null;
}

/** Telefone no formato que a Meta casa melhor (E.164 sem "+"). */
export function telefoneParaMeta(tel: unknown): string {
  let d = digitos(tel);
  if (d.startsWith("54") && !d.startsWith("549")) d = `549${d.slice(2)}`; // AR celular: 54 9 ...
  if (d.startsWith("5980")) d = `598${d.slice(4)}`; // UY: sem o 0 do celular
  return d;
}

/** Chave usada no painel para cruzar com as inscrições: últimos 8 dígitos. */
export function telefoneChave(tel: unknown): string | null {
  const d = digitos(tel);
  return d.length >= 8 ? d.slice(-8) : null;
}

export function resolverPais(tel: unknown, geo: unknown): string | null {
  const t = paisDoTelefone(tel);
  if (t) return t;
  const g = String(geo ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(g) ? g : null;
}
