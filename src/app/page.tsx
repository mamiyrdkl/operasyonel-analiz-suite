'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AnalysisTab from '@/components/AnalysisTab';
import ComparisonTab from '@/components/ComparisonTab';
import CrewDelayTab from '@/components/CrewDelayTab';
import HotelReservationTab from '@/components/HotelReservationTab';
import CheckInReportTab from '@/components/CheckInReportTab';
import PortalScreen from '@/components/PortalScreen';
import SettingsModal from '@/components/SettingsModal';

export type AppType = 'PORTAL' | 'ANALYSIS_SUITE' | 'HOTEL' | 'CHECK_IN';

export default function DashboardPage() {
  const [currentApp, setCurrentApp] = useState<AppType>('PORTAL');
  const [activeTab, setActiveTab] = useState<'analysis' | 'comparison' | 'crewDelay'>('analysis');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  if (currentApp === 'PORTAL') {
    return (
       <PortalScreen 
          onSelectApp={(app) => {
             setCurrentApp(app);
             if (app === 'ANALYSIS_SUITE') setActiveTab('analysis');
          }} 
       />
    );
  }

  return (
    <main className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* SIDEBAR COMPONENT */}
      <Sidebar 
        currentApp={currentApp}
        goBackToPortal={() => setCurrentApp('PORTAL')}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        openAdminModal={() => setIsAdminModalOpen(true)} 
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-50/50">
        
        {currentApp === 'HOTEL' && <HotelReservationTab />}
        
        {currentApp === 'CHECK_IN' && <CheckInReportTab />}

        {currentApp === 'ANALYSIS_SUITE' && (
           <>
             {activeTab === 'analysis' && <AnalysisTab />}
             {activeTab === 'comparison' && <ComparisonTab />}
             {activeTab === 'crewDelay' && <CrewDelayTab />}
           </>
        )}

      </div>

      {/* ADMIN MODAL SETTINGS */}
      {isAdminModalOpen && <SettingsModal onClose={() => setIsAdminModalOpen(false)} />}

    </main>
  );
}
