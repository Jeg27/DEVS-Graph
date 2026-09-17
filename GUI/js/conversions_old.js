export class ConversionManager {


    constructor(graph) {
        this.graph = graph;
    }


    // gets the XML representation of the DEVS Graph
    getGraphXML() {
        const encoder = new mxCodec();
        const node = encoder.encode(this.graph.getModel());
        const xml = mxUtils.getPrettyXml(node);
        return xml;
    }


    // Logs the XML representation of the DEVS Graph to the browser console
    previewGraphXML() {
        console.log(this.getGraphXML());
    }


    // Saves the DEVS Graph in XML format for local save/load functionality
    saveGraphXML() {
        // application/octet-stream prevents XML preview in some browsers
        const blob = new Blob([this.getGraphXML()], { type: 'application/octet-stream' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "graph.xml"; // default filename
        link.click();

        URL.revokeObjectURL(link.href);
    }


    // TODO this must be updated once the final structure is determined
    // Loads a DEVS Graph from an XML-formatted file for local save/load functionality
    loadGraphXML() {
        // Prompt user to select file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xml'; // restrict to XML files

        // Listen for the file selection
        input.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;

            // Read XML file as a text file
            const reader = new FileReader();
            reader.onload = (e) => {
                const xmlText = e.target.result;

                try {
                    // Parse XML to the DOM
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

                    // Convert to mxGraph model
                    const decoder = new mxCodec(xmlDoc);
                    this.graph.getModel().beginUpdate();
                    try {
                        decoder.decode(xmlDoc.documentElement, this.graph.getModel());
                    } finally {
                        this.graph.getModel().endUpdate(); // triggers redraw
                    }

                    console.log('Graph loaded successfully.');
                } catch (err) {
                    console.error('Failed to load graph: ', err);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }


    // Gets a list of the JSON user objects of each cell on the graph (Not DEVSMap representations)
    getUserObjects() {
        // Encode graph to XML
        const encoder = new mxCodec();
        const node = encoder.encode(this.graph.getModel());
        const xmlText = mxUtils.getPrettyXml(node);

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // Recursive XML → JS converter
        function parseXmlNode(xmlNode) {
            if (!xmlNode) return null;

            if (xmlNode.tagName === "Object") {
                const obj = {};

                // Copy attributes in order
                for (let i = 0; i < xmlNode.attributes.length; i++) {
                    const attr = xmlNode.attributes[i];
                    if (attr.name !== "as") obj[attr.name] = attr.value;
                }

                // Add children in order
                for (let i = 0; i < xmlNode.children.length; i++) {
                    const child = xmlNode.children[i];
                    const key = child.getAttribute("as") || child.tagName;
                    const value = parseXmlNode(child);
                    obj[key] = value; // no array needed since no duplicate keys
                }

                return obj;
            }

            if (xmlNode.tagName === "Array") {
                const arr = [];
                for (let i = 0; i < xmlNode.children.length; i++) {
                    const child = xmlNode.children[i];
                    if (child.tagName === "add") {
                        arr.push(child.getAttribute("value"));
                    } else {
                        arr.push(parseXmlNode(child));
                    }
                }
                return arr;
            }

            if (xmlNode.tagName === "add") {
                return xmlNode.getAttribute("value");
            }

            return null;
        }

        // Find all userObjects
        const userObjectNodes = xmlDoc.querySelectorAll('Object[as="userObject"]');
        const userObjects = Array.from(userObjectNodes).map(node => parseXmlNode(node));

        // Return plain JS objects
        return userObjects;
    }


    // Prints a list of the JSON user objects of each cell on the graph (Not DEVSMap representations) to the browser console
    previewUserObjects() {
        const userObjects = this.getUserObjects();

        console.log(JSON.stringify(userObjects, null, 2));
    }


    // Returns the UID of the top coupled model on the DEVS Graph
    getTopModel() {
        const model = this.graph.getModel();
        const root = model.getRoot();
        const topLevelCoupled = [];

        // Recursive function to traverse the graph
        function traverse(cell) {
            if (!cell) return;

            // Check if the cell is a coupled model
            if (cell.isCoupledModel()) {
                // Only add if parent is not a coupled model
                if (!cell.parent || !cell.parent.isCoupledModel()) {
                    topLevelCoupled.push(cell);
                }
            }

            // Recurse on children
            const childCount = model.getChildCount(cell);
            for (let i = 0; i < childCount; i++) {
                traverse(model.getChildAt(cell, i));
            }
        }

        traverse(root);

        if (topLevelCoupled.length === 0) {
            console.error("No top-level coupled model found.");
            return undefined;
        } else if (topLevelCoupled.length > 1) {
            console.error(
                `Multiple top-level coupled models found: ${topLevelCoupled
                    .map(c => c.userObject?.unique_id)
                    .join(", ")}`
            );
            return undefined;
        }

        // Exactly one top model → return its unique_id
        return topLevelCoupled[0].userObject?.unique_id?.toLowerCase();
    }


    getInitStates() {
        const topModelId = this.getTopModel();
        const userObjects = this.getUserObjects();

        const result = {};
        result[topModelId.toLowerCase()] = {};

        // 1. Find top level coupled model
        const topModelObj = userObjects.find(
            u =>
                u.elementType === "coupledModel" &&
                String(u.unique_id).toLowerCase() === String(topModelId).toLowerCase()
        );

        if (!topModelObj) {
            console.error("Top model not found:", topModelId);
            return result;
        }

        const components = topModelObj.json.model.components;
        // components = [ { model: "...", id: "..." }, ... ]

        // 2. Iterate each component
        for (const component of components) {

            const uniqueId = component.component_id ?? component.id;

            // Find corresponding atomic model by unique_id
            const atomic = userObjects.find(
                u =>
                    u.elementType === "atomicModel" &&
                    String(u.unique_id).toLowerCase() === String(uniqueId).toLowerCase()
            );

            if (!atomic) {
                console.warn("No atomic model found for unique_id:", uniqueId);
                continue;
            }

            const stateVars = atomic.json.model.s; // contains sigma, count, etc.

            // Build cleaned state dict
            const cleanedState = {};
            for (const [stateName, stateObj] of Object.entries(stateVars)) {
                cleanedState[stateName] = stateObj.init_state;
            }

            // Add to result under the unique_id (lowercased)
            result[topModelId.toLowerCase()][uniqueId.toLowerCase()] = cleanedState;
        }

        return result;
    }


    // Gets the simulation time from the top-right input box on the GUI
    getSimulationTime() {
        const previewEl = document.getElementById("previewNumberInput");
        const expEl = document.getElementById("timeSpanInput");

        let inputValue = parseFloat(previewEl?.value);

        if (isNaN(inputValue)) {
            inputValue = parseFloat(expEl?.value);
        }

        if (isNaN(inputValue)) {
            inputValue = 50.0;
        }

        console.log("previewNumberInput value:", previewEl?.value);
        console.log("timeSpanInput value:", expEl?.value);
        console.log("FINAL SIM TIME:", inputValue);

        return inputValue;
    }


    // Gets the DEVSMap representation of the DEVS Graph
    // This is done by taking the user objects, simulation time, and top model, and adding the relevant
    // data to a new data structure, where each key is a DEVSMap filename, and each value is a dictionary 
    // corresponding to the values of that DEVSMap structure
    getDEVSMap() {
        // Get required values for generating DEVSMap

        let time_span = this.getSimulationTime();
        console.log("DEVSMap time_span =", time_span);

        let top_model_id = this.getTopModel()?.toLowerCase();
        let top_model_uid = String(top_model_id).toLowerCase();


        

        // Additional values may need to be added/obtained here as the functionality is extended

        // Then we will process the JSON to convert it to legal DEVSMap
        const userObjects = this.getUserObjects();

        let DEVSMap = {};

        // Create a simple experiment.json (no experimental frames yet)
        DEVSMap[top_model_uid + '_experiment.json'] = {
            'model_under_test': {
                'model': top_model_uid + '_coupled.json',
                'initial_state': top_model_uid + '_init_state.json',
                'parameters': ''
            },
            'experimental_frame': {},
            'cpic': {},
            'pocc': {},
            'time_span': String(time_span)
        }

        // Create init_states.json
        DEVSMap[top_model_uid + '_init_state.json'] = {
            'init_states': this.getInitStates()
        }

        // Create all of the XYZ_atomic.json
        for (let i = 0; i < userObjects.length; i++) {
            if (userObjects[i].elementType === "atomicModel") {

                // // Create all of the XYZ_atomic.json
                const { filename, json } = this.createAtomicModelJSON(userObjects[i]);
                DEVSMap[filename] = json;

            } else if (userObjects[i].elementType === "coupledModel") {

                // // Create all of the XYZ_coupled.json
                const { filename, json } = this.createCoupledModelJSON(userObjects[i]);
                DEVSMap[filename] = json;

            } else {
                //console.log("Invalid elementType: " + userObjects[i].elementType);
            }

        }
        return DEVSMap;
    }


    createAtomicModelJSON(userObject) {
        const modelName = userObject.model_name.toLowerCase();
        const uid = userObject.unique_id.toLowerCase();

        // Copy the model JSON
        const atomicData = {
            [modelName]: { ...userObject.json.model },
            include_sets: userObject.json.include_sets,
            parameters: userObject.json.parameters
        };

        // Convert state variables to {name: type}
        const stateVars = atomicData[modelName]['s'];
        for (const [key, value] of Object.entries(stateVars)) {
            stateVars[key] = value['data_type'];
        }

        // Return both filename and the JSON
        return {
            filename: `${uid}_atomic.json`,
            json: atomicData
        };
    }



    createCoupledModelJSON(userObject) {
    const name = userObject.model_name.toLowerCase();
    const uid = userObject.unique_id.toLowerCase();

    const modelCopy = JSON.parse(JSON.stringify(userObject.json.model));

    // convert internal component_id -> exported id
    if (Array.isArray(modelCopy.components)) {
        modelCopy.components = modelCopy.components.map(c => ({
            model: c.model,
            id: c.component_id ?? c.id
        }));
    }

    return {
        filename: `${uid}_coupled.json`,
        json: {
            [name]: modelCopy,
            include_sets: userObject.json.include_sets
        }
    };
}


    // Logs the DEVSMap representation of the DEVS Graph to the browser console
    previewDEVSMap() {
        const devsMap = this.getDEVSMap();
        console.log(devsMap);

        window.__LAST_DEVS_MAP = devsMap;

        window.showBottomSimulationOutput?.(
            JSON.stringify(devsMap, null, 2)
        );
    }


    // Takes the DEVSMap representation of the DEVS Graph, sends it to the 
    // DEVSMap_to_Cadmium_Parser module, and logs the resulting Cadmium Code 
    // to the browser console.
    async previewCadmiumCode() {
        const logDEVSMap = false;
        const logCadmiumCode = true;

        const DEVSMap = this.getDEVSMap();

        if (logDEVSMap) {
            console.log("DEVSMap:", DEVSMap);
        }

        // HTTP Calls 
        const codeResult = await this.generateCode(DEVSMap, logCadmiumCode);

    }


    // Takes the DEVSMap representation of the DEVS Graph, sends it to the 
    // DEVSMap_to_Cadmium_Parser module, then sends the resulting Cadmium code
    // to the Cadmium_Builder module (which will build and simulate the Cadmium 
    // code).  Then, logs the resulting simulation output to the browser console.
    async previewSimulationOutput() {
        console.log("NORMAL RUN path");
        const logDEVSMap = false;
        const logCadmiumCode = false;
        const logSimulationOutput = true;

        const DEVSMap = this.getDEVSMap();

        if (logDEVSMap) {
            console.log("DEVSMap:", DEVSMap);
        }

        window.showBottomSimulationOutput?.("Sending bundle to parser...");

        const codeResult = await this.generateCode(DEVSMap, logCadmiumCode);


        if (!codeResult) {
            window.showBottomSimulationOutput?.("Parser returned no response.");
            return;
        }

        if (codeResult.error) {
            console.error("Parser error:", codeResult.error);
            window.showBottomSimulationOutput?.("Parser error: " + codeResult.error);
            return;
        }

        window.showBottomSimulationOutput?.("Parser finished. Running simulation...");

        const csvResult = await this.generateCSV(codeResult, logSimulationOutput);

        window.__LAST_CSV_OUTPUT = csvResult || "";
        window.showBottomSimulationOutput?.(csvResult || "No simulation output returned.");

        console.log("previewNumberInput =", document.getElementById("previewNumberInput")?.value);
        console.log("timeSpanInput =", document.getElementById("timeSpanInput")?.value);
        console.log("getSimulationTime() =", this.getSimulationTime());
        console.log("DEVSMap sent:", DEVSMap);
}


    // TODO / WIP
    // Will do the same as the above function, but then send the resulting simulation 
    // output to the trace viewer for graphical display
    async viewTrace() {
        const logDEVSMap = true;
        const logCadmiumCode = true;
        const logSimulationOutput = true;

        // DEVSMap
        const DEVSMap = this.getDEVSMap();

        if (logDEVSMap) {
            console.log("DEVSMap:", DEVSMap);
        }

        // Cadmium Code
        const codeResult = await this.generateCode(DEVSMap, logCadmiumCode);

        // Simulation Output
        const csvResult = await this.generateCSV(codeResult, logSimulationOutput);

        // Trace Viewer
        // TODO

    }


    // Sends DEVSMap to the DEVSMap_to_Cadmium_Parser module, receives the resulting 
    // Cadmium Code
    async generateCode(DEVSMap, logCadmiumCode = true) {

        try {
            const response = await fetch("http://localhost:8000/parse", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(DEVSMap)
            });

            const data = await response.json();

            if (logCadmiumCode) {
                console.log("Response from parser:", data);
            }

            return data;  // optional: in case you want to use it elsewhere

        } catch (error) {
            console.error("Error sending data to parser:", error);
        }
    }


    // Sends Cadmium code to the Cadmium_Builder module, receives the resulting 
    // simulation output
    async generateCSV(CadmiumCode, logSimulationOutput = true) {
    try {
        const response = await fetch("http://localhost:8001/simulation-output", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(CadmiumCode)
        });

        const data = await response.text();

        if (logSimulationOutput) {
            console.log("Response from Cadmium Builder:", data);
        }

        return data;
    } catch (error) {
        console.error("Error sending data to Cadmium Builder:", error);
    }
}


}