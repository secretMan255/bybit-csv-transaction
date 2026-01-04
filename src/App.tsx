import "./App.css";
import { HashRouter as Router } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import Layout from "./components/layout";

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <AppRoutes />
      </Layout>
    </Router>
  );
};

export default App;
