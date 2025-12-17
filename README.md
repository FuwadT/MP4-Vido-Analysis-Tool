# MP4 Video Analysis Tool (AI-Powered)

This is an advanced, web-based tool for **automating object detection and classification** in video files. Built with **React** and **TensorFlow.js**, it brings computer vision directly into the browser, allowing for real-time analysis, tagging, and review of video content.

## 🚀 Features

### 🤖 smart AI Detection
*   **Dual-Model Architecture**: Combines **COCO-SSD** for fast object localization and **MobileNet** for detailed classification.
*   **Strict Schema Enforcement**: Automatically filters noise and categorizes objects into defined classes: `Vehicle`, `Pedestrian`, `Bus`, `Truck`, `Cyclist`, `Emergency-Vehicle`, `Golf-Cart`, `Van`, `Scooter`, and `Animal`.
*   **Traffic Light Analysis**: Uses computer vision to detect red/green traffic light states in real-time.

### 🎥 Advanced Playback & Analysis
*   **Terminator HUD**: A high-tech "Head-Up Display" overlay visualizes the scanning process.
*   **Analysis Cropping**: Set specific **Start** and **End** times to analyze only the relevant parts of a long video.
*   **Pause & Resume**: Fully controllable analysis loop—pause the AI to take a break and resume exactly where you left off.

### 📊 "Session Tracks" Sidebar
*   **Smart Analytics**: Tracks every unique object found in the video.
*   **Search**: Find specific tracked objects by ID or Class name (e.g., "Van").
*   **Sort & Filter**: Organize your detections by **Time Found**, **Probability Score**, or **Class**.
*   **Click-to-Seek**: Instantly jump to the exact second an object first appeared in the video by clicking it in the list.

### 💾 Memory & Persistence (YAML)
*   **Save Sessions**: Export your entire analysis session as a readable **YAML** file (`.yaml`).
*   **Load Memory**: Upload a previous session file to instantly restore all tags and tracking data without re-processing the video.
*   **Teach Mode**: Manually rename tags (e.g., "Vehicle #3" -> "My Car"), and the AI will remember the new label for that object throughout the video.

## 🛠️ Technology Stack
*   **Frontend**: React (Vite)
*   **AI/ML**: TensorFlow.js, COCO-SSD, MobileNet
*   **Styling**: Tailwind CSS, Lucide React (Icons)
*   **Data Format**: YAML (js-yaml)

## 📦 Installation & Usage

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/FuwadT/MP4-Vido-Analysis-Tool.git
    cd MP4-Vido-Analysis-Tool
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open in Browser**:
    Navigate to `http://localhost:5173` (or the port shown in your terminal).

## 📝 License
This project is open-source and available under the simple tracker license.
