import { ImageResponse } from "next/og";

export const alt = "CasAI — Provenance Lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Radial teal glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 55% at 50% 45%, rgba(94,234,212,0.13) 0%, transparent 70%)",
          }}
        />

        {/* Grid lines — approximate */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            position: "relative",
          }}
        >
          {/* Eyebrow pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid rgba(94,234,212,0.25)",
              borderRadius: 999,
              padding: "6px 20px",
              background: "rgba(94,234,212,0.06)",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#5eead4",
              }}
            />
            <span
              style={{
                color: "#5eead4",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Provenance Lab
            </span>
          </div>

          {/* Wordmark */}
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#fafafa",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            CasAI
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.45)",
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            Hash, version, and replay every CRISPR experiment.
          </div>

          {/* Hash strip */}
          <div
            style={{
              marginTop: 8,
              padding: "10px 28px",
              background: "rgba(94,234,212,0.08)",
              border: "1px solid rgba(94,234,212,0.2)",
              borderRadius: 10,
              fontFamily: "monospace",
              fontSize: 15,
              color: "#5eead4",
              letterSpacing: "0.05em",
            }}
          >
            9f3ca4e2b87d1f605c3a29e4d81f9b0e3c5d7a2f1e8b4c6d9a0f3e7b2c5d8a1f4
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            fontSize: 13,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.06em",
            fontFamily: "monospace",
          }}
        >
          cas-ai.app
        </div>
      </div>
    ),
    { ...size }
  );
}
