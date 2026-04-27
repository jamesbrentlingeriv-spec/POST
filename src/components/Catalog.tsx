import React, { useState } from 'react';
import { Search, Tag, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { MASTER_PRICE_LIST } from '../constants';
import { InsurancePlan } from '../types';

interface CatalogProps {
  currentPlan: InsurancePlan;
  onSelectItem: (itemName: string, itemPrice: number, category: string) => void;
  className?: string;
}

const MEDICAID_LENSES = [
  "Single Vision Plastic",
  "Flat Top 28 Bifocal Plastic",
  "Younger Image Plastic",
  "Single Vision POLY",
  "Flat Top 28 Bifocal POLY",
  "Younger Image POLY",
];

export function Catalog({ currentPlan, onSelectItem, className }: CatalogProps) {
  const [activeCat, setActiveCat] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const categories = ["All", ...Object.keys(MASTER_PRICE_LIST)];

  const isMedicalPlan = currentPlan === "MEDICAID" || currentPlan === "SCHOOL LETTER";
  const isCommercial = !isMedicalPlan && currentPlan !== "None";

  const getPriceDisplay = (item: any) => {
    if (isMedicalPlan) return "$0.00";
    if (isCommercial) return "Copay Applies";
    return `$${item.price.toFixed(2)}`;
  };

  const filteredItems = Object.entries(MASTER_PRICE_LIST).flatMap(([cat, items]) => {
    if (activeCat !== "All" && activeCat !== cat) return [];
    
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (isMedicalPlan) {
        const isMedicaidApproved = MEDICAID_LENSES.some(m => 
          item.name.toLowerCase().includes(m.toLowerCase())
        );
        return matchesSearch && isMedicaidApproved;
      }
      
      return matchesSearch;
    }).map(item => ({ ...item, category: cat }));
  });

  return (
    <div className={`flex flex-col bg-theme-card overflow-hidden ${className}`}>
      <div className="p-4 border-b border-theme-border flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text" />
          <input
            type="text"
            placeholder="Search lenses, coatings, misc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-theme-bg border border-theme-border rounded-lg text-sm focus:ring-1 focus:ring-theme-accent outline-none text-theme-text font-bold uppercase"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x select-none cursor-grab active:cursor-grabbing" style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <motion.div 
            drag="x"
            dragConstraints={{ left: -500, right: 0 }}
            className="flex gap-3 min-w-max px-2"
          >
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border snap-center active:scale-90 ${
                  activeCat === cat 
                  ? 'bg-theme-text border-theme-border text-theme-card shadow-xl' 
                  : 'bg-theme-card border-theme-border text-theme-text hover:bg-theme-bg'
                }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-theme-card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-20">
          {filteredItems.map((item, idx) => (
            <button
              key={`${item.name}-${idx}`}
              onClick={() => onSelectItem(item.name, item.price, item.category)}
              className="group bg-theme-card p-4 rounded-xl border border-theme-border text-left hover:bg-green-500/20 hover:border-green-500 hover:shadow-lg transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="p-1 px-2 rounded bg-theme-bg border border-theme-border text-[9px] font-black uppercase text-theme-text">
                  {item.category}
                </span>
                {isCommercial && <Check className="w-3 h-3 text-theme-accent opacity-0 group-hover:opacity-100 transition-opacity" />}
              </div>
              <h4 className="text-xs font-bold text-theme-text leading-tight mb-2 line-clamp-2 uppercase italic">{item.name}</h4>
              <div className="flex items-baseline gap-1">
                <Tag className="w-3 h-3 text-theme-text" />
                <span className={`text-[11px] font-black ${isCommercial ? 'text-theme-accent' : 'text-theme-text'}`}>
                  {getPriceDisplay(item)}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {filteredItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <Search className="w-12 h-12 mb-2" />
            <p className="text-sm font-bold uppercase tracking-widest">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
