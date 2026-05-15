import React, { createContext, useContext, useState } from 'react';
import { LeagueEntry } from './types';

interface LeagueContextType {
  activeLeague: LeagueEntry | null;
  setActiveLeague: (league: LeagueEntry | null) => void;
}

const LeagueContext = createContext<LeagueContextType>({
  activeLeague: null,
  setActiveLeague: () => {},
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [activeLeague, setActiveLeague] = useState<LeagueEntry | null>(null);

  return (
    <LeagueContext.Provider value={{ activeLeague, setActiveLeague }}>
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => useContext(LeagueContext);
