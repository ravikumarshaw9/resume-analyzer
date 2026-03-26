import { useState, useRef, useCallback } from "react";

const ROLES = [
  { id: "software", label: "Software Engineer", company: "Google / Meta / Amazon" },
  { id: "data", label: "Data Scientist", company: "Netflix / Airbnb" },
  { id: "product", label: "Product Manager", company: "Microsoft / Apple" },
  { id: "sap", label: "SAP Consultant", company: "SAP / Deloitte" },
  { id: "devops", label: "DevOps / SRE", company: "AWS / Cloudflare" },
  { id: "design", label: "UX Designer", company: "Adobe / Figma" },
  { id: "finance", label: "Finance Analyst", company: "Goldman / JP Morgan" },
  { id: "marketing", label: "Digital Marketing", company: "HubSpot / Salesforce" },
];

const ScoreRing = ({ score, size = 120 }) => {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-border-tertiary)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
      <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--color-text-primary)">{score}</text>
      <text x="50" y="60" textAnchor="middle" fontSize="10" fill="var(--color-text-secondary)">ATS Score</text>
    </svg>
  );
};

const Badge = ({ text, type = "neutral" }) => {
  const styles = {
    neutral: { bg: "var(--color-background-secondary)", color: "var(--color-text-secondary)" },
    success: { bg: "var(--color-background-success)", color: "var(--color-text-success)" },
    warn: { bg: "var(--color-background-warning)", color: "var(--color-text-warning)" },
    danger: { bg: "var(--color-background-danger)", color: "var(--color-text-danger)" },
    info: { bg: "var(--color-background-info)", color: "var(--color-text-info)" },
  };
  const s = styles[type];
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "999px",
      fontSize: "12px", fontWeight: 500, background: s.bg, color: s.color,
      border: `0.5px solid ${s.color}22`, marginRight: 6, marginBottom: 6
    }}>{text}</span>
  );
};

const Section = ({ title, icon, children }) => (
  <div style={{
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)",
    padding: "1.25rem",
    marginBottom: "1rem"
  }}>
    <p style={{ margin: "0 0 0.75rem", fontWeight: 500, fontSize: 14, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 16 }}>{icon}</span> {title}
    </p>
    {children}
  </div>
);

