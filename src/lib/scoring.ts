import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";

export interface ScoringRule {
  field: string;
  when: "not_empty" | "contains" | "equals";
  values?: string[];
  points: number;
}

export interface ScoringConfig {
  name: string;
  rules: ScoringRule[];
  thresholds: { hot: number; warm: number };
}

export type Band = "hot" | "warm" | "cold";

export interface ScoreResult {
  score: number;
  band: Band;
  matched: string[]; // human-readable trace of which rules fired
}

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), "scoring.config.yaml");

export function loadScoringConfig(filePath: string = DEFAULT_CONFIG_PATH): ScoringConfig {
  const config = parse(fs.readFileSync(filePath, "utf8")) as ScoringConfig;
  if (!config || typeof config.name !== "string" || !Array.isArray(config.rules)) {
    throw new Error(`Invalid scoring config at ${filePath}: needs name and rules[]`);
  }
  const { thresholds } = config;
  if (
    !thresholds ||
    typeof thresholds.hot !== "number" ||
    typeof thresholds.warm !== "number"
  ) {
    throw new Error(`Invalid scoring config at ${filePath}: needs numeric thresholds.hot and thresholds.warm`);
  }
  for (const rule of config.rules) {
    if (typeof rule.field !== "string" || typeof rule.points !== "number") {
      throw new Error(`Invalid rule in ${filePath}: each rule needs field and points`);
    }
    if (!["not_empty", "contains", "equals"].includes(rule.when)) {
      throw new Error(`Invalid rule in ${filePath}: unknown condition "${rule.when}"`);
    }
    if ((rule.when === "contains" || rule.when === "equals") && !Array.isArray(rule.values)) {
      throw new Error(`Invalid rule in ${filePath}: "${rule.when}" needs values[]`);
    }
  }
  return config;
}

function fieldValue(
  field: string,
  extracted: Record<string, unknown>,
  raw: { message: string }
): string | null {
  const value = field === "message" ? raw.message : extracted[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function ruleMatches(
  rule: ScoringRule,
  extracted: Record<string, unknown>,
  raw: { message: string }
): boolean {
  const value = fieldValue(rule.field, extracted, raw);
  if (value === null) return false;
  switch (rule.when) {
    case "not_empty":
      return true;
    case "contains":
      return (rule.values ?? []).some((v) =>
        value.toLowerCase().includes(v.toLowerCase())
      );
    case "equals":
      return (rule.values ?? []).some(
        (v) => value.trim().toLowerCase() === v.toLowerCase()
      );
  }
}

export function scoreLead(
  extracted: Record<string, unknown>,
  raw: { message: string },
  config: ScoringConfig
): ScoreResult {
  let score = 0;
  const matched: string[] = [];
  for (const rule of config.rules) {
    if (ruleMatches(rule, extracted, raw)) {
      score += rule.points;
      matched.push(`${rule.field} ${rule.when} (+${rule.points})`);
    }
  }
  score = Math.max(0, score);
  const band: Band =
    score >= config.thresholds.hot ? "hot" : score >= config.thresholds.warm ? "warm" : "cold";
  return { score, band, matched };
}
