import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NodeMaker from "../components/modal/NodeMaker";
import Loading from "../components/loading/Loading";
import type { ProjectInfo, Projects } from "../types";

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [makingProject, setMakingProject] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getProjects = async () => {
    try {
      const response = await fetch("/api/project/");
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      const data: Projects = await response.json();
      if (data.success && data.projects) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getProjects();
  }, []);

  const handleProjectClick = async (project: ProjectInfo) => {
    navigate(`/project/${project.project_id}`);
  };

  const handleCreateProject = () => {
    setMakingProject(true);
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: ProjectInfo) => {
    e.stopPropagation(); // Prevent navigation to project
    
    if (!confirm(`Are you sure you want to delete "${project.project_name}"?`)) {
      return;
    }

    try {
      const response = await fetch("/api/project/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: project.project_name,
          project_id: project.project_id,
        }),
      });

      if (response.ok) {
        // Refresh the projects list
        await getProjects();
      } else {
        console.error("Failed to delete project");
        alert("Failed to delete project. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Error deleting project. Please try again.");
    }
  };

  if (isLoading) {
    return <Loading />;
  }

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
              key={project.project_id}
              onClick={() => handleProjectClick(project)}
              className="bg-black border-2 border-gray-500 rounded-lg p-6 cursor-pointer hover:bg-gray-750 hover:border-red-700 transition-all duration-200 relative group"
            >
              <button
                onClick={(e) => handleDeleteProject(e, project)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center"
                title="Delete project"
              >
                ×
              </button>
              <h2 className="text-xl font-semibold mb-2">
                {project.project_name}
              </h2>
              <p className="text-gray-400 text-sm">
                {project.project_description}
              </p>
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
      <NodeMaker
        isOpen={makingProject}
        onClose={() => {
          setMakingProject(false);
          getProjects(); // Refresh projects list after closing modal
        }}
      />
    </div>
  );
}
