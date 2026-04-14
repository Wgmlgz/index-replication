import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { KcPage } from "./kc.gen";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@fortawesome/fontawesome-free/css/v4-font-face.min.css";
import "@fortawesome/fontawesome-free/css/v4-shims.min.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.kcContext ? <KcPage kcContext={window.kcContext} /> : <h1>No Keycloak Context</h1>}
  </StrictMode>
);
