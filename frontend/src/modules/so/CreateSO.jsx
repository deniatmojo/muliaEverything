import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

const CreateSO = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/so')}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#0F3B6C]">Buat Project (SO) Baru</h1>
            <p className="text-gray-500">Isi formulir master data project di bawah ini</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-[#0084C9] hover:bg-[#0F3B6C] text-white px-6 py-2 rounded-lg transition-colors shadow-md font-semibold">
          <Save size={18} /> Simpan Project
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 italic">Area Form Input Master Data Project akan dibangun di sini...</p>
        </div>
      </div>
    </div>
  );
};

export default CreateSO;