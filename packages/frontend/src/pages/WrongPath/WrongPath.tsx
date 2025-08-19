import { useNavigate } from "react-router-dom";

export default function WrongPath() {
  const navigate = useNavigate();
  const goRoot = () => navigate("/");
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center flex-col z-50">
      <img
        src={"/aim-red.png"}
        alt="Loading"
        className="w-9 h-9 animate-spin-reverse"
      />
      <span className="text-white text-2xl p-8">Wrong Path</span>
      <button
        className="bg-red-900 text-white text-xl mt-4 p-6 rounded-xl hover:bg-red-800"
        onClick={goRoot}
      >
        Select Project
      </button>
    </div>
  );
}
