import React, { useState } from 'react';
import { X, Globe, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { TRANSLATIONS } from '../constants';

interface PatientFormProps {
  onSave: (data: any) => void;
  onClose: () => void;
  initialName?: string;
}

export function PatientForm({ onSave, onClose, initialName }: PatientFormProps) {
  const [lang, setLang] = useState<keyof typeof TRANSLATIONS>('en');
  const [formData, setFormData] = useState({
    name: initialName || '',
    dob: '',
    gender: 'M',
    address: '',
    city: '',
    state: 'KY',
    zip: '',
    ssn: '',
    phone: '',
    email: '',
    guardianName: '',
    guardianPhone: '',
    guardianRel: '',
    insName: '',
    insId: '',
    insHolder: '',
    insDob: '',
    hipaa: false
  });

  const t = TRANSLATIONS[lang];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const isMinor = () => {
    if (!formData.dob) return false;
    const age = Math.floor((new Date().getTime() - new Date(formData.dob).getTime()) / 31557600000);
    return age < 18;
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-start overflow-y-auto pt-10 pb-10 px-4 transition-all">
      <div className="bg-theme-card rounded-xl w-full max-w-3xl shadow-2xl relative overflow-hidden border-theme-main">
        <div className="bg-theme-card border-b border-theme-border px-6 py-4 flex justify-between items-center text-theme-text">
          <h2 className="text-xl font-black text-theme-text uppercase tracking-tight">{t.newPt}</h2>
          <div className="flex items-center gap-4">
            <div className="flex bg-theme-bg border border-theme-border p-1 rounded-lg">
              {(['en', 'es', 'fr'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded text-xs font-black uppercase transition-all ${lang === l ? 'bg-black text-white' : 'text-black hover:bg-slate-100'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-black hover:text-red-500 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8 bg-white">
          {/* Personal Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-1 bg-red-600 rounded-full" />
              <h3 className="text-xs font-black uppercase text-black tracking-wider">Patient Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.fullName}</label>
                <input name="name" value={formData.name} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold uppercase text-black transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.dob}</label>
                <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.gender}</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full border-b border-black py-2 focus:ring-1 focus:ring-black outline-none bg-transparent font-bold text-black">
                  <option value="M">M</option>
                  <option value="F">F</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-3">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.address}</label>
                <input name="address" value={formData.address} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.city}</label>
                <input name="city" value={formData.city} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.state}</label>
                <input name="state" value={formData.state} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.zip}</label>
                <input name="zip" value={formData.zip} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.ssn}</label>
                <input name="ssn" value={formData.ssn} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" placeholder="XXX-XX-XXXX" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.phone}</label>
                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" placeholder="(XXX) XXX-XXXX" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.email}</label>
                <input name="email" value={formData.email} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 focus:ring-1 focus:ring-black outline-none font-bold text-black" />
              </div>
            </div>
          </section>

          {/* Guardian Info */}
          {isMinor() && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-black p-6 rounded-lg border-2 border-dashed"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="h-4 w-1 bg-red-600 rounded-full" />
                <h3 className="text-xs font-black uppercase text-red-600 tracking-wider font-bold">{t.guardHeader}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-red-600 mb-1">{t.guardName}</label>
                  <input name="guardianName" value={formData.guardianName} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-red-600 mb-1">Phone</label>
                  <input name="guardianPhone" value={formData.guardianPhone} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-red-600 mb-1">{t.guardRel}</label>
                  <input name="guardianRel" value={formData.guardianRel} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
                </div>
              </div>
            </motion.section>
          )}

          {/* Insurance */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-1 bg-red-600 rounded-full" />
              <h3 className="text-xs font-black uppercase text-black tracking-wider">{t.insHeader}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.primIns}</label>
                <input name="insName" value={formData.insName} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.memId}</label>
                <input name="insId" value={formData.insId} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.polHolder}</label>
                <input name="insHolder" value={formData.insHolder} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">{t.polDob}</label>
                <input type="date" name="insDob" value={formData.insDob} onChange={handleChange} className="w-full border-b border-black bg-transparent py-2 outline-none font-bold text-black" />
              </div>
            </div>
          </section>

          {/* HIPAA */}
          <section className="bg-white border border-black p-6 rounded-lg">
            <div className="flex items-start gap-4">
              <input 
                type="checkbox" 
                id="hipaa" 
                name="hipaa" 
                checked={formData.hipaa} 
                onChange={handleChange}
                className="mt-1 w-5 h-5 rounded border-black text-red-600 focus:ring-red-600 accent-red-600"
              />
              <label htmlFor="hipaa" className="text-sm text-black leading-relaxed font-bold uppercase">
                {t.hipaaText}
              </label>
            </div>
          </section>

          <div className="flex gap-4 pt-6 pb-4">
            <button 
              onClick={() => onSave(formData)}
              className="flex-1 bg-black text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 border border-black"
            >
              <Save className="w-5 h-5" />
              {t.save}
            </button>
            <button 
              onClick={onClose}
              className="flex-1 bg-white text-black border border-black font-black uppercase tracking-widest py-4 rounded-xl hover:bg-slate-50 transition-all"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
