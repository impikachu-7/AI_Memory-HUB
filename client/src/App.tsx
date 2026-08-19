/** Quiet Intelligence Console router: public access flows and a persistent, user-controlled workbench route map. */

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthPage from "@/pages/AuthPages";
import LandingPage from "@/pages/LandingPage";
import NotFound from "@/pages/NotFound";
import { WorkspaceRoute } from "@/pages/WorkspacePages";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login"><AuthPage mode="login" /></Route>
      <Route path="/register"><AuthPage mode="register" /></Route>
      <Route path="/auth/google"><AuthPage mode="google" /></Route>
      <Route path="/verify-email"><AuthPage mode="verify" /></Route>
      <Route path="/forgot-password"><AuthPage mode="forgot" /></Route>
      <Route path="/chat"><WorkspaceRoute page="chat" /></Route>
      <Route path="/conversations"><WorkspaceRoute page="conversations" /></Route>
      <Route path="/memory/search"><WorkspaceRoute page="search" /></Route>
      <Route path="/memory/categories"><WorkspaceRoute page="categories" /></Route>
      <Route path="/memory/timeline"><WorkspaceRoute page="timeline" /></Route>
      <Route path="/memory/:id"><WorkspaceRoute page="details" /></Route>
      <Route path="/memory"><WorkspaceRoute page="memory" /></Route>
      <Route path="/models"><WorkspaceRoute page="models" /></Route>
      <Route path="/settings/providers"><WorkspaceRoute page="providers" /></Route>
      <Route path="/settings/api-keys"><WorkspaceRoute page="keys" /></Route>
      <Route path="/analytics"><WorkspaceRoute page="analytics" /></Route>
      <Route path="/privacy"><WorkspaceRoute page="privacy" /></Route>
      <Route path="/profile"><WorkspaceRoute page="profile" /></Route>
      <Route path="/settings"><WorkspaceRoute page="settings" /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
