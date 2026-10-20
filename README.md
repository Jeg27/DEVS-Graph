# DEVS-Graph GUI

A graphical tool for the modelling, simulation, validation, and experimentation of Discrete-Event System Specification (DEVS) models.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Main Features](#2-main-features)
- [3. System Requirements](#3-system-requirements)
- [4. Installation and Setup](#4-installation-and-setup)
- [5. Running the System](#5-running-the-system)
- [6. GUI Overview](#6-gui-overview)
- [7. Standard Modelling Workflow](#7-standard-modelling-workflow)
- [8. Experiment Workflow](#8-experiment-workflow)
- [9. Oracle Validation](#9-oracle-validation)
- [10. File Operations](#10-file-operations)
- [11. Interaction Features](#11-interaction-features)
- [12. Help](#12-help)
- [13. Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The DEVS-Graph GUI is a low-code modelling environment for DEVS systems.

### Core Capabilities
- Create atomic models visually
- Create coupled models
- Define state and behavior
- Run simulations
- Design experiments (MUT + EF)
- Validate outputs using an oracle

### Important Note
All DEVSMap generation, C++ generation, compilation, and execution occur in the backend automatically.
Users do NOT manually trigger these steps.

### 🎥 Demo Video

A brief walkthrough of the DEVS-Graph GUI demonstrating modelling, simulation, validation, and experiment workflows:

[▶️ Watch Video](https://drive.google.com/file/d/1MyH83FFyC5bo2i_kN1P_n4MCFr8oWnK-/view)
---

## 2. Main Features

- Drag-and-drop modelling interface
- Atomic model creation
- Coupled model creation
- State variable definition
- Internal / External transitions
- Output & time advance functions
- Simulation execution
- Experiment design (MUT + EF)
- Oracle-based validation
- XML save/load support
- PNG export
- Output logs and CSV view

---

## 3. System Requirements

Ensure the following are installed:

- Git
- Python 3.9+
- Modern browser (Chrome recommended)
- g++ (C++ compiler)

Install Python dependencies by running the following command from the DEVS-Graph directory:

```
python -m pip install -r requirements.txt
```

---

## 4. Installation and Setup

### Clone Repository

```
git clone https://github.com/murf85/DEVS_Graph_GUI_DataTypes.git
cd DEVS_Graph_GUI_DataTypes
```

### IMPORTANT: Create Your Own Branch

Do NOT work on main:

```
git checkout -b your_name_branch
```

---

## 5. Running the System

Run:

```
source .venv/bin/activate
python start_all.py
```

This starts:
- Backend server
- Parser
- Cadmium execution pipeline
- Oracle validation server

Open in browser:

http://localhost:5500/index.html

---

## 6. GUI Overview

### Left Panel
- Model palette

### Canvas
- Build and connect models

### Right Panel
- Properties tab (model configuration)
- Experiment tab (experiment setup)

### Bottom Panel
- Logs
- CSV outputs
- Validation results

---

## 7. Standard Modelling Workflow

1. Drag atomic model
2. Configure:
   - Model name
   - Ports
   - State variables
   - Transitions
   - Output
   - Time advance

3. Create coupled model
4. Define couplings (IC, EIC, EOC)
5. Run simulation

Backend automatically:
- Generates DEVSMap
- Generates C++
- Compiles and executes

6. View output in bottom panel

---

## 8. Experiment Workflow

1. Ensure models exist on canvas
2. Open Experiment tab
3. Select MUT (Model Under Test)
4. Select EF (Experimental Frame)
5. Configure initial states
6. Define CPIC / POCC couplings
7. Run experiment
8. View results

---

## 9. Oracle Validation

The oracle validation compares simulation output against **expected states defined by the user**.

### Prerequisite
The system must already be running:

```
python start_all.py
```

---

### Required Setup (IMPORTANT)

Before running validation, you must define expected outputs in:

```
DEVS-Graph/Oracle/expected_DEVS_states.csv
```

In this file, you must manually add your **expected states**.

Follow the exact format used in the existing rows inside the file.

⚠️ Validation will NOT work unless this file is properly filled.

---

### Steps

1. Run a simulation or experiment  
2. Navigate to:
   ```
   DEVS-Graph/Oracle/expected_DEVS_states.csv
   ```
3. Add expected states using the same structure as existing examples  
4. Save the file  
5. In the GUI, open the validation section  
6. Click **Run Validation**

---

### Results

- **PASS** → Output matches expected states  
- **FAIL** → Output deviates from expected states  
- **NOT TESTED** → Validation did not execute correctly  

---

### Notes

- Validation depends entirely on correctly formatted expected states  
- Always follow the structure of existing examples in the CSV file  
- Common mistakes:
  - Missing rows or columns  
  - Incorrect formatting  
  - Mismatched values with simulation output  

---

### Tips

- Start by copying an existing example row and modifying it  
- Keep naming consistent with your model definitions  
- If validation fails unexpectedly, double-check the CSV formatting first  


## 10. File Operations

- New graph
- Save XML
- Load XML
- Export PNG

---

## 11. Interaction Features

Toolbar:
- Copy / Paste
- Undo / Redo
- Delete
- Zoom

Right-click:
- Model actions

---

## 12. Help

Inside GUI → Help button:

- About
- User Manual (Google Docs version)

---

## 13. Troubleshooting

### Flask Error

ModuleNotFoundError: No module named 'flask_cors'

Fix:

```
pip install flask flask-cors
```

### Common Issues

- Ensure model name is filled
- Use different model name and ID
- Fill all parameters
- Verify couplings
- Ensure simulation time is numeric

### Tips

- Use descriptive names
- Follow example models (e.g., counter / step counter)
- Check bottom output panel after running
