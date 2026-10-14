import React from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import Icon from "./Icon.jsx";

export default function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleDarkMode}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle-icon sun" aria-hidden="true">
        <Icon name="sun" size={13} strokeWidth={2.2} />
      </span>
      <span className="theme-toggle-icon moon" aria-hidden="true">
        <Icon name="moon" size={13} strokeWidth={2.2} />
      </span>
      <span className="theme-toggle-thumb" aria-hidden="true" />
    </button>
  );
}