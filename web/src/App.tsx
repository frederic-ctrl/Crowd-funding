import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { rpcUrl } from "./config";
import { Layout } from "./components/Layout";
import { WalletUiProvider } from "./components/Wallet";
import { Home } from "./pages/Home";
import { LangProvider } from "./i18n";

const Claim = lazy(() => import("./pages/Claim"));
const MyPass = lazy(() => import("./pages/MyPass"));
const Transparency = lazy(() => import("./pages/Transparency"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function App() {
  return (
    <LangProvider>
      <ConnectionProvider endpoint={rpcUrl} config={{ commitment: "confirmed" }}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletUiProvider>
            <BrowserRouter>
              <Layout>
                <Suspense fallback={<div className="container page-body" aria-busy="true" />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/genesis" element={<Claim />} />
                    <Route path="/mijn-pass" element={<MyPass />} />
                    <Route path="/transparantie" element={<Transparency />} />
                    <Route path="/voorwaarden" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </Layout>
            </BrowserRouter>
          </WalletUiProvider>
        </WalletProvider>
      </ConnectionProvider>
    </LangProvider>
  );
}
