// import aimRedLogo from "../../assets/aim-red.png";

export default function Loading() {
  const loadingtexts = [
    "Prepairing...",
    "Loading...",
    "Red-Teaming...",
    "Hacking...",
  ];
  const text = loadingtexts[Math.floor(Math.random() * loadingtexts.length)];
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center flex-col z-50">
      <img
        src={"/aim-red.png"}
        alt="Loading"
        className="w-9 h-9 animate-spin-reverse"
      />
      <span className="text-white text-lg ml-4 p-8">{text}</span>
    </div>
  );
}
