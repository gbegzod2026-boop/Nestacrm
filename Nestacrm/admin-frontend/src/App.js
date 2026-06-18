import React, { useEffect, useState } from "react";
import Categories from "./components/Categories";
import Dashboard from "./components/Dashboard";
import Foods from "./components/Foods";
import Layout from "./components/Layout";
import Orders from "./components/Orders";
import { ensureSocketConnected, socket } from "./socket";

const VIEWS = {
  dashboard: Dashboard,
  categories: Categories,
  foods: Foods,
  orders: Orders,
};

export default function App() {
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    ensureSocketConnected();

    return () => {
      socket.disconnect();
    };
  }, []);

  const ActiveView = VIEWS[view] || Dashboard;

  return (
    <Layout view={view} setView={setView}>
      <ActiveView />
    </Layout>
  );
}
