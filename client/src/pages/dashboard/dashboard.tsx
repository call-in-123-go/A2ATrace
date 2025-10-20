import './dashboard.scss';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AgentCard from '../../components/agentcard/agentcard';
import Navbar from '../../components/navbar/navbar';
import TitleNav from '../../components/titlenav/titlenav';

const Dashboard = () => {
  // OPTION A: hard-code for now; replace with real service_name label values
  // const AGENTS = ["context-agent", "planner-agent", "executor-agent"];

  // OPTION B: discover from Loki (preferred once your /api routes are in place)
  const [agents, setAgents] = useState<string[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/logs/labels/service_name/values');
        const j = await r.json();
        setAgents((j?.data ?? []).sort());
      } catch {
        setAgents([]); // fallback to empty; you can default to a hard-coded list if you want
      } finally {
        setLoadingAgents(false);
      }
    }
    load();
  }, []);

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
          {loadingAgents && <div>Loading agents…</div>}

          {/* If discovery fails or returns empty, swap to your hard-coded list */}
          {(agents.length ? agents : []).map((name) => (
            <AgentCard
              key={name}
              serviceName={name}
              lookbackMin={5}
              refreshMs={5000}
            />
          ))}

          {/* Example fallback (uncomment this block if you want visible placeholders):
          {!agents.length && !loadingAgents && (
            <>
              <AgentCard serviceName="context-agent" />
              <AgentCard serviceName="planner-agent" />
              <AgentCard serviceName="executor-agent" />
            </>
          )}
          */}
        </motion.div>
      </section>
    </div>
  );
};

export default Dashboard;
