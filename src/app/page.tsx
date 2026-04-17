'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AnalysisTab from '@/components/AnalysisTab';
import ComparisonTab from '@/components/ComparisonTab';
import CrewDelayTab from '@/components/CrewDelayTab';
import HotelReservationTab from '@/components/HotelReservationTab';
import SettingsModal from '@/components/SettingsModal';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'analysis' | 'comparison' | 'crewDelay' | 'hotelReservation'>('analysis');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  return (
    <main className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* SIDEBAR COMPONENT */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        openAdminModal={() => setIsAdminModalOpen(true)} 
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
        
        {/* MODULE 1: CURRENT ANALYSIS */}
        {activeTab === 'analysis' && <AnalysisTab />}

        {/* MODULE 2: COMPARISON */}
        {activeTab === 'comparison' && <ComparisonTab />}

        {/* MODULE 3: CREW DELAY ANALYSIS */}
        {activeTab === 'crewDelay' && <CrewDelayTab />}

        {/* MODULE 4: HOTEL RESERVATION */}
        {activeTab === 'hotelReservation' && <HotelReservationTab />}

      </div>

      {/* ADMIN MODAL SETTINGS */}
      {isAdminModalOpen && <SettingsModal onClose={() => setIsAdminModalOpen(false)} />}

    </main>
  );
}
