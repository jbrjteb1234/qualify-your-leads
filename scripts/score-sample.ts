// Proves the scoring-config swap: the SAME extracted enquiry is scored under
// whatever config path is passed in. Run with:
//   npx tsx scripts/score-sample.ts scoring.config.yaml
//   npx tsx scripts/score-sample.ts config-examples/clinic.yaml
import { loadScoringConfig, scoreLead } from "../src/lib/scoring";

const configPath = process.argv[2] ?? "scoring.config.yaml";

// A realistic extraction of the standard test enquiry.
const extracted = {
  parseable: true,
  name: "Jane Carter",
  company: null,
  email: "jane.carter@example.com",
  phone: "07700 900123",
  request_summary: "Wants to sell a 3-bed house and asks for a valuation.",
  budget_signals: "budget of around £2k for fees",
  urgency_signals: "hoping to move quickly, ideally within two months",
};

const raw = {
  message:
    "Hi, we're looking to sell our 3-bed house and would like a valuation. " +
    "We're hoping to move quickly, ideally within two months, and have a budget " +
    "of around £2k for fees. Please call me on 07700 900123.",
};

const config = loadScoringConfig(configPath);
const result = scoreLead(extracted, raw, config);
console.log(JSON.stringify({ config: config.name, ...result }, null, 2));
