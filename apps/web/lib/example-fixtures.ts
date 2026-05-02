import type {
  GuideCandidate,
  ProvenanceEvent,
  ProvenanceEventType,
} from "./types";

export type ExampleCategory =
  | "Therapeutic"
  | "Knockout"
  | "Base editing"
  | "Failed runs";

export interface ExampleFixture {
  slug: string;
  title: string;
  subtitle: string;
  categories: ExampleCategory[];
  status: "done" | "failed";
  topScore: number | null;
  guideCount: number | null;
  backgroundContext: string;
  clinicalRelevance: string;
  sequence: string;
  prompt: string;
  researchObject: {
    id: string;
    content_hash: string;
    backbone_sha256: string;
    pam: "NGG";
    metadata: Record<string, string>;
    created_at: string;
    created_by: string;
    backbone_ref: { bucket: string; path: string };
  };
  run: {
    id: string;
    ro_id: string;
    prompt: string;
    status: "done" | "failed";
    manifest: {
      git_sha: string;
      api_version: string;
      scoring_versions: Record<string, string>;
      env_fingerprint: string;
      started_at: string;
    };
    created_at: string;
    finished_at: string | null;
  };
  events: Array<{
    id: string;
    run_id: string;
    seq: number;
    event_type: ProvenanceEventType;
    payload: Record<string, unknown>;
    emitted_at: string;
  }>;
  prediction: {
    guides: GuideCandidate[];
    summary: Record<string, unknown>;
  } | null;
  exportPackHash: string;
  errorMessage: string | null;
}

// Shared across all demo fixtures for reproducibility
const DEMO_GIT_SHA = "a7e3086f4c9d2b1e8a5f3c7d0b2e9a6f4c1d8b5e";
const DEMO_ENV_FP = "e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6d8e0b2d4f6a8c0e2f4a6";
const DEMO_USER = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Fixture 1: BCL11A enhancer disruption (Sickle cell / Casgevy)
// ---------------------------------------------------------------------------

