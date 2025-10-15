import "./dashboard.scss"
import { motion } from "framer-motion"
import AgentCard from "../../components/agentcard/agentcard"
import Navbar from "../../components/navbar/navbar"
import TitleNav from "../../components/titlenav/titlenav"


const Dashboard = () => {



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