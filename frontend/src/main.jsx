import "./safeStorage.js"; // first: it must run before anything reads localStorage
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
// Fredoka (headings) and Nunito (text): rounded faces that sit with Nova's shape. Inter stays for
// the IELTS exam room, which keeps its own plainer look; Source Serif is for reading passages.
import "@fontsource-variable/fredoka/wght.css";
import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import "./index.css";
import "./hub.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
