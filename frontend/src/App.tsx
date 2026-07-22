import { Box, Center, Loader, MantineProvider, Text } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.css";
import { RequireAuth } from "./components/RequireAuth";
import { SystemFooter } from "./components/SystemFooter";
import { queryClient } from "./shared/queryClient";
import { theme } from "./shared/theme";

const Layout = lazy(() =>
  import("./components/Layout").then((module) => ({ default: module.Layout }))
);
const AgendaPage = lazy(() =>
  import("./features/agenda/AgendaPage").then((module) => ({ default: module.AgendaPage }))
);
const LoginPage = lazy(() =>
  import("./features/auth/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const CreditsPage = lazy(() =>
  import("./features/credits/CreditsPage").then((module) => ({ default: module.CreditsPage }))
);
const DashboardPage = lazy(() =>
  import("./features/dashboard/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  }))
);
const DutiesPage = lazy(() =>
  import("./features/duties/DutiesPage").then((module) => ({ default: module.DutiesPage }))
);
const FinancialPage = lazy(() =>
  import("./features/financial/FinancialPage").then((module) => ({
    default: module.FinancialPage,
  }))
);
const FiscalDocumentsPage = lazy(() =>
  import("./features/fiscal/FiscalDocumentsPage").then((module) => ({
    default: module.FiscalDocumentsPage,
  }))
);
const LandingPage = lazy(() =>
  import("./features/landing/LandingPage").then((module) => ({ default: module.LandingPage }))
);
const LunchesPage = lazy(() =>
  import("./features/lunch/LunchesPage").then((module) => ({ default: module.LunchesPage }))
);
const PackagesPage = lazy(() =>
  import("./features/lunch/PackagesPage").then((module) => ({ default: module.PackagesPage }))
);
const MembersPage = lazy(() =>
  import("./features/members/MembersPage").then((module) => ({ default: module.MembersPage }))
);
const PublicRegistrationPage = lazy(() =>
  import("./features/public-registration/PublicRegistrationPage").then((module) => ({
    default: module.PublicRegistrationPage,
  }))
);

function RouteFallback() {
  return (
    <Center mih="50vh">
      <Loader aria-label="Carregando página" />
    </Center>
  );
}

function LegacyPanelRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function App() {
  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <Box style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <Box style={{ flex: 1 }}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/cadastro" element={<PublicRegistrationPage />} />
                <Route path="/login" element={<LoginPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="/painel" element={<Layout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="agenda" element={<AgendaPage />} />
                    <Route path="financeiro" element={<FinancialPage />} />
                    <Route path="notas-fiscais" element={<FiscalDocumentsPage />} />
                    <Route path="creditos" element={<CreditsPage />} />
                    <Route path="lunches" element={<LunchesPage />} />
                    <Route path="pacotes" element={<PackagesPage />} />
                    <Route path="integrantes" element={<MembersPage />} />
                    <Route path="funcoes" element={<DutiesPage />} />
                  </Route>
                </Route>

                <Route path="/agenda" element={<LegacyPanelRedirect to="/painel/agenda" />} />
                <Route
                  path="/financeiro"
                  element={<LegacyPanelRedirect to="/painel/financeiro" />}
                />
                <Route
                  path="/notas-fiscais"
                  element={<LegacyPanelRedirect to="/painel/notas-fiscais" />}
                />
                <Route path="/creditos" element={<LegacyPanelRedirect to="/painel/creditos" />} />
                <Route path="/lunches" element={<LegacyPanelRedirect to="/painel/lunches" />} />
                <Route path="/pacotes" element={<LegacyPanelRedirect to="/painel/pacotes" />} />
                <Route
                  path="/integrantes"
                  element={<LegacyPanelRedirect to="/painel/integrantes" />}
                />
                <Route path="/funcoes" element={<LegacyPanelRedirect to="/painel/funcoes" />} />

                <Route path="*" element={<Text>Página não encontrada.</Text>} />
              </Routes>
            </Suspense>
          </Box>
          <SystemFooter />
        </Box>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;
