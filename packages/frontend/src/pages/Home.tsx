import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  title: string;
  description: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  const handleProjectClick = async (project: Project) => {
    navigate(`/project/${project.id}`);
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      title: `New Project ${projects.length + 1}`,
      description: "Click to configure your new project",
    };
    setProjects([...projects, newProject]);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="h-9 flex flex-row items-center mb-3">
          <img src="/aim-red.png" alt="AIM-Intelligence" className="h-8 mr-2" />
          <h1 className="text-4xl font-bold ">Projects</h1>
        </div>

        <p className="text-gray-400 mb-8">
          Select a project or create a new one
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className="bg-black border-2 border-gray-500 rounded-lg p-6 cursor-pointer hover:bg-gray-750 hover:border-red-700 transition-all duration-200"
            >
              <h2 className="text-xl font-semibold mb-2">{project.title}</h2>
              <p className="text-gray-400 text-sm">{project.description}</p>
            </div>
          ))}

          <div
            onClick={handleCreateProject}
            className="bg-black border-2 border-dashed border-gray-500 rounded-lg p-6 cursor-pointer hover:border-red-700 hover:bg-gray-750 hover:text-red-700 transition-all duration-200 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">+</div>
              <p className="">Create New Project</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
