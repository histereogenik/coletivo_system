import { MantineProvider, Text } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { AgendaPage } from "./features/agenda/AgendaPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FinancialPage } from "./features/financial/FinancialPage";
import { queryClient } from "./lib/queryClient";
import { theme } from "./lib/theme";

function App() {
  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/financeiro" element={<FinancialPage />} />
            <Route path="*" element={<Text>Página não encontrada.</Text>} />
          </Routes>
        </Layout>
      </QueryClientProvider>
    </MantineProvider>
  );
}

export default App;