export default function ResumeAnalyzer() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedRole, setSelectedRole] = useState("software");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const toBase64 = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(f);
    });

  const processFile = async (f) => {
    if (!f) return;
    if (f.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setFile(f);
    setFileName(f.name);
    setError("");
    setResult(null);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, []);

  const analyze = async () => {
    if (!apiKey) { setError("Please enter your Anthropic API key."); return; }
    if (!file) { setError("Please upload a resume PDF."); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const base64 = await toBase64(file);
      const role = ROLES.find(r => r.id === selectedRole);
      const prompt = `You are an expert ATS (Applicant Tracking System) and resume coach. Analyze this resume PDF for the role of "${role.label}" (companies like ${role.company}).

Return ONLY valid JSON (no markdown, no extra text) in this exact structure:
{
  "ats_score": <integer 0-100>,
  "summary": "<2 sentences: overall verdict>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "missing_keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"],
  "improvements": [
    {"area": "<area name>", "suggestion": "<specific actionable suggestion>"},
    {"area": "<area name>", "suggestion": "<specific actionable suggestion>"},
    {"area": "<area name>", "suggestion": "<specific actionable suggestion>"}
  ],
  "role_fit": {
    "score": <integer 0-100>,
    "verdict": "<one sentence verdict for ${role.label} role>",
    "tips": ["<company-specific tip>", "<company-specific tip>"]
  },
  "format_issues": ["<issue 1>", "<issue 2>"] 
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              { type: "text", text: prompt }
            ]
          }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "API error");
      }

      const data = await response.json();
      const text = data.content.map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
    } catch (e) {
      setError(e.message || "Something went wrong. Check your API key and try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
          Resume Analyzer
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 14 }}>
          AI-powered ATS scoring, keyword gaps & role-specific feedback
        </p>
      </div>

      {/* Config Card */}
      <div style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1.25rem",
        marginBottom: "1rem"
      }}>
        {/* API Key */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Anthropic API Key
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 13 }}
            />
            <button onClick={() => setShowKey(v => !v)} style={{ padding: "0 12px", fontSize: 12, whiteSpace: "nowrap" }}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "4px 0 0" }}>
            Key stays in your browser — never stored or sent anywhere else.
          </p>
        </div>

        {/* Role Selector */}
        <div>
          <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Target Role
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRole(r.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "var(--border-radius-md)",
                  textAlign: "left",
                  fontSize: 13,
                  background: selectedRole === r.id ? "var(--color-background-info)" : "var(--color-background-secondary)",
                  color: selectedRole === r.id ? "var(--color-text-info)" : "var(--color-text-primary)",
                  border: selectedRole === r.id ? "1px solid var(--color-border-info)" : "0.5px solid var(--color-border-tertiary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{r.company}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--color-border-info)" : "var(--color-border-secondary)"}`,
          borderRadius: "var(--border-radius-lg)",
          padding: "2rem",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--color-background-info)" : "var(--color-background-secondary)",
          marginBottom: "1rem",
          transition: "all 0.2s"
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
        {fileName ? (
          <p style={{ margin: 0, fontWeight: 500, color: "var(--color-text-primary)", fontSize: 14 }}>
            {fileName}
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 14, color: "var(--color-text-primary)" }}>
              Drop your resume PDF here
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)" }}>
              or click to browse
            </p>
          </>
        )}
      </div>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--border-radius-md)",
          background: "var(--color-background-danger)", color: "var(--color-text-danger)",
          fontSize: 13, marginBottom: "1rem", border: "0.5px solid var(--color-border-danger)"
        }}>{error}</div>
      )}

      <button
        onClick={analyze}
        disabled={loading || !file || !apiKey}
        style={{
          width: "100%", padding: "12px", fontSize: 15, fontWeight: 500,
          borderRadius: "var(--border-radius-md)", cursor: loading ? "wait" : "pointer",
          background: loading ? "var(--color-background-secondary)" : "var(--color-text-primary)",
          color: loading ? "var(--color-text-secondary)" : "var(--color-background-primary)",
          border: "none", marginBottom: "1.5rem",
          opacity: (!file || !apiKey) ? 0.5 : 1,
          transition: "opacity 0.2s"
        }}
      >
        {loading ? "Analyzing your resume..." : "Analyze Resume →"}
      </button>

      {/* Results */}
      {result && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

          {/* Score row */}
          <div style={{
            display: "grid", gridTemplateColumns: "auto 1fr", gap: "1.5rem", alignItems: "center",
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-lg)",
            padding: "1.25rem", marginBottom: "1rem"
          }}>
            <ScoreRing score={result.ats_score} />
            <div>
              <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "var(--color-text-primary)" }}>{result.role_fit?.score ?? "–"}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Role Fit</div>
                </div>
                <div style={{ width: "0.5px", background: "var(--color-border-tertiary)" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                    {result.role_fit?.verdict}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                    {result.summary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths */}
          <Section title="Strengths" icon="✓">
            {result.strengths?.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ color: "var(--color-text-success)", fontWeight: 600, marginTop: 1 }}>+</span>
                <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </Section>

          {/* Missing Keywords */}
          <Section title="Missing Keywords" icon="🔑">
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--color-text-secondary)" }}>
              Add these to improve ATS matching for {ROLES.find(r => r.id === selectedRole)?.label}:
            </p>
            <div>
              {result.missing_keywords?.map((k, i) => <Badge key={i} text={k} type="warn" />)}
            </div>
          </Section>

          {/* Improvements */}
          <Section title="Suggested Improvements" icon="↑">
            {result.improvements?.map((imp, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: "var(--border-radius-md)",
                background: "var(--color-background-secondary)",
                marginBottom: i < result.improvements.length - 1 ? 8 : 0
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-info)", marginBottom: 3 }}>{imp.area}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{imp.suggestion}</div>
              </div>
            ))}
          </Section>

          {/* Role Tips */}
          {result.role_fit?.tips?.length > 0 && (
            <Section title={`Tips for ${ROLES.find(r => r.id === selectedRole)?.company}`} icon="🎯">
              {result.role_fit.tips.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--color-text-info)", fontWeight: 600, marginTop: 1 }}>→</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
            </Section>
          )}

          {/* Format Issues */}
          {result.format_issues?.length > 0 && (
            <Section title="Format Issues" icon="⚠">
              {result.format_issues.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ color: "var(--color-text-warning)", fontWeight: 600, marginTop: 1 }}>!</span>
                  <span style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </Section>
          )}

          <button
            onClick={() => { setResult(null); setFile(null); setFileName(""); }}
            style={{ width: "100%", padding: "10px", fontSize: 13, borderRadius: "var(--border-radius-md)", cursor: "pointer", marginTop: 4 }}
          >
            Analyze another resume
          </button>
        </div>
      )}
    </div>
  );
}