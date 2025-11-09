import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ApiAuthProvider } from "@/contexts/ApiAuthContext";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import People from "./pages/People";
import PersonAlbum from "./pages/PersonAlbum";
import UnknownPeople from "./pages/UnknownPeople";
import MigratePhotos from "./pages/MigratePhotos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <ApiAuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:id" element={<CollectionDetail />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonAlbum />} />
              <Route path="/unknown" element={<UnknownPeople />} />
              <Route path="/migrate-photos" element={<MigratePhotos />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ApiAuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
