import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { LiteModeProvider } from "@/hooks/use-lite-mode";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <LiteModeProvider>
      <App />
    </LiteModeProvider>
  </React.StrictMode>,
);
