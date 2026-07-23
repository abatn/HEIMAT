/**
 * Konvertiert `unknown` (von try/catch-Blöcken) in eine sichere Fehlermeldung.
 * Vermeidet `@typescript-eslint/no-explicit-any`-Verstöße, die früher durch
 * `catch (err: any) { ... err.message ... }`-Pattern entstanden.
 *
 * Verwendung in try/catch-Blöcken:
 *   try { ... } catch (err: unknown) {
 *     logger.warn(`Operation fehlgeschlagen: ${errorMessage(err)}`);
 *   }
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
