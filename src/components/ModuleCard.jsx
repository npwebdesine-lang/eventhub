import { motion } from 'framer-motion';

const ModuleCard = ({ title, icon: Icon, color, onClick }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center p-6 bg-white/5 backdrop-blur-md 
                 border border-white/10 rounded-3xl shadow-2xl space-y-4 w-full aspect-square cursor-pointer"
    >
      <div className={`p-4 rounded-2xl ${color} bg-opacity-20`}>
        <Icon size={32} className={color.replace('bg-', 'text-')} />
      </div>
      <span className="text-white font-semibold text-lg">{title}</span>
    </motion.button>
  );
};

export default ModuleCard;