import rulesConfig from './rules.json';
import type {
  AllAnswers,
  GeneratedSuggestion,
  RuleCondition,
  RuleLogic,
  RulesConfig,
} from './types';

const config = rulesConfig as RulesConfig;

function findAnswer(all: AllAnswers, field: string): unknown {
  for (const sectionId of Object.keys(all)) {
    const s = all[sectionId];
    if (s && Object.prototype.hasOwnProperty.call(s, field)) {
      return s[field];
    }
  }
  return undefined;
}

function asString(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(' ');
  return String(v);
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function includesAny(haystack: string, needles: string | string[]): boolean {
  const arr = Array.isArray(needles) ? needles : [needles];
  return arr.some((n) => haystack.includes(n));
}

function evalCondition(all: AllAnswers, c: RuleCondition): boolean {
  const value = findAnswer(all, c.field);
  switch (c.op) {
    case 'empty':
      return isEmpty(value);
    case 'not_empty':
      return !isEmpty(value);
    case 'empty_or_contains':
      return isEmpty(value) || includesAny(asString(value), c.value as string | string[]);
    case 'contains':
      return includesAny(asString(value), c.value as string | string[]);
    case 'equals':
      return asString(value) === String(c.value);
    case 'gt':
      return Number(value) > Number(c.value);
    case 'lt':
      return Number(value) < Number(c.value);
    default:
      return false;
  }
}

function evalLogic(all: AllAnswers, logic: RuleLogic): boolean {
  if (logic.all && logic.all.length > 0) {
    return logic.all.every((c) => evalCondition(all, c));
  }
  if (logic.any && logic.any.length > 0) {
    return logic.any.some((c) => evalCondition(all, c));
  }
  return false;
}

export function generateSuggestions(all: AllAnswers): GeneratedSuggestion[] {
  const out: GeneratedSuggestion[] = [];
  for (const group of config.rule_groups) {
    for (const rule of group.rules) {
      if (evalLogic(all, rule.condition)) {
        out.push({ rule_id: rule.id, ...rule.suggestion });
      }
    }
  }
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  out.sort((a, b) => order[a.priority] - order[b.priority]);
  return out;
}
