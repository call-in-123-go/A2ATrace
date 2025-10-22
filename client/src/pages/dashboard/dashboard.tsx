import './dashboard.scss';
import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import AgentCard from '../../components/agentcard/agentcard';
import Navbar from '../../components/navbar/navbar';
import TitleNav from '../../components/titlenav/titlenav';

// --- Configuration Interfaces ---

// Mirrors the structure returned by the /api/config endpoint
interface TelemetryConfig {
  prometheusUrl: string;
  lokiUrl: string;
  tempoUrl: string;
  collectorHttp: string;
  collectorGrpc: string;
}

// Full response structure from /api/config
interface ConfigResponse {
  telemetry: TelemetryConfig;
  agents: any[]; // Assuming agents list isn't critical here, but could be
}

const Dashboard = () => {
  // State for Global Configuration (Dynamic Ports)
  const [telemetryConfig, setTelemetryConfig] =
    useState<TelemetryConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // State for Agent Discovery (from Loki)
  const [agents, setAgents] = useState<string[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  // --- Step 1: Fetch Global Configuration (Dynamic Ports) ---
  useEffect(() => {
    async function fetchConfig() {
      try {
        const r = await fetch('/api/config');
        if (!r.ok) {
          throw new Error(`Config fetch failed with status ${r.status}`);
        }
        const data: ConfigResponse = await r.json();
        // Set the dynamic URLs retrieved from the Express server
        setTelemetryConfig(data.telemetry);
        console.log('✅ Telemetry Config Loaded:', data.telemetry);
        setAgentError(null); // Clear any previous errors
      } catch (e: any) {
        setAgentError(`Failed to load configuration: ${e.message}`);
        setTelemetryConfig(null);
      } finally {
        setLoadingConfig(false);
      }
    }
    fetchConfig();
  }, []); // Runs once on mount

  // --- Step 2: Discover Agents (from Loki, dependent on config) ---
  useEffect(() => {
    // Only run if the configuration is successfully loaded
    if (!telemetryConfig || loadingConfig) return;

    // Use the Loki URL from the fetched config.
    const lokiBaseUrl = telemetryConfig.lokiUrl;

    async function discoverAgents() {
      setLoadingAgents(true);
      try {
        // NOTE: We rely on the Express server proxy route /api/logs/labels/:name/values
        // which internally uses the dynamic lokiUrl.
        const r = await fetch('/api/logs/labels/service_name/values');
        if (!r.ok) {
          throw new Error(`Agent discovery failed with status ${r.status}`);
        }
        const j = await r.json();
        const discoveredAgents = (j?.data ?? []).sort();
        setAgents(discoveredAgents);
        setAgentError(null);
        console.log('✅ Agents Discovered:', discoveredAgents);
      } catch (e: any) {
        setAgents([]);
        setAgentError(
          `Failed to discover agents from Loki: ${String(e.message || e)}`
        );
      } finally {
        setLoadingAgents(false);
      }
    }
    discoverAgents();
  }, [telemetryConfig, loadingConfig]); // Re-runs when config is loaded/changes

  // Determine the current loading/error status
  const isLoaded = useMemo(
    () => !loadingConfig && telemetryConfig,
    [loadingConfig, telemetryConfig]
  );

  const content = useMemo(() => {
    if (loadingConfig) {
      return <div>Loading dashboard configuration...</div>;
    }
    if (agentError) {
      return <div className='agent-error-banner'>Error: {agentError}</div>;
    }
    if (loadingAgents) {
      return (
        <div className='agent-subtle'>Discovering agents from logs...</div>
      );
    }
    if (!agents.length) {
      return (
        <div className='agent-subtle'>
          No agents found in logs within the last 5 minutes.
        </div>
      );
    }
    return null;
  }, [loadingConfig, loadingAgents, agentError, agents.length]);

  return (
    <div className='dashboard-page'>
      <TitleNav />
      <Navbar />

      <section className='dashboard-body-wrapper'>
        <motion.div
          className='agent-wrapper'
          initial='hidden'
          animate='visible'
          variants={{
            visible: { transition: { staggerChildren: 0.2 } },
          }}
        >
          {content}

          {/* Render Agent Cards only if config is loaded and agents are discovered */}
          {isLoaded &&
            agents.map((name) => (
              <AgentCard
                key={name}
                serviceName={name}
                lookbackMin={5}
                refreshMs={5000}
                // --- PASSING DYNAMIC URLS DOWN ---
                prometheusUrl={telemetryConfig!.prometheusUrl}
                lokiUrl={telemetryConfig!.lokiUrl}
                tempoUrl={telemetryConfig!.tempoUrl}
                // ---------------------------------
              />
            ))}
        </motion.div>
      </section>
    </div>
  );
};

export default Dashboard;
