import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';

const Dating = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 text-center">
      <button onClick={() => navigate('/')} className="mb-8 flex items-center text-slate-400">
        <ArrowLeft size={20} className="ml-2" /> חזרה ל-Hub
      </button>
      <Heart size={60} className="mx-auto text-rose-500 mb-4" />
      <h2 className="text-3xl font-bold text-white">דייט-ליין</h2>
      <p className="text-slate-400 mt-4">מודול ההכרויות של האירוע בבנייה!</p>
    </div>
  );
};

export default Dating;