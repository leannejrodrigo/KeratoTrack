import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "./styles/tokens.css";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { RepositoryProvider } from "./app/RepositoryContext";
import { IndexedDbMeasurementRepository } from "./storage/indexedDbRepository";

const root = createRoot(document.getElementById("root")!);

// The MVP only ever opens the separate demo database.
IndexedDbMeasurementRepository.open("demo").then(
  (repo) =>
    root.render(
      <StrictMode>
        <RepositoryProvider repo={repo}>
          <App />
        </RepositoryProvider>
      </StrictMode>,
    ),
  (err: unknown) =>
    root.render(
      <main className="fatal">
        <h1>KeratoTrack could not open its storage</h1>
        <p>This browser did not allow local storage (for example, in some private-browsing modes). Your records have not been changed.</p>
        <p className="mono">{String(err)}</p>
      </main>,
    ),
);
