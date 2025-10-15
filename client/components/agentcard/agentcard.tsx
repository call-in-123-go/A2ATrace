import "./agentcard.scss"
import { motion } from "framer-motion"

const AgentCard = () => {


    const cardVariants = {
        hidden: { opacity: 0, x: -3 },
        visible: { opacity: 1, x: 0 }

    }

    return(
        <motion.section 
        className="agent-card-outer"
        variants={cardVariants}
        transition={{
            duration: 0.6,
        }}
        >
        <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.1, ease: "linear" }} // Hover animation
        className="agent-card-wrapper"
      >
            <div className="agent-header">
                <h2>Context Agent</h2>
                <div className="agent-status">
                    <span>Online</span>
                    <span className="status-dot online pulse"></span>
                </div>
            </div>
            </motion.div>
        </motion.section>
    )
}


export default AgentCard