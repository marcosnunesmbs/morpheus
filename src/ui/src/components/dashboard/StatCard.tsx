import { motion } from 'framer-motion';

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export const StatCard = ({ title, value, icon: Icon, subValue }: any) => (
  <motion.div 
    variants={item}
    className="border border-matrix-primary bg-zinc-950/50 p-6 rounded relative overflow-hidden group hover:border-matrix-highlight transition-colors"
  >
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-matrix-secondary text-sm font-bold uppercase">{title}</h3>
      <Icon className="w-6 h-6 text-matrix-primary group-hover:text-matrix-highlight transition-colors" />
    </div>
    <div className="text-3xl font-bold text-matrix-highlight mb-1 font-mono tracking-tighter truncate">{value}</div>
    {subValue && <div className="text-xs text-matrix-secondary opacity-70 font-mono">{subValue}</div>}
  </motion.div>
);