const BCL11A_GUIDES: GuideCandidate[] = [
  {
    sequence: "GTAACGGCAGACTTCTCCTC",
    pam: "AGG",
    position: 142,
    strand: "+",
    on_target_score: 0.87,
    off_target_count: 2,
    off_target_top_hits: [
      { sequence: "GTAACGGCAGACTTCTCCTT", position: 5246319, mismatches: 1, cfd_score: 0.04 },
      { sequence: "GTAACGGCAGATTTCTCCTC", position: 117559884, mismatches: 1, cfd_score: 0.02 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CCTGGGAATGTGGTGGGAGA",
    pam: "AGG",
    position: 201,
    strand: "+",
    on_target_score: 0.71,
    off_target_count: 5,
    off_target_top_hits: [
      { sequence: "CCTGGAAATGTGGTGGGAGA", position: 2847392, mismatches: 1, cfd_score: 0.09 },
      { sequence: "CCTGGGAATGTGGTGGGAGG", position: 48923751, mismatches: 1, cfd_score: 0.06 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "ACAGATCCCAGCCATCCTGG",
    pam: "AGG",
    position: 278,
    strand: "+",
    on_target_score: 0.65,
    off_target_count: 1,
    off_target_top_hits: [
      { sequence: "ACAGATCCCAGCCATCCTGA", position: 13457890, mismatches: 1, cfd_score: 0.03 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CAGGAGCCACAGATCCCAGC",
    pam: "CGG",
    position: 347,
    strand: "+",
    on_target_score: 0.52,
    off_target_count: 8,
    off_target_top_hits: [
      { sequence: "CAGGAGCCACAGATCCCAGC", position: 91234567, mismatches: 2, cfd_score: 0.22 },
      { sequence: "CAGGAGCCACAGATCCCAGT", position: 37812456, mismatches: 1, cfd_score: 0.18 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GCAGAGACCTGTCCCCAGAG",
    pam: "TGG",
    position: 388,
    strand: "-",
    on_target_score: 0.38,
    off_target_count: 0,
    off_target_top_hits: [],
    bystander_warnings: [],
  },
];

function bcl11aEvents(): ExampleFixture["events"] {
  const runId = "run-demo-bcl11a";
  const base = new Date("2026-04-28T09:15:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  return [
    { id: "evt-bcl-01", run_id: runId, seq: 1, event_type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, emitted_at: t(0) },
    { id: "evt-bcl-02", run_id: runId, seq: 2, event_type: "run.extract.features", payload: { guides_candidate_count: 31, pam: "NGG" }, emitted_at: t(2000) },
    { id: "evt-bcl-03", run_id: runId, seq: 3, event_type: "run.simulate.tick", payload: { tick: 1, progress: 0.3 }, emitted_at: t(4500) },
    { id: "evt-bcl-04", run_id: runId, seq: 4, event_type: "run.simulate.tick", payload: { tick: 2, progress: 0.6 }, emitted_at: t(7000) },
    { id: "evt-bcl-05", run_id: runId, seq: 5, event_type: "run.score.emit", payload: { guide_seq: "GTAACGGCAGACTTCTCCTC", on_target_score: 0.87 }, emitted_at: t(9000) },
    { id: "evt-bcl-06", run_id: runId, seq: 6, event_type: "run.score.emit", payload: { guide_seq: "CCTGGGAATGTGGTGGGAGA", on_target_score: 0.71 }, emitted_at: t(11000) },
    { id: "evt-bcl-07", run_id: runId, seq: 7, event_type: "run.score.emit", payload: { guide_seq: "ACAGATCCCAGCCATCCTGG", on_target_score: 0.65 }, emitted_at: t(13000) },
    { id: "evt-bcl-08", run_id: runId, seq: 8, event_type: "run.score.emit", payload: { guide_seq: "CAGGAGCCACAGATCCCAGC", on_target_score: 0.52 }, emitted_at: t(15000) },
    { id: "evt-bcl-09", run_id: runId, seq: 9, event_type: "run.score.emit", payload: { guide_seq: "GCAGAGACCTGTCCCCAGAG", on_target_score: 0.38 }, emitted_at: t(17000) },
    { id: "evt-bcl-10", run_id: runId, seq: 10, event_type: "run.summary.pending", payload: { guides_scored: 5 }, emitted_at: t(19000) },
    { id: "evt-bcl-11", run_id: runId, seq: 11, event_type: "run.summary.done", payload: { top_score: 0.87, recommended_guide_idx: 0 }, emitted_at: t(21000) },
  ];
}

// ---------------------------------------------------------------------------
// Fixture 2: CFTR ΔF508 correction (Base editing)
// ---------------------------------------------------------------------------

const CFTR_GUIDES: GuideCandidate[] = [
  {
    sequence: "ATCAAAATCGGTGAATTTCG",
    pam: "TGG",
    position: 187,
    strand: "-",
    on_target_score: 0.91,
    off_target_count: 1,
    off_target_top_hits: [
      { sequence: "ATCAAAATCGGTGAATTTCA", position: 7234891, mismatches: 1, cfd_score: 0.03 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "TTTGATGACCTGATGATGCT",
    pam: "AGG",
    position: 124,
    strand: "+",
    on_target_score: 0.74,
    off_target_count: 3,
    off_target_top_hits: [
      { sequence: "TTTGATGACCTGATGATGCC", position: 43219876, mismatches: 1, cfd_score: 0.08 },
      { sequence: "TTTGATGACCTGATGATGCA", position: 98723401, mismatches: 1, cfd_score: 0.05 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GAAGGAGAAATCTTTATCAT",
    pam: "AGG",
    position: 256,
    strand: "+",
    on_target_score: 0.62,
    off_target_count: 7,
    off_target_top_hits: [
      { sequence: "GAAGGAGAAATCTTTATCAA", position: 22134567, mismatches: 1, cfd_score: 0.14 },
      { sequence: "GAAGGAGAAATCTTCATCAT", position: 67891234, mismatches: 1, cfd_score: 0.11 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GTATAAATGGTTCTATAATG",
    pam: "CGG",
    position: 423,
    strand: "+",
    on_target_score: 0.48,
    off_target_count: 2,
    off_target_top_hits: [
      { sequence: "GTATAAATGGTTCTATAATA", position: 5678901, mismatches: 1, cfd_score: 0.05 },
    ],
    bystander_warnings: [],
  },
];

function cftrEvents(): ExampleFixture["events"] {
  const runId = "run-demo-cftr";
  const base = new Date("2026-04-29T14:22:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  return [
    { id: "evt-cftr-01", run_id: runId, seq: 1, event_type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, emitted_at: t(0) },
    { id: "evt-cftr-02", run_id: runId, seq: 2, event_type: "run.extract.features", payload: { guides_candidate_count: 23, pam: "NGG" }, emitted_at: t(2000) },
    { id: "evt-cftr-03", run_id: runId, seq: 3, event_type: "run.simulate.tick", payload: { tick: 1, progress: 0.4 }, emitted_at: t(4000) },
    { id: "evt-cftr-04", run_id: runId, seq: 4, event_type: "run.simulate.tick", payload: { tick: 2, progress: 0.8 }, emitted_at: t(6500) },
    { id: "evt-cftr-05", run_id: runId, seq: 5, event_type: "run.score.emit", payload: { guide_seq: "ATCAAAATCGGTGAATTTCG", on_target_score: 0.91 }, emitted_at: t(8500) },
    { id: "evt-cftr-06", run_id: runId, seq: 6, event_type: "run.score.emit", payload: { guide_seq: "TTTGATGACCTGATGATGCT", on_target_score: 0.74 }, emitted_at: t(10500) },
    { id: "evt-cftr-07", run_id: runId, seq: 7, event_type: "run.score.emit", payload: { guide_seq: "GAAGGAGAAATCTTTATCAT", on_target_score: 0.62 }, emitted_at: t(12500) },
    { id: "evt-cftr-08", run_id: runId, seq: 8, event_type: "run.score.emit", payload: { guide_seq: "GTATAAATGGTTCTATAATG", on_target_score: 0.48 }, emitted_at: t(14500) },
    { id: "evt-cftr-09", run_id: runId, seq: 9, event_type: "run.summary.done", payload: { top_score: 0.91, recommended_guide_idx: 0 }, emitted_at: t(16000) },
  ];
}

// ---------------------------------------------------------------------------
// Fixture 3: PCSK9 knockout (Cardiovascular)
// ---------------------------------------------------------------------------

const PCSK9_GUIDES: GuideCandidate[] = [
  {
    sequence: "ATGGGGCCTGGACCAGCCTG",
    pam: "TGG",
    position: 48,
    strand: "+",
    on_target_score: 0.79,
    off_target_count: 4,
    off_target_top_hits: [
      { sequence: "ATGGGGCCTGGACCAGCCTA", position: 12389012, mismatches: 1, cfd_score: 0.09 },
      { sequence: "ATGGGGCCTGGACCAGCCTC", position: 67234567, mismatches: 1, cfd_score: 0.07 },
      { sequence: "ATGGGACCTGGACCAGCCTG", position: 234567890, mismatches: 1, cfd_score: 0.05 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GCAGGCCCAGCAGAAGCAGC",
    pam: "CGG",
    position: 178,
    strand: "-",
    on_target_score: 0.68,
    off_target_count: 6,
    off_target_top_hits: [
      { sequence: "GCAGGCCCAGCAGAAGCAGC", position: 8923456, mismatches: 2, cfd_score: 0.18 },
      { sequence: "GCAGGCCCAGCAGAAGCAGA", position: 145678901, mismatches: 1, cfd_score: 0.12 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CCTGCAAGGCCTGACCAAGC",
    pam: "AGG",
    position: 89,
    strand: "+",
    on_target_score: 0.63,
    off_target_count: 9,
    off_target_top_hits: [
      { sequence: "CCTGCAAGGCCTGACCAAGA", position: 31234567, mismatches: 1, cfd_score: 0.15 },
      { sequence: "CCTGCAAGGCCTGACCAAGG", position: 89012345, mismatches: 1, cfd_score: 0.11 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GAGCTCAAGGAGCTGAGCCA",
    pam: "GGG",
    position: 134,
    strand: "+",
    on_target_score: 0.58,
    off_target_count: 3,
    off_target_top_hits: [
      { sequence: "GAGCTCAAGGAGCTGAGCCC", position: 44567890, mismatches: 1, cfd_score: 0.06 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "GCAGTACAAGCTCTCCAGCA",
    pam: "AGG",
    position: 234,
    strand: "-",
    on_target_score: 0.44,
    off_target_count: 12,
    off_target_top_hits: [
      { sequence: "GCAGTACAAGCTCTCCAGCG", position: 17890123, mismatches: 1, cfd_score: 0.23 },
      { sequence: "GCAGTACAAGATCTCCAGCA", position: 56789012, mismatches: 1, cfd_score: 0.19 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CAAGGTGGGCTTGGCCAGCA",
    pam: "TGG",
    position: 312,
    strand: "+",
    on_target_score: 0.31,
    off_target_count: 1,
    off_target_top_hits: [
      { sequence: "CAAGGTGGGCTTGGCCAGCG", position: 78901234, mismatches: 1, cfd_score: 0.04 },
    ],
    bystander_warnings: [],
  },
];

function pcsk9Events(): ExampleFixture["events"] {
  const runId = "run-demo-pcsk9";
  const base = new Date("2026-04-30T11:08:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  return [
    { id: "evt-pcsk9-01", run_id: runId, seq: 1, event_type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, emitted_at: t(0) },
    { id: "evt-pcsk9-02", run_id: runId, seq: 2, event_type: "run.extract.features", payload: { guides_candidate_count: 38, pam: "NGG" }, emitted_at: t(2500) },
    { id: "evt-pcsk9-03", run_id: runId, seq: 3, event_type: "run.simulate.tick", payload: { tick: 1, progress: 0.25 }, emitted_at: t(5000) },
    { id: "evt-pcsk9-04", run_id: runId, seq: 4, event_type: "run.simulate.tick", payload: { tick: 2, progress: 0.55 }, emitted_at: t(7500) },
    { id: "evt-pcsk9-05", run_id: runId, seq: 5, event_type: "run.simulate.tick", payload: { tick: 3, progress: 0.85 }, emitted_at: t(10000) },
    { id: "evt-pcsk9-06", run_id: runId, seq: 6, event_type: "run.score.emit", payload: { guide_seq: "ATGGGGCCTGGACCAGCCTG", on_target_score: 0.79 }, emitted_at: t(12000) },
    { id: "evt-pcsk9-07", run_id: runId, seq: 7, event_type: "run.score.emit", payload: { guide_seq: "GCAGGCCCAGCAGAAGCAGC", on_target_score: 0.68 }, emitted_at: t(14000) },
    { id: "evt-pcsk9-08", run_id: runId, seq: 8, event_type: "run.score.emit", payload: { guide_seq: "CCTGCAAGGCCTGACCAAGC", on_target_score: 0.63 }, emitted_at: t(16000) },
    { id: "evt-pcsk9-09", run_id: runId, seq: 9, event_type: "run.score.emit", payload: { guide_seq: "GAGCTCAAGGAGCTGAGCCA", on_target_score: 0.58 }, emitted_at: t(18000) },
    { id: "evt-pcsk9-10", run_id: runId, seq: 10, event_type: "run.score.emit", payload: { guide_seq: "GCAGTACAAGCTCTCCAGCA", on_target_score: 0.44 }, emitted_at: t(20000) },
    { id: "evt-pcsk9-11", run_id: runId, seq: 11, event_type: "run.score.emit", payload: { guide_seq: "CAAGGTGGGCTTGGCCAGCA", on_target_score: 0.31 }, emitted_at: t(22000) },
    { id: "evt-pcsk9-12", run_id: runId, seq: 12, event_type: "run.summary.pending", payload: { guides_scored: 6 }, emitted_at: t(24000) },
    { id: "evt-pcsk9-13", run_id: runId, seq: 13, event_type: "run.summary.done", payload: { top_score: 0.79, recommended_guide_idx: 0 }, emitted_at: t(25500) },
  ];
}

// ---------------------------------------------------------------------------
// Fixture 4: TRAC CAR-T knockout
// ---------------------------------------------------------------------------

const TRAC_GUIDES: GuideCandidate[] = [
  {
    sequence: "GAGAATCAAAATCGGTGAAT",
    pam: "TGG",
    position: 212,
    strand: "+",
    on_target_score: 0.85,
    off_target_count: 3,
    off_target_top_hits: [
      { sequence: "GAGAATCAAAATCGGTGAAC", position: 9823456, mismatches: 1, cfd_score: 0.05 },
      { sequence: "GAGAATCAAAATCGGTGAAA", position: 58234567, mismatches: 1, cfd_score: 0.03 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "ATCAAAATCGGTGAATTTCG",
    pam: "CGG",
    position: 218,
    strand: "+",
    on_target_score: 0.71,
    off_target_count: 5,
    off_target_top_hits: [
      { sequence: "ATCAAAATCGGTGAATTTCA", position: 33456789, mismatches: 1, cfd_score: 0.08 },
    ],
    bystander_warnings: [
      "G:A transition at position +5 within ABE editing window — bystander edit risk at Gly12",
    ],
  },
  {
    sequence: "GCTTCTGCTGCTTCTGGGGC",
    pam: "TGG",
    position: 334,
    strand: "-",
    on_target_score: 0.69,
    off_target_count: 2,
    off_target_top_hits: [
      { sequence: "GCTTCTGCTGCTTCTGGGAC", position: 67890123, mismatches: 1, cfd_score: 0.06 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "CAGACAGTTGGCCAGCACAA",
    pam: "AGG",
    position: 447,
    strand: "+",
    on_target_score: 0.53,
    off_target_count: 7,
    off_target_top_hits: [
      { sequence: "CAGACAGTTGGCCAGCACAG", position: 23456789, mismatches: 1, cfd_score: 0.12 },
      { sequence: "CAGACAGTTGGCCAGCACAC", position: 89012345, mismatches: 1, cfd_score: 0.09 },
    ],
    bystander_warnings: [],
  },
  {
    sequence: "TGTGCAGTGAAAGATGGCAA",
    pam: "GGG",
    position: 521,
    strand: "-",
    on_target_score: 0.42,
    off_target_count: 1,
    off_target_top_hits: [
      { sequence: "TGTGCAGTGAAAGATGGCAG", position: 4567890, mismatches: 1, cfd_score: 0.02 },
    ],
    bystander_warnings: [],
  },
];

function tracEvents(): ExampleFixture["events"] {
  const runId = "run-demo-trac";
  const base = new Date("2026-04-30T16:45:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  return [
    { id: "evt-trac-01", run_id: runId, seq: 1, event_type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, emitted_at: t(0) },
    { id: "evt-trac-02", run_id: runId, seq: 2, event_type: "run.extract.features", payload: { guides_candidate_count: 29, pam: "NGG" }, emitted_at: t(2000) },
    { id: "evt-trac-03", run_id: runId, seq: 3, event_type: "run.simulate.tick", payload: { tick: 1, progress: 0.35 }, emitted_at: t(4500) },
    { id: "evt-trac-04", run_id: runId, seq: 4, event_type: "run.simulate.tick", payload: { tick: 2, progress: 0.7 }, emitted_at: t(7000) },
    { id: "evt-trac-05", run_id: runId, seq: 5, event_type: "run.score.emit", payload: { guide_seq: "GAGAATCAAAATCGGTGAAT", on_target_score: 0.85 }, emitted_at: t(9000) },
    { id: "evt-trac-06", run_id: runId, seq: 6, event_type: "run.score.emit", payload: { guide_seq: "ATCAAAATCGGTGAATTTCG", on_target_score: 0.71, bystander_warning: true }, emitted_at: t(11000) },
    { id: "evt-trac-07", run_id: runId, seq: 7, event_type: "run.score.emit", payload: { guide_seq: "GCTTCTGCTGCTTCTGGGGC", on_target_score: 0.69 }, emitted_at: t(13000) },
    { id: "evt-trac-08", run_id: runId, seq: 8, event_type: "run.score.emit", payload: { guide_seq: "CAGACAGTTGGCCAGCACAA", on_target_score: 0.53 }, emitted_at: t(15000) },
    { id: "evt-trac-09", run_id: runId, seq: 9, event_type: "run.score.emit", payload: { guide_seq: "TGTGCAGTGAAAGATGGCAA", on_target_score: 0.42 }, emitted_at: t(17000) },
    { id: "evt-trac-10", run_id: runId, seq: 10, event_type: "run.summary.done", payload: { top_score: 0.85, recommended_guide_idx: 0, bystander_warning_count: 1 }, emitted_at: t(19000) },
  ];
}

// ---------------------------------------------------------------------------
// Fixture 5: Failed — low quality input
// ---------------------------------------------------------------------------

function failedEvents(): ExampleFixture["events"] {
  const runId = "run-demo-failed";
  const base = new Date("2026-04-28T17:30:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  return [
    {
      id: "evt-fail-01",
      run_id: runId,
      seq: 1,
      event_type: "run.preflight.ok",
      payload: {
        message: "Inputs validated, hashes recorded",
        warnings: ["Low-complexity sequence detected — scoring accuracy may be reduced"],
      },
      emitted_at: t(0),
    },
    {
      id: "evt-fail-02",
      run_id: runId,
      seq: 2,
      event_type: "run.extract.features",
      payload: {
        error: "Sequence quality below threshold — median Doench-RS2 score for low-complexity input is unreliable. PAM scan returned 0 high-quality candidates. Aborting.",
        guides_candidate_count: 0,
      },
      emitted_at: t(4000),
    },
  ];
}

// ---------------------------------------------------------------------------
// Fixture 6: Multi-target HBA1/HBA2 (12 guides)
// ---------------------------------------------------------------------------

const HBA_GUIDES: GuideCandidate[] = [
  {
    sequence: "ATGGTGCTGTCTCCTGCCGA",
    pam: "TGG",
    position: 48,
    strand: "+",
    on_target_score: 0.83,
    off_target_count: 2,
    off_target_top_hits: [{ sequence: "ATGGTGCTGTCTCCTGCCGG", position: 4567890, mismatches: 1, cfd_score: 0.06 }],
    bystander_warnings: [],
  },
  {
    sequence: "GCGCACGCTGGCGAGTATGG",
    pam: "TGG",
    position: 89,
    strand: "+",
    on_target_score: 0.78,
    off_target_count: 3,
    off_target_top_hits: [{ sequence: "GCGCACGCTGGCGAGTATGA", position: 12345678, mismatches: 1, cfd_score: 0.08 }],
    bystander_warnings: [],
  },
  {
    sequence: "TCCTTGGGGATCTTGAAGGG",
    pam: "CGG",
    position: 134,
    strand: "+",
    on_target_score: 0.74,
    off_target_count: 5,
    off_target_top_hits: [{ sequence: "TCCTTGGGGATCTTGAAGAG", position: 23456789, mismatches: 1, cfd_score: 0.11 }],
    bystander_warnings: [],
  },
  {
    sequence: "CATGGGAAGGCTTTCATTGG",
    pam: "TGG",
    position: 178,
    strand: "+",
    on_target_score: 0.71,
    off_target_count: 4,
    off_target_top_hits: [{ sequence: "CATGGGAAGGCTTTCATTGA", position: 34567890, mismatches: 1, cfd_score: 0.07 }],
    bystander_warnings: [],
  },
  {
    sequence: "GCAGAGGTGCAGCTTGTCCT",
    pam: "AGG",
    position: 231,
    strand: "-",
    on_target_score: 0.68,
    off_target_count: 7,
    off_target_top_hits: [{ sequence: "GCAGAGGTGCAGCTTGTCCG", position: 45678901, mismatches: 1, cfd_score: 0.14 }],
    bystander_warnings: [],
  },
  {
    sequence: "GCACAGCCCACGGTGTGGCA",
    pam: "CGG",
    position: 278,
    strand: "+",
    on_target_score: 0.62,
    off_target_count: 9,
    off_target_top_hits: [{ sequence: "GCACAGCCCACGGTGTGGCC", position: 56789012, mismatches: 1, cfd_score: 0.16 }],
    bystander_warnings: [],
  },
  {
    sequence: "GGAGCTTGGTGGTGGCCAAG",
    pam: "AGG",
    position: 323,
    strand: "+",
    on_target_score: 0.57,
    off_target_count: 6,
    off_target_top_hits: [{ sequence: "GGAGCTTGGTGGTGGCCAAA", position: 67890123, mismatches: 1, cfd_score: 0.10 }],
    bystander_warnings: [],
  },
  {
    sequence: "GCCCATTTCAAGATCAAGGT",
    pam: "TGG",
    position: 378,
    strand: "-",
    on_target_score: 0.53,
    off_target_count: 11,
    off_target_top_hits: [{ sequence: "GCCCATTTCAAGATCAAGGG", position: 78901234, mismatches: 1, cfd_score: 0.18 }],
    bystander_warnings: [],
  },
  {
    sequence: "AAGAAATCCAGCAAGATCCA",
    pam: "TGG",
    position: 434,
    strand: "+",
    on_target_score: 0.49,
    off_target_count: 3,
    off_target_top_hits: [{ sequence: "AAGAAATCCAGCAAGATCCC", position: 89012345, mismatches: 1, cfd_score: 0.05 }],
    bystander_warnings: [],
  },
  {
    sequence: "CTGCTGGCTGGCAAGGTCGG",
    pam: "TGG",
    position: 489,
    strand: "+",
    on_target_score: 0.44,
    off_target_count: 8,
    off_target_top_hits: [{ sequence: "CTGCTGGCTGGCAAGGTCGA", position: 90123456, mismatches: 1, cfd_score: 0.13 }],
    bystander_warnings: [],
  },
  {
    sequence: "GAGTATGGTGCGGAGGCCCT",
    pam: "TGG",
    position: 543,
    strand: "+",
    on_target_score: 0.38,
    off_target_count: 2,
    off_target_top_hits: [{ sequence: "GAGTATGGTGCGGAGGCCCA", position: 1234567, mismatches: 1, cfd_score: 0.04 }],
    bystander_warnings: [],
  },
  {
    sequence: "ACGTACAGCTTGTGGTGAGC",
    pam: "AGG",
    position: 612,
    strand: "-",
    on_target_score: 0.29,
    off_target_count: 14,
    off_target_top_hits: [{ sequence: "ACGTACAGCTTGTGGTGAGC", position: 23456789, mismatches: 2, cfd_score: 0.25 }],
    bystander_warnings: [],
  },
];

function hbaEvents(): ExampleFixture["events"] {
  const runId = "run-demo-hba";
  const base = new Date("2026-05-01T10:30:00.000Z").getTime();
  const t = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  const scoreEmits: ExampleFixture["events"] = HBA_GUIDES.map((g, i) => ({
    id: `evt-hba-score-${String(i + 1).padStart(2, "0")}`,
    run_id: runId,
    seq: 8 + i,
    event_type: "run.score.emit" as ProvenanceEventType,
    payload: { guide_seq: g.sequence, on_target_score: g.on_target_score },
    emitted_at: t(16000 + i * 1500),
  }));

  return [
    { id: "evt-hba-01", run_id: runId, seq: 1, event_type: "run.preflight.ok", payload: { message: "Inputs validated, hashes recorded" }, emitted_at: t(0) },
    { id: "evt-hba-02", run_id: runId, seq: 2, event_type: "run.extract.features", payload: { guides_candidate_count: 51, pam: "NGG", loci: ["HBA1", "HBA2"] }, emitted_at: t(3000) },
    { id: "evt-hba-03", run_id: runId, seq: 3, event_type: "run.simulate.tick", payload: { tick: 1, progress: 0.2 }, emitted_at: t(6000) },
    { id: "evt-hba-04", run_id: runId, seq: 4, event_type: "run.simulate.tick", payload: { tick: 2, progress: 0.4 }, emitted_at: t(8500) },
    { id: "evt-hba-05", run_id: runId, seq: 5, event_type: "run.simulate.tick", payload: { tick: 3, progress: 0.6 }, emitted_at: t(11000) },
    { id: "evt-hba-06", run_id: runId, seq: 6, event_type: "run.simulate.tick", payload: { tick: 4, progress: 0.75 }, emitted_at: t(13000) },
    { id: "evt-hba-07", run_id: runId, seq: 7, event_type: "run.simulate.tick", payload: { tick: 5, progress: 0.9 }, emitted_at: t(15000) },
    ...scoreEmits,
    {
      id: "evt-hba-pend",
      run_id: runId,
      seq: 20,
      event_type: "run.summary.pending",
      payload: { guides_scored: 12 },
      emitted_at: t(33500),
    },
    {
      id: "evt-hba-done",
      run_id: runId,
      seq: 21,
      event_type: "run.summary.done",
      payload: { top_score: 0.83, recommended_guide_idx: 0 },
      emitted_at: t(35000),
    },
  ];
}

// ---------------------------------------------------------------------------
// Master fixtures array
// ---------------------------------------------------------------------------

export const EXAMPLE_FIXTURES: ExampleFixture[] = [
  // ---- 1. BCL11A ----
  {
    slug: "bcl11a-enhancer-disruption",
    title: "BCL11A enhancer disruption",
    subtitle: "Sickle cell disease — GATA1 binding site disruption at +58 erythroid enhancer",
    categories: ["Therapeutic"],
    status: "done",
    topScore: 0.87,
    guideCount: 5,
    backgroundContext:
      "The BCL11A +58 erythroid enhancer silences fetal hemoglobin (HbF) in adult red blood cells by facilitating GATA1-dependent repression. Disrupting this enhancer reactivates HbF production, compensating for the defective adult hemoglobin in sickle cell disease.",
    clinicalRelevance:
      "Casgevy (exagamglogene autotemcel) — the first CRISPR therapy to receive FDA approval (December 2023) — uses this exact mechanism to treat sickle cell disease.",
    sequence: `>BCL11A_enhancer_plus58 chr2:60495978-60496378 hg38 | BCL11A +58 erythroid enhancer (synthetic test fixture, 400bp)
GGATCCAGCTGCAGTGGGCAGAGACCTGTCCCCAGAGCCTGGGAATGTGG
TGGGAGAACAGAGGAGAGCAGGAGCCACAGATCCCAGCCATCCTGGAAGG
AGGCAGAGCCACAGGATCCAGGGCAGCAGATCCTGGAAGGCAGCCTGCAG
GCAGAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGATGGAG
AGCAGGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCA
GAGACCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCA
GGAGCCACAGATCCCAGCCATCCTGGAAGGAGGCAGCCTGCAGGCAGAGA
CCTGTCCCCAGAGCCTGGGAATGTGGTGGGAGAACAGAGGAGAGCAGGAG`,
    prompt: "Disrupt GATA1 binding site at +58 enhancer",
    researchObject: {
      id: "ro-demo-bcl11a",
      content_hash: "4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e",
      backbone_sha256: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
      pam: "NGG",
      metadata: { source: "GRCh38", region: "chr2:60,495,978-60,496,378", gene: "BCL11A", target: "GATA1-binding site" },
      created_at: "2026-04-28T09:00:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/bcl11a_enhancer.fasta" },
    },
    run: {
      id: "run-demo-bcl11a",
      ro_id: "ro-demo-bcl11a",
      prompt: "Disrupt GATA1 binding site at +58 enhancer",
      status: "done",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-04-28T09:15:00.000Z",
      },
      created_at: "2026-04-28T09:15:00.000Z",
      finished_at: "2026-04-28T09:15:21.000Z",
    },
    events: bcl11aEvents(),
    prediction: {
      guides: BCL11A_GUIDES,
      summary: { top_score: 0.87, mean_off_target_cfd: 0.04, recommended_guide_idx: 0, analysis_runtime_ms: 2847, guides_scored: 5 },
    },
    exportPackHash: "7f4a2bc8d1e9f306a8b7c4d2e1f9a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6",
    errorMessage: null,
  },

  // ---- 2. CFTR ΔF508 ----
  {
    slug: "cftr-delta-f508-correction",
    title: "CFTR ΔF508 correction",
    subtitle: "Cystic fibrosis — adenine base editing to correct phenylalanine-508 deletion in CFTR exon 11",
    categories: ["Base editing"],
    status: "done",
    topScore: 0.91,
    guideCount: 4,
    backgroundContext:
      "The CFTR ΔF508 mutation — a deletion of phenylalanine at position 508 — is present in ~70% of cystic fibrosis patients worldwide. Adenine base editing (ABE) approaches can correct this CTT→ATT transition at the genomic level without creating double-strand breaks.",
    clinicalRelevance:
      "Base editing of CFTR F508del has been demonstrated in patient-derived bronchial organoids, restoring functional CFTR chloride channel activity to near-normal levels.",
    sequence: `>CFTR_exon11_deltaF508 chr7:117,559,592-117,560,091 GRCh38 | CFTR exon 11, F508del correction target (500bp)
ATGATGATGCTTTGATGACGAGTGGTGATGAGAAGATATTCAAGAACAAT
ATCTATAAAAGGTGCAAGGTCATCTGGCCTAAGAGAGAAACCGAGAAGAA
TGCTGAAAAGGTCTTATTTGATGACCTGATGATGCTGATGAGAAAAAATC
AGTTTCCCTGGAAGAAGGAGAAATCTTTATCATAAAAGATAAAGACATAG
AGAAAGAAATCAAAATCGGTGAATTTCGTTTTTTCTTCTTCTTTGTTTAT
TTTTCTAAAGGTACTATATTCTGTATAAATGGTTCTATAATGGATTATCA
TCATCTTCTTTGTTTATTTTTCTAAAGGTACTATATTCTGTATAAATGGTT
CTATAATGGATTATCATCATCTTCTTTGTTCATTTTTCTAAAGGTACTATA
TTCTGTATAAAT`,
    prompt: "Correct F508del mutation in CFTR exon 11",
    researchObject: {
      id: "ro-demo-cftr",
      content_hash: "8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b",
      backbone_sha256: "c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6d8e0b2d4f6a8c0e2f4a6b8d0e2f4",
      pam: "NGG",
      metadata: { source: "GRCh38", region: "chr7:117,559,592-117,560,091", gene: "CFTR", variant: "c.1521_1523delCTT (p.Phe508del)" },
      created_at: "2026-04-29T14:00:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/cftr_exon11.fasta" },
    },
    run: {
      id: "run-demo-cftr",
      ro_id: "ro-demo-cftr",
      prompt: "Correct F508del mutation in CFTR exon 11",
      status: "done",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-04-29T14:22:00.000Z",
      },
      created_at: "2026-04-29T14:22:00.000Z",
      finished_at: "2026-04-29T14:22:16.000Z",
    },
    events: cftrEvents(),
    prediction: {
      guides: CFTR_GUIDES,
      summary: { top_score: 0.91, mean_off_target_cfd: 0.02, recommended_guide_idx: 0, analysis_runtime_ms: 1934, guides_scored: 4 },
    },
    exportPackHash: "b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6d8e0b2d4f6a8c0",
    errorMessage: null,
  },

  // ---- 3. PCSK9 knockout ----
  {
    slug: "pcsk9-knockout",
    title: "PCSK9 knockout",
    subtitle: "Cardiovascular — LDL receptor regulation via NHEJ-mediated PCSK9 disruption",
    categories: ["Knockout"],
    status: "done",
    topScore: 0.79,
    guideCount: 6,
    backgroundContext:
      "PCSK9 (proprotein convertase subtilisin/kexin type 9) is a serine protease that targets LDL receptors for lysosomal degradation, reducing the liver's ability to clear LDL cholesterol from the blood. Loss-of-function mutations in PCSK9 naturally reduce LDL by 28% and dramatically lower cardiovascular risk.",
    clinicalRelevance:
      "CRISPR-based PCSK9 editing in primate models achieved >60% reduction in circulating LDL-C with a single treatment, sustained over 8 months of follow-up — Intellia's NTLA-2001 program has entered Phase 1 clinical trials.",
    sequence: `>PCSK9_exon1 chr1:55,039,548-55,039,947 GRCh38 | PCSK9 exon 1, LDL receptor regulation target (400bp)
ATGGGGCCTGGACCAGCCTGCAGCAGCCTGCAAGGCCTGACCAAGCAGGT
GCAGCTGCAGCAGTGGGAGCTCAAGGAGCTGAGCCAGCTCCTCAATGGAG
CCACGGATGCAGTACAAGCTCTCCAGCAAGATCAGCACCATCACCAAGGT
GGGCTTGGCCAGCAATGCCCTCATGCAGCAGTTCCAGAAGCAGGCCCAGC
AGAAGCAGCTCCTCAATGGGCCTGAGGAGCTCTCCAAGGAGCTCAGCCAG
CTCCTGAATGGAGCCACGGATGCAGTACAAGCTCTCCAGCAAGATCAGCA
CCATCACCAAGGTGGGCTTGGCCAGCAATGCCCTCATGCAGCAGTTCCAG
AAGCAGGCCCAGCAGAAGCAGCTCCTCAATGGGCCTGAGGAGCTCTCC`,
    prompt: "Disrupt PCSK9 to lower LDL cholesterol",
    researchObject: {
      id: "ro-demo-pcsk9",
      content_hash: "5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
      backbone_sha256: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
      pam: "NGG",
      metadata: { source: "GRCh38", region: "chr1:55,039,548-55,039,947", gene: "PCSK9", mechanism: "NHEJ knockout" },
      created_at: "2026-04-30T11:00:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/pcsk9_exon1.fasta" },
    },
    run: {
      id: "run-demo-pcsk9",
      ro_id: "ro-demo-pcsk9",
      prompt: "Disrupt PCSK9 to lower LDL cholesterol",
      status: "done",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-04-30T11:08:00.000Z",
      },
      created_at: "2026-04-30T11:08:00.000Z",
      finished_at: "2026-04-30T11:08:25.500Z",
    },
    events: pcsk9Events(),
    prediction: {
      guides: PCSK9_GUIDES,
      summary: { top_score: 0.79, mean_off_target_cfd: 0.09, recommended_guide_idx: 0, analysis_runtime_ms: 3421, guides_scored: 6 },
    },
    exportPackHash: "d4f6a8b0c2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6e8b0d2f4a6",
    errorMessage: null,
  },

  // ---- 4. TRAC CAR-T ----
  {
    slug: "trac-car-t-knockout",
    title: "TRAC locus knockout",
    subtitle: "Allogeneic CAR-T engineering — TCR alpha constant region disruption for off-the-shelf therapy",
    categories: ["Therapeutic", "Knockout"],
    status: "done",
    topScore: 0.85,
    guideCount: 5,
    backgroundContext:
      "The TRAC locus encodes the constant region of the T-cell receptor alpha chain. Disrupting TRAC via CRISPR prevents endogenous TCR expression, allowing engineered CAR-T cells to be transplanted across HLA boundaries without triggering graft-versus-host disease.",
    clinicalRelevance:
      "Allogeneic TRAC-knocked-out CAR-T cells enabled 'off-the-shelf' therapy in relapsed/refractory B-cell malignancies (UCART19/CTL019 programs), with complete remissions reported in paediatric patients.",
    sequence: `>TRAC_exon1 chr14:22,547,506-22,548,105 GRCh38 | TRAC exon 1, allogeneic CAR-T engineering target (600bp)
ATGCTGCTGCTTCTGCTGCTTCTGGGGCTCAGAGCTCCAGAGCTGAAGAT
GCAGATCGCCCAGACACAGACAGTTGGCCAGCACAAGAATGTGGAGCAGC
AGGCAGAGAAGACATTTGTCTGTGCAGTGAAAGATGGCAAGGACAAACAG
ATGACTTCCAAGATCAAAGAGTTCGTGGACACCCTTAACAACAGCAGCAAG
AAGGCCATCAGCAACAACTTCAGCATCAGCCTGGTGGGAGCCGAGAAGAT
CACCAAGGCCTACAACAGCAGCATCAGCAACAACTTCAGCATCAGCCTGG
TGGGAGCCGAGAAGATCACCAAGGCCTACAACAGCAGTGGAGCCACCAAG
GCAGAGAAGACATTTGTCTGTGCAGTGAAAGATGGCAAGGACAAACAGATG
ACTTCCAAGATCAAAGAGTTCGTGGACACCCTTAACAACAGCAGCAAGAAGG
CCATCAGCAACAACTTCAGCATCAGCCTGGTGGGAGCCGAGAAGATCACCAA
GGCCTACAACAGCAGCATCAGCAACAACTTCAGCATCAGCCTGGTGGGAGCC`,
    prompt: "Knockout TRAC for allogeneic CAR-T cell engineering",
    researchObject: {
      id: "ro-demo-trac",
      content_hash: "6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
      backbone_sha256: "a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4c6",
      pam: "NGG",
      metadata: { source: "GRCh38", region: "chr14:22,547,506-22,548,105", gene: "TRAC", application: "allogeneic CAR-T" },
      created_at: "2026-04-30T16:30:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/trac_exon1.fasta" },
    },
    run: {
      id: "run-demo-trac",
      ro_id: "ro-demo-trac",
      prompt: "Knockout TRAC for allogeneic CAR-T cell engineering",
      status: "done",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-04-30T16:45:00.000Z",
      },
      created_at: "2026-04-30T16:45:00.000Z",
      finished_at: "2026-04-30T16:45:19.000Z",
    },
    events: tracEvents(),
    prediction: {
      guides: TRAC_GUIDES,
      summary: { top_score: 0.85, mean_off_target_cfd: 0.05, recommended_guide_idx: 0, bystander_warning_count: 1, analysis_runtime_ms: 2619, guides_scored: 5 },
    },
    exportPackHash: "f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2f4a6c8e0b2d4f6a8c0e2f4a6b8d0e2f4",
    errorMessage: null,
  },

  // ---- 5. Failed run ----
  {
    slug: "failed-low-quality-input",
    title: "Low-quality input (failed run)",
    subtitle: "Demonstration of graceful failure — low-complexity repetitive sequence rejected by the pipeline",
    categories: ["Failed runs"],
    status: "failed",
    topScore: null,
    guideCount: null,
    backgroundContext:
      "This demonstration run shows how the pipeline handles low-quality or low-complexity sequences. The input contained repetitive low-complexity DNA that is not a suitable CRISPR editing target.",
    clinicalRelevance:
      "Graceful failure handling prevents misleading results — the pipeline rejects sequences where scoring algorithms cannot produce reliable predictions.",
    sequence: `>unknown_fragment_lowqual synthetic | low-complexity fragmented input (180bp)
AAAAAAAGGGGGGGCCCCCCCTTTTTTAAAAAAAGGGGGGCCCCCCCTTTT
TTAAAAAGGGGGCCCCCTTTTAAAAAGGGCCCTTTTAAAGGGCCCTTTAAA
GGGCCCAAAGCCTTTAAAGCCTAAAGCTAAAGCAAAGCAAGCAAAGCAAAG
CAAGCAAAGCAAAGCAAAGCAAAGCAAAGC`,
    prompt: "Edit unclear region in fragmented sequence",
    researchObject: {
      id: "ro-demo-failed",
      content_hash: "3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c",
      backbone_sha256: "f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8",
      pam: "NGG",
      metadata: { source: "unknown", quality: "low", note: "low-complexity fragmented sequence" },
      created_at: "2026-04-28T17:25:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/lowqual_fragment.fasta" },
    },
    run: {
      id: "run-demo-failed",
      ro_id: "ro-demo-failed",
      prompt: "Edit unclear region in fragmented sequence",
      status: "failed",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-04-28T17:30:00.000Z",
      },
      created_at: "2026-04-28T17:30:00.000Z",
      finished_at: "2026-04-28T17:30:08.000Z",
    },
    events: failedEvents(),
    prediction: null,
    exportPackHash: "0000000000000000000000000000000000000000000000000000000000000000",
    errorMessage:
      "Pipeline aborted at feature extraction: low-complexity sequence yielded 0 high-quality PAM candidates. Check that your backbone FASTA contains a real genomic target with sufficient sequence diversity.",
  },

  // ---- 6. HBA1/HBA2 multi-target ----
  {
    slug: "multi-target-hba1-hba2",
    title: "HBA1/HBA2 multi-target editing",
    subtitle: "Alpha-thalassemia — dual-locus guide discovery across the alpha-globin cluster on chr16",
    categories: ["Therapeutic"],
    status: "done",
    topScore: 0.83,
    guideCount: 12,
    backgroundContext:
      "Alpha-thalassemia is caused by deletions in the alpha-globin gene cluster on chromosome 16, which encodes HBA1 and HBA2. These two highly similar genes (96% identity) share regulatory elements, making simultaneous dual-locus editing both challenging and therapeutically powerful.",
    clinicalRelevance:
      "Correction of alpha-thalassemia major (Hb Bart's hydrops fetalis) requires restoration of all four alpha-globin alleles — a multi-target editing problem that CRISPR approaches are uniquely positioned to address.",
    sequence: `>HBA1_HBA2_combined chr16:226,679-227,478 GRCh38 | HBA1/HBA2 alpha-globin locus, alpha-thalassemia target (800bp)
ATGGTGCTGTCTCCTGCCGACAAGACCAACGTCAAGGCCGCCTGGGGTAA
GGTCGGCGCGCACGCTGGCGAGTATGGTGCGGAGGCCCTGGAGAGGATGT
TCCTTGGGGATCTTGAAGGGGACGTGCAGCTTGTGGTGAGCATGGCCTTG
GCGGTGGCCAAGCTCAAGGGGCATGGGAAGGCTTTCATTGGCACTGATGG
CGCCTTCGCAGCACTGCTACCTGCAGCAGAGGTGCAGCTTGTCCTGCTGC
AGGCACTGGCCTGGGGCACAGCCCACGGTGTGGCAGCGCTTCTCCTCGTG
CCGTGGACAGCGCCATCTGCGTGGACACCATCAACTTCAAGCTCCTGGGG
AGCTTGGTGGTGGCCAAGAAGCAGCACGGCAAGCACAAGGGCCTGGAGCT
GTTCCGCATGGTCAACCCAGAGGATGTCCAGAAGGCCATGGCCCATTTCAA
GATCAAGGTTCAGCTGCAGCAGAAGATCAAGTCCAAGCGCATCGGCATCAA
GAAATCCAGCAAGATCCACAAGCTCATCAGCCTGGTCACGAATCTGCTGGC
TGGCAAGGTCGGCACGCACGCTGGCGAGTATGGTGCGGAGGCCCTGGAGA
GGATGTTCCTTGGCGATCTTGAAGGGGACGTACAGCTTGTGGTGAGCATGG
CCTTGGCGGTGGCCAAGCTTAAGGGG`,
    prompt: "Find all viable guides across HBA1/HBA2 loci for alpha-thalassemia correction",
    researchObject: {
      id: "ro-demo-hba",
      content_hash: "1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e",
      backbone_sha256: "b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1f3a5b7d9f1a3c5e7",
      pam: "NGG",
      metadata: { source: "GRCh38", region: "chr16:226,679-227,478", gene: "HBA1/HBA2", loci: "alpha-globin cluster" },
      created_at: "2026-05-01T10:15:00.000Z",
      created_by: DEMO_USER,
      backbone_ref: { bucket: "dnatwist-fixtures", path: "examples/hba1_hba2_combined.fasta" },
    },
    run: {
      id: "run-demo-hba",
      ro_id: "ro-demo-hba",
      prompt: "Find all viable guides across HBA1/HBA2 loci for alpha-thalassemia correction",
      status: "done",
      manifest: {
        git_sha: DEMO_GIT_SHA,
        api_version: "0.4.0",
        scoring_versions: { doench_rs2: "2.1.0", cfd: "1.0.0" },
        env_fingerprint: DEMO_ENV_FP,
        started_at: "2026-05-01T10:30:00.000Z",
      },
      created_at: "2026-05-01T10:30:00.000Z",
      finished_at: "2026-05-01T10:30:35.000Z",
    },
    events: hbaEvents(),
    prediction: {
      guides: HBA_GUIDES,
      summary: { top_score: 0.83, mean_off_target_cfd: 0.09, recommended_guide_idx: 0, analysis_runtime_ms: 5234, guides_scored: 12 },
    },
    exportPackHash: "c8e0a2b4d6f8c0e2a4b6d8f0c2e4a6b8d0f2c4e6a8b0d2f4c6e8a0b2d4f6c8e0",
    errorMessage: null,
  },
];

export function getExampleBySlug(slug: string): ExampleFixture | undefined {
  return EXAMPLE_FIXTURES.find((f) => f.slug === slug);
}
