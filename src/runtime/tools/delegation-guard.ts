function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Heuristic guard to reject clearly multi-action delegations.
 * Allows phrases like "do X and return/report Y".
 */
export function isLikelyCompositeDelegationTask(task: string): boolean {
  const t = normalize(task);

  if (!t) return false;
  if (/[;\n]/.test(t)) return true;

  const conjunction = /\b(and|then|also|e|depois|tambem|também|alem disso|além disso)\b/;
  if (!conjunction.test(t)) return false;

  // "and return/report" is usually part of a single atomic objective.
  const allowedSecondStep =
    /\b(and|then|e|depois)\s+(return|report|summarize|retorne|informe|resuma|mostre|show)\b/;
  if (allowedSecondStep.test(t)) return false;

  const actionVerbAfterConjunction =
    /\b(and|then|also|e|depois|tambem|também)\s+(check|ping|run|execute|search|fetch|get|list|create|update|delete|open|verify|consult|verificar|fazer|executar|buscar|obter|listar|criar|atualizar|deletar|abrir)\b/;

  return actionVerbAfterConjunction.test(t);
}

export function compositeDelegationError(): string {
  return "Delegation rejected: task must be atomic (single action). Split this request into multiple delegations, one task per action/tool.";
}

