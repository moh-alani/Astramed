import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import "./styles/main.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        /* Cache availability is shown separately; the application remains usable online. */
      }),
  );
