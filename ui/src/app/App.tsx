import { createRoot } from "react-dom/client";
import { SearchPage } from "../job-search/SearchPage.js";
import "../styles/job-search.css";

createRoot(document.getElementById("root")!).render(<SearchPage />);
