// 質問定義
export type QuestionType =
  | 'text' | 'textarea' | 'number' | 'tel' | 'email' | 'date'
  | 'select' | 'multi_select';

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];
  unit?: string;
  allow_other?: boolean;
  default?: string;
  source?: 'customer';
  customer_field?: string;
}

export interface ShowIf {
  section: string;
  question: string;
  includes?: string;
  equals?: string;
}

export interface Section {
  id: string;
  title: string;
  intro?: string;
  questions: Question[];
  skippable?: boolean;
  show_if?: ShowIf;
  repeatable?: { min: number; max: number; itemLabel: string };
}

export interface QuestionsConfig {
  version: string;
  sections: Section[];
}

// 回答データ
export type AnswerValue = string | string[] | number | null;
export type SectionAnswers = Record<string, AnswerValue>;
export type AllAnswers = Record<string, SectionAnswers>; // key: sectionId

// ルール定義
export type RuleOp =
  | 'empty' | 'not_empty' | 'empty_or_contains'
  | 'contains' | 'equals' | 'gt' | 'lt';

export interface RuleCondition {
  field: string;
  op: RuleOp;
  value?: string | string[] | number;
  repeatable?: boolean;
}

export interface RuleLogic {
  all?: RuleCondition[];
  any?: RuleCondition[];
}

export interface SuggestionTemplate {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  body: string;
}

export interface Rule {
  id: string;
  condition: RuleLogic;
  suggestion: SuggestionTemplate;
}

export interface RuleGroup {
  id: string;
  title: string;
  rules: Rule[];
}

export interface RulesConfig {
  version: string;
  rule_groups: RuleGroup[];
  output_template: {
    sections: Array<{ category: string; icon: string }>;
  };
}

// 生成された提案
export interface GeneratedSuggestion extends SuggestionTemplate {
  rule_id: string;
}
