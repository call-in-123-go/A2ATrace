import "./agentcard.scss";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { fetchAgentLogs, LokiLine } from "../../lib/loki";

type Props = {
  serviceName: string;
  lookbackMin?: number;
  refreshMs?: number;
};

export default function AgentCard({ serviceName, lookbackMin = 5, refreshMs = 5000 }: Props) {
  const [lines, setLines] = useState<LokiLine[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const data = await fetchAgentLogs(serviceName, lookbackMin, 250);
      setLines(data);
      setErr(null);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceName, lookbackMin, refreshMs]);

  const { online, lastTs, lastLine, lastTo, errorCount } = useMemo(() => {
    if (!lines.length) return { online: false, lastTs: null as number | null, lastLine: "", lastTo: "", errorCount: 0 };
    const now = Date.now();
    const newest = lines[0];
    const online = now - newest.tsMs < 60_000;
    const lastTo = newest.labels["a2a_to"] || newest.labels["a2a.to"] || "";
    const errorCount = lines.filter(
      l =>
        (l.labels.severity && /err|error/i.test(l.labels.severity)) ||
        /(^|\W)error(\W|$)/i.test(l.line)
    ).length;
    return { online, lastTs: newest.tsMs, lastLine: newest.line, lastTo, errorCount };
  }, [lines]);

  const cardVariants = { hidden: { opacity: 0, x: -3 }, visible: { opacity: 1, x: 0 } };

  return (
    <motion.section className="agent-card-outer" variants={cardVariants} transition={{ duration: 0.6 }}>
      <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.1, ease: "linear" }} className="agent-card-wrapper">
        <div className="agent-header">
          <h2>{serviceName}</h2>
          <div className="agent-status">
            <span>{online ? "Online" : "Offline"}</span>
            <span className={`status-dot ${online ? "online" : "offline"} ${online ? "pulse" : ""}`}></span>
          </div>
        </div>

        <div className="agent-body">
          {err && <div className="agent-error">Failed to load logs: {err}</div>}

          {loading && !lines.length ? (
            <div className="agent-subtle">Loading logs…</div>
          ) : lines.length ? (
            <>
              <div className="agent-field">
                <div className="agent-label">Last log</div>
                <div className="agent-value mono">
                  {new Date(lastTs!).toLocaleTimeString()} — {lastLine}
                </div>
              </div>

              {lastTo ? (
                <div className="agent-field">
                  <div className="agent-label">Last sent to</div>
                  <div className="agent-value">{lastTo}</div>
                </div>
              ) : null}

              <div className="agent-field">
                <div className="agent-label">Errors (last {lookbackMin}m)</div>
                <div className={`agent-value ${errorCount ? "error" : ""}`}>{errorCount}</div>
              </div>
            </>
          ) : (
            <div className="agent-subtle">No logs in last {lookbackMin}m.</div>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
