import "./dashboard.scss"
import { use, useEffect, useState } from "react"
import { motion } from "framer-motion"
import AgentCard from "../../components/agentcard/agentcard"
import Navbar from "../../components/navbar/navbar"
import TitleNav from "../../components/titlenav/titlenav"


const Dashboard = () => {
  const [metrics, setMetrics] = useState("");

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch("http://localhost:9464/metrics");
        const text = await res.text();
        setMetrics(text);
      } catch (err) {
        setMetrics("❌ Failed to fetch metrics: " + err);
      }
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);


    return(
    <div className="dashboard-page">
        <TitleNav/>
        <Navbar/>

        <section className="dashboard-body-wrapper">
        <motion.div 
        className="agent-wrapper"
        initial="hidden"
        animate="visible"
        variants={{
        visible: {
          transition: {
            staggerChildren: 0.2, // delay between cards
          },
        },
      }}
        >
            <AgentCard />
            <AgentCard />
            <AgentCard />
            <AgentCard />
            <AgentCard />
            <AgentCard />
        </motion.div>
        </section>
    </div>
    )
  }



export default Dashboard