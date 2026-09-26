import 'server-only';
import { preguntarClaude } from '@/lib/server/claude';

/**
 * Resume en 3 viñetas lo que pasa en la ciudad. `hechos` son líneas de texto que arma el cliente
 * (incidentes, reportes, camiones). Sin Claude se arma con reglas.
 */
export async function resumirCiudad(hechos: string): Promise<string> {
  const lineas = hechos.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return '• Todo tranquilo por ahora en Chihuahua.\n• Sin incidentes activos.\n• Buen momento para moverte.';
  const ia = await preguntarClaude({
    system: 'Eres ViveCUU, el asistente de movilidad de Chihuahua. Resume en exactamente 3 viñetas cortas (máx. 14 palabras cada una), en español mexicano, qué está pasando en la ciudad. Usa solo los datos dados. Empieza cada viñeta con "• ".',
    texto: `Datos en vivo:\n${lineas.slice(0, 40).join('\n')}`,
    maxTokens: 400,
    timeoutMs: 15_000,
  });
  if (ia) return ia;
  return lineas.slice(0, 3).map((l) => `• ${l}`).join('\n');
}
