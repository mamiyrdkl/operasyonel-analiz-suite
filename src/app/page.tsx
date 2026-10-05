'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AnalysisTab from '@/components/AnalysisTab';
import ComparisonTab from '@/components/ComparisonTab';
import CrewDelayTab from '@/components/CrewDelayTab';
import YearlyAnalysisTab from '@/components/YearlyAnalysisTab';
import HotelReservationTab from '@/components/HotelReservationTab';
import CheckInReportTab from '@/components/CheckInReportTab';
import DelayTrackingTab from '@/components/DelayTrackingTab';
import CrewConnectionTab from '@/components/CrewConnectionTab';
import PortalScreen from '@/components/PortalScreen';
import SettingsModal from '@/components/SettingsModal';
import { SettingsProvider } from '@/lib/useSettings';

export type AppType = 'PORTAL' | 'ANALYSIS_SUITE' | 'HOTEL' | 'CHECK_IN' | 'DELAY_TRACKING' | 'CREW_CONNECTION';

export default function DashboardPage() {
  const [currentApp, setCurrentApp] = useState<AppType>('PORTAL');
  const [activeTab, setActiveTab] = useState<'analysis' | 'comparison' | 'crewDelay' | 'yearlyAnalysis'>('analysis');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  if (currentApp === 'PORTAL') {
    return (
      <SettingsProvider>
        <PortalScreen 
           onSelectApp={(app) => {
              setCurrentApp(app);
              if (app === 'ANALYSIS_SUITE') setActiveTab('analysis');
           }} 
        />
      </SettingsProvider>
    );
  }

  return (
    <SettingsProvider>
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
        
        <div style={{ display: currentApp === 'HOTEL' ? 'contents' : 'none' }}><HotelReservationTab /></div>
        
        <div style={{ display: currentApp === 'CHECK_IN' ? 'contents' : 'none' }}><CheckInReportTab /></div>

        <div style={{ display: currentApp === 'DELAY_TRACKING' ? 'contents' : 'none' }}><DelayTrackingTab /></div>

        <div style={{ display: currentApp === 'CREW_CONNECTION' ? 'contents' : 'none' }}><CrewConnectionTab /></div>


        {currentApp === 'ANALYSIS_SUITE' && (
           <>
             <div style={{ display: activeTab === 'analysis' ? 'contents' : 'none' }}><AnalysisTab /></div>
             <div style={{ display: activeTab === 'comparison' ? 'contents' : 'none' }}><ComparisonTab /></div>
             <div style={{ display: activeTab === 'crewDelay' ? 'contents' : 'none' }}><CrewDelayTab /></div>
             <div style={{ display: activeTab === 'yearlyAnalysis' ? 'contents' : 'none' }}><YearlyAnalysisTab /></div>
           </>
        )}

      </div>

      {/* ADMIN MODAL SETTINGS */}
      {isAdminModalOpen && <SettingsModal onClose={() => setIsAdminModalOpen(false)} />}

    </main>
    </SettingsProvider>
  );
}
