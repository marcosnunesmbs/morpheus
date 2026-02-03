import { useState, useEffect } from 'react';
import { useConfig, saveConfig } from '@/lib/api';
import { Save, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function Config() {
  const { data: config, mutate } = useConfig();
  const [jsonStr, setJsonStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setJsonStr(JSON.stringify(config, null, 2));
    }
  }, [config]);

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);
      const parsed = JSON.parse(jsonStr);
      await saveConfig(parsed);
      await mutate();
      setSuccess('Configuration saved successfully');
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <motion.div 
      className="h-full flex flex-col space-y-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
       <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight">CONFIGURATION</h2>
            <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">Edit agent settings (JSON).</p>
         </div>
         <button 
           onClick={handleSave}
           className="bg-azure-primary hover:bg-azure-secondary text-white dark:bg-matrix-primary dark:hover:bg-matrix-secondary dark:text-matrix-highlight px-4 py-2 rounded flex items-center gap-2 font-bold transition-colors"
         >
           <Save className="w-5 h-5" />
           SAVE CHANGES
         </button>
       </div>

       {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-500 p-3 rounded flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
       )}

       {success && (
        <div className="bg-azure-hover border border-azure-border text-azure-primary dark:bg-matrix-primary/20 dark:border-matrix-secondary dark:text-matrix-highlight p-3 rounded flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
       )}

       <div className="flex-1 bg-azure-surface dark:bg-zinc-950 border border-azure-border dark:border-matrix-primary rounded p-0 overflow-hidden">
         <textarea
           value={jsonStr}
           onChange={(e) => setJsonStr(e.target.value)}
           className="w-full h-full bg-azure-surface dark:bg-zinc-950 text-azure-text-primary dark:text-matrix-highlight font-mono p-4 outline-none resize-none"
           spellCheck={false}
         />
       </div>
    </motion.div>
  );
}
