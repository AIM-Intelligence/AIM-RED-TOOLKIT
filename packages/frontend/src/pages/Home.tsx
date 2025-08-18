import { useState } from "react";
import Modal from "../components/modal/Modal";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <h1>Welcome to the Home Page</h1>
      <p>This is the starting point of our application.</p>

      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Open Modal
      </button>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h2>Modal Content</h2>
        <p>This is the modal content. You can put anything here.</p>
      </Modal>
    </div>
  );
}
