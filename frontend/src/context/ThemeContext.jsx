import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // This provider sits outside the ErrorBoundary, so nothing here may throw: a stored value that
  // isn't "true"/"false" (or blocked storage) must fall back to the system preference, not blank the app.
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("satmock_darkMode");
      if (saved === "true" || saved === "false") return saved === "true";
    } catch {
      // storage unavailable
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    try {
      localStorage.setItem("satmock_darkMode", JSON.stringify(darkMode));
    } catch {
      // storage unavailable: the theme still applies for this visit
    }
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => setDarkMode((prev) => !prev), []);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}