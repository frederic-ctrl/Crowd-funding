import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { rpcUrl } from "./config";
import { Layout } from "./components/Layout";
import { WalletUiProvider } from "./components/Wallet";
import { Home } from "./pages/Home";

const Invest = lazy(() => import("./pages/Invest"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Transparency = lazy(() => import("./pages/Transparency"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function App() {
  return (
    <ConnectionProvider endpoint={rpcUrl} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletUiProvider>
          <BrowserRouter>
            <Layout>
              <Suspense fallback={<div className="container page-body" aria-busy="true" />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/investeren" element={<Invest />} />
                  <Route path="/portefeuille" element={<Portfolio />} />
                  <Route path="/transparantie" element={<Transparency />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
          </BrowserRouter>
        </WalletUiProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
