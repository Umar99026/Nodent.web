import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@/index.css";
import App from "@/App";

// Root domain (nodentlearning.com) still points at Wix — API lives on www.
if (
  typeof window !== "undefined" &&
  window.location.hostname.toLowerCase() === "nodentlearning.com"
) {
  window.location.replace(
    `https://www.nodentlearning.com${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}
