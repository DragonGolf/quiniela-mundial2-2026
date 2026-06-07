import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LeagueEntry } from './types';

const STORAGE_KEY = 'activeLeague_v2';

interface LeagueContextType {
  activeLeague: LeagueEntry | null;
  leagueLoaded: boolean;
  setActiveLeague: (league: LeagueEntry | null) => void;
}

const LeagueContext = createContext<LeagueContextType>({
  activeLeague: null,
  leagueLoaded: false,
  setActiveLeague: () => {},
});

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const [activeLeague, _setActiveLeague] = useState<LeagueEntry | null>(null);
  const [leagueLoaded, setLeagueLoaded] = useState(false);

  // Cargar quiniela guardada al iniciar
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try { _setActiveLeague(JSON.parse(raw)); } catch { /* ignore */ }
        }
      })
      .finally(() => setLeagueLoaded(true));
  }, []);

  function setActiveLeague(league: LeagueEntry | null) {
    _setActiveLeague(league);
    if (league) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(league)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }

  return (
    <LeagueContext.Provider value={{ activeLeague, leagueLoaded, setActiveLeague }}>
      {children}
    </LeagueContext.Provider>
  );
}

export const useLeague = () => useContext(LeagueContext);
