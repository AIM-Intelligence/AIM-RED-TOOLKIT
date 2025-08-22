import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProjectMaker from "../components/modal/ProjectMaker";
import DeleteCheck from "../components/modal/DeleteCheck";
import Loading from "../components/loading/Loading";
import type { ProjectInfo } from "../types";
import { projectApi } from "../utils/api";

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [makingProject, setMakingProject] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    project: ProjectInfo | null;
  }>({ isOpen: false, project: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const getProjects = async () => {
    try {
      const data = await projectApi.getAllProjects();
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

  const handleDeleteClick = (e: React.MouseEvent, project: ProjectInfo) => {
    e.stopPropagation(); // Prevent project card click
    setDeleteModal({ isOpen: true, project });
  };

  const handleSettingsClick = (e: React.MouseEvent, project: ProjectInfo) => {
    e.stopPropagation(); // Prevent project card click
    // TODO: Implement settings functionality
    console.log("Settings clicked for project:", project.project_name);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.project) return;

    setIsDeleting(true);
    try {
      const result = await projectApi.deleteProject({
        project_name: deleteModal.project.project_name,
        project_id: deleteModal.project.project_id,
      });

      if (result.success) {
        // Refresh projects list
        await getProjects();
        // Close modal
        setDeleteModal({ isOpen: false, project: null });
      } else {
        alert("Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsDeleting(false);
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
              className="bg-black border-2 border-gray-500 rounded-lg p-6 cursor-pointer hover:bg-gray-900 hover:border-red-700 transition-all duration-200 relative group"
            >
              {/* Header with icons */}
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold flex-1">
                  {project.project_name}
                </h2>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Settings Icon */}
                  <button
                    onClick={(e) => handleSettingsClick(e, project)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Settings"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400 hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                  {/* Delete Icon */}
                  <button
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Delete"
                  >
                    <svg
                      className="w-5 h-5 text-gray-400 hover:text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                {project.project_description}
              </p>
            </div>
          ))}

          <div
            onClick={handleCreateProject}
            className="bg-black border-2 border-dashed border-gray-500 rounded-lg p-6 cursor-pointer hover:border-red-700 hover:bg-gray-900 hover:text-red-700 transition-all duration-200 flex items-center justify-center"
          >
            <div className="text-center">
              <div className="text-4xl mb-2">+</div>
              <p className="">Create New Project</p>
            </div>
          </div>
        </div>
      </div>
      <ProjectMaker
        isOpen={makingProject}
        onClose={() => {
          setMakingProject(false);
          getProjects(); // Refresh projects list after closing modal
        }}
      />
      <DeleteCheck
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, project: null })}
        onConfirm={handleDeleteConfirm}
        projectName={deleteModal.project?.project_name || ""}
        isDeleting={isDeleting}
      />
    </div>
  );
}
