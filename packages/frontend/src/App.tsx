import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Project from "./pages/Project/Project";
import WrongPath from "./pages/WrongPath/WrongPath";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/project/:projectTitle" element={<Project />} />
        <Route path="*" element={<WrongPath />} />
      </Routes>
    </Router>
  );
}

export default App;
