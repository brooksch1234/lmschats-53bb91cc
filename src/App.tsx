import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PremiumProvider } from "@/hooks/usePremium";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ChatLayout from "./components/ChatLayout";
import ChatWelcome from "./components/ChatWelcome";
import ChatView from "./components/ChatView";
import GroupChatView from "./components/GroupChatView";
import Admin from "./pages/Admin";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PremiumProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/chats" element={<ChatLayout />}>
                <Route index element={<ChatWelcome />} />
                <Route path="chat/:connectionId" element={<ChatView />} />
                <Route path="group/:groupId" element={<GroupChatView />} />
              </Route>
              <Route path="/chat/:connectionId" element={<ChatLayout />}>
                <Route index element={<ChatView />} />
              </Route>
              <Route path="/group/:groupId" element={<ChatLayout />}>
                <Route index element={<GroupChatView />} />
              </Route>
              <Route path="/admin" element={<Admin />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/product/:handle" element={<ProductDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PremiumProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
