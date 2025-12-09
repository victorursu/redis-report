'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Function to apply theme to document - memoized to prevent recreation
  const applyTheme = useCallback((newTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // Remove both classes first to ensure clean state
    root.classList.remove('dark', 'light');
    // Add the appropriate class
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
  }, []);

  useEffect(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    let initialTheme: Theme;
    
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      initialTheme = savedTheme;
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      initialTheme = prefersDark ? 'dark' : 'light';
    }
    
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, [applyTheme]);

  useEffect(() => {
    if (!mounted) return;
    
    // Apply theme to document whenever it changes
    applyTheme(theme);
    
    // Save to localStorage
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // localStorage might not be available
    }
  }, [theme, mounted, applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Always provide the context, even before mounted
  // This prevents the "useTheme must be used within a ThemeProvider" error
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

