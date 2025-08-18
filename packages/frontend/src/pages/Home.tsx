import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  title: string;
  description: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([
    {
      id: "1",
      title: "Data Pipeline Project",
      description: "Build and manage data processing workflows with ML models",
    },
    {
      id: "2",
      title: "Analytics Dashboard",
      description: "Real-time analytics and visualization platform",
    },
    {
      id: "3",
      title: "Model Training Suite",
      description: "Train, evaluate, and deploy machine learning models",
    },
  ]);

  const generateProjectHash = async (
    projectId: string,
    title: string
  ): Promise<string> => {
    const combined = projectId + title;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex.substring(0, 16);
  };

  const handleProjectClick = async (project: Project) => {
    const hash = await generateProjectHash(project.id, project.title);
    navigate(`/project/${hash}`);
  };

  const handleCreateProject = () => {
    const newProject: Project = {
      id: Date.now().toString(),
      title: `New Project ${projects.length + 1}`,
      description: "Click to configure your new project",
    };
    setProjects([...projects, newProject]);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Projects</h1>
        <p className="text-gray-400 mb-8">
          Select a project or create a new one
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => handleProjectClick(project)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-6 cursor-pointer hover:bg-gray-750 hover:border-red-700 hover:border-2 transition-all duration-200"
            >
              <h2 className="text-xl font-semibold mb-2">{project.title}</h2>
              <p className="text-gray-400 text-sm">{project.description}</p>
            </div>
          ))}

          <div
            onClick={handleCreateProject}
            className="bg-gray-800 border-2 border-dashed border-gray-600 rounded-lg p-6 cursor-pointer hover:border-red-700 hover:border-2 hover:bg-gray-750 transition-all duration-200 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">+</div>
              <p className="text-gray-400">Create New Project</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
