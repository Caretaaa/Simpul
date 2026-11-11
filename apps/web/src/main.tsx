import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const el = document.getElementById("root");
if (!el) throw new Error("Elemen #root tidak ditemukan");
createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
