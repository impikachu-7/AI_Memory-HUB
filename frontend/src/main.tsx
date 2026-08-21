import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
if (analyticsEndpoint && analyticsWebsiteId) {
	const analyticsScript = document.createElement("script");
	analyticsScript.defer = true;
	analyticsScript.src = `${analyticsEndpoint.replace(/\/+$/, "")}/umami`;
	analyticsScript.dataset.websiteId = analyticsWebsiteId;
	document.head.appendChild(analyticsScript);
}

createRoot(document.getElementById("root")!).render(<App />);
