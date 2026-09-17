import { helloWorld } from './development.js'; // delete later

import { copySelectedCells, pasteClipboardCells, undoAction, redoAction, duplicateSelectedCells, cutSelectedCells, deleteSelectedCells, deleteAllCells, selectAllCells } from './graph-utils.js';

import { exportGraphImage } from './image-utils.js';

import { ConversionManager } from './conversions.js';
import { shortcuts } from './shortcuts.js';
import { setupExperimentSidebar } from "./experiment-design.js";

window.customDataTypes = window.customDataTypes || [];

function getAvailableTypes() {
    return [
        "int",
        "double",
        "bool",
        "char",
        "string",
        ...window.customDataTypes.map(t => t.name)
    ];
}
const markDirty = () => {
    window.autosaveGraphNow?.();
};

function setupBottomPanelResizer() {
    const bottomPanel = document.getElementById("bottomPanel");
    const bottomResizer = document.getElementById("bottomResizer");
    const centralArea = document.getElementById("centralArea");

    if (!bottomPanel || !bottomResizer || !centralArea) {
        console.warn("Bottom panel resizer elements not found");
        return;
    }

    let dragging = false;

    const MIN_HEIGHT = 80;
    const MAX_HEIGHT = 500;

    bottomResizer.addEventListener("mousedown", (e) => {
        dragging = true;
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;

        const rect = centralArea.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;

        const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight));
        bottomPanel.style.height = clamped + "px";
    });

    document.addEventListener("mouseup", () => {
        if (!dragging) return;

        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
}


function main(container) {
    // Check browser compatibility
    if (!mxClient.isBrowserSupported()) {
        mxUtils.error('Browser is not supported!', 200, false);
        return;
    }

    // Create the graph inside the container
    const graph = new mxGraph(container);

    // These for sure
    graph.setPanning(true);
    graph.setConnectable(true);
    graph.setCellsMovable(true);
    graph.setCellsSelectable(true);

    // May want to change these later
    graph.setGridEnabled(false);            // snapping to grid
    graph.setAllowDanglingEdges(true);     // whether edges must be connected on both ends


    // Graph selection via mouse dragging
    new mxRubberband(graph);


    /////////////////////////////////////////////////////////////////////////////
    ///////// Undo & Redo
    /////////////////////////////////////////////////////////////////////////////
    const undoManager = new mxUndoManager();
    // Listen to model and view changes
    const undoHandler = function (sender, evt) {
        undoManager.undoableEditHappened(evt.getProperty('edit'));
    };
    graph.getModel().addListener(mxEvent.UNDO, undoHandler);
    graph.getView().addListener(mxEvent.UNDO, undoHandler);


    /////////////////////////////////////////////////////////////////////////////
    ///////// Mouse Wheel Zoom
    /////////////////////////////////////////////////////////////////////////////
    mxEvent.addMouseWheelListener(function (evt, up) {
        const gc = document.getElementById("graphContainer");
        const target = evt.target;

        if (!gc || !target || !target.closest("#graphContainer ")) return;

        if (up) {
            graph.zoomIn();
        } else {
            graph.zoomOut();
        }
        evt.preventDefault();
    });


    /////////////////////////////////////////////////////////////////////////////
    ///////// Graphing Utils
    /////////////////////////////////////////////////////////////////////////////

    // Extend mxCell prototype to add isState(), isAtomicModel(), isCoupledModel(), and isExperimentalFrame() functions
    mxCell.prototype.isState = function () {
        return this.userObject?.elementType?.toLowerCase() === "state";
    };

    mxCell.prototype.isAtomicModel = function () {
        return this.userObject?.elementType?.toLowerCase() === "atomicmodel";
    };

    mxCell.prototype.isCoupledModel = function () {
        return this.userObject?.elementType?.toLowerCase() === "coupledmodel";
    };

    mxCell.prototype.isExperimentalFrame = function () {
        return (
            this.userObject?.elementType?.toLowerCase() === "experimentalframe" ||
            this.isExperimentalFrame === true
        );
    };

    mxCell.prototype.getInputPorts = function () {
        const ports = this.userObject?.json?.model?.x || {};
        // Convert to array of { name, type }
        return Object.entries(ports).map(([name, type]) => ({ name, type }));
    };

    mxCell.prototype.getOutputPorts = function () {
        const ports = this.userObject?.json?.model?.y || {};
        // Convert to array of { name, type }
        return Object.entries(ports).map(([name, type]) => ({ name, type }));
    };



    function groupCells() {
        if (!graph || !graph.getSelectionCells) return;

        const cells = graph.getSelectionCells();
        if (!cells || cells.length < 2) {
            alert("Select at least two cells to group.");
            return;
        }

        const padding = 20; // space around the cells

        graph.getModel().beginUpdate();
        try {
            // Create the group
            const group = graph.groupCells(null, 0, cells);

            // Style the group
            group.setStyle('rounded=1;arcSize=20;fillColor=#f0f0f0;strokeColor=#888;strokeWidth=2;');
            group.setConnectable(false);

            // Adjust geometry to add padding
            const geo = graph.getCellGeometry(group);
            if (geo) {
                geo.x -= padding;
                geo.y -= padding;
                geo.width += padding * 2;
                geo.height += padding * 2;
                graph.getModel().setGeometry(group, geo);
            }

            // Move child cells inward by the padding so they're centered visually
            const childCount = graph.model.getChildCount(group);
            for (let i = 0; i < childCount; i++) {
                const child = graph.model.getChildAt(group, i);
                const childGeo = graph.getCellGeometry(child);
                if (childGeo) {
                    const clone = childGeo.clone();
                    clone.x += padding;
                    clone.y += padding;
                    graph.getModel().setGeometry(child, clone);
                }
            }

        } finally {
            graph.getModel().endUpdate();
        }

        graph.refresh();
    }


    function groupAsCoupledModel(graph) {
        let selectedCells = graph.getSelectionCells();

        // Keep only real mxCells that are vertices
        selectedCells = selectedCells.filter(
            c => c instanceof mxCell && graph.getModel().isVertex(c)
        );

        if (selectedCells.length < 1) {
            alert("Select at least one cell to group");
            return;
        }

        graph.getModel().beginUpdate();
        try {
            const border = 30;

            let group;

            if (selectedCells.length === 1) {
                // Special case: only one cell
                const child = selectedCells[0];
                const model = graph.getModel();
                const parent = model.getParent(child);
                const bounds = graph.getCellGeometry(child).clone();

                // Create a new group cell
                group = new mxCell();
                group.vertex = true;
                group.geometry = new mxGeometry(
                    bounds.x - border / 2,
                    bounds.y - border / 2,
                    bounds.width + border,
                    bounds.height + border
                );

                // Add the group to the graph
                model.add(parent, group, model.getChildCount(parent));

                // Move the single child into the group
                graph.addCells([child], group);
            } else {
                // Standard case: multiple cells
                group = graph.groupCells(null, border, selectedCells);
            }

            // Style the group
            group.setStyle(
                'shape=rectangle;' +
                'fillColor=#FFFFFF;' +
                'strokeColor=#424242;' +
                'rounded=1;' +
                'verticalAlign=top;' +
                'align=center;' +
                'spacingTop=4;' +
                'whiteSpace=wrap;' +
                'overflow=fill;' +
                'fontSize=16;' +
                'fontColor=#000000;'
            );

            // Visible label for the group
            group.value = "Enter a name and id for this coupled model";

            // Attach DEVS metadata
            group.userObject = {
                elementType: 'coupledModel',
                model_name: 'defaultName',
                unique_id: 'defaultID',
                json: {
                    model: {
                        x: {},
                        y: {},
                        components: [],
                        eic: [],
                        eoc: [],
                        ic: []
                    },
                    include_sets: ["default_sets.json"],
                },
            };

            // Populate components
            selectedCells.forEach(child => {
                const childName = child.userObject?.model_name || 'unnamed';
                const childId = child.userObject?.unique_id || child.getId();

                group.userObject.json.model.components.push({
                    model: childName,
                    component_id: childId //changed to component_id instead of id to allow for retainment after a refresh
                });
            });

            // Move the group on top of children
            const model = graph.getModel();
            const parent = model.getParent(group);
            if (parent) {
                const index = model.getChildCount(parent) - 1;
                model.add(parent, group, index);
            }

            // Store original (uncollapsed) geometry
            const originalGeo = group.geometry.clone();
            group.setAttribute('originalGeometry', JSON.stringify(originalGeo));

            // Ensure the group starts uncollapsed
            if (graph.isCellCollapsed(group)) {
                graph.foldCells(false, false, [group]);
            }

            // Listener for collapse/uncollapse
            const listener = function (sender, evt) {
                const cells = evt.getProperty('cells');
                cells.forEach(c => {
                    if (c === group) {
                        const geo = graph.getCellGeometry(c).clone();

                        if (graph.isCellCollapsed(c)) {
                            // Collapsed: fixed 200x100
                            geo.width = 200;
                            geo.height = 100;
                            graph.getModel().setGeometry(c, geo);
                        } else {
                            // Uncollapsed: restore original geometry
                            const origAttr = c.getAttribute('originalGeometry');
                            if (origAttr) {
                                const orig = JSON.parse(origAttr);
                                const restoredGeo = new mxGeometry(orig.x, orig.y, orig.width, orig.height);
                                graph.getModel().setGeometry(c, restoredGeo);
                            }
                        }
                    }
                });
            };

            graph.addListener(mxEvent.FOLD_CELLS, listener);

            // Select the group
            graph.setSelectionCell(group);

        } finally {
            graph.getModel().endUpdate();
        }

        graph.refresh();
        markDirty();
    }



    function groupAsCoupledModelOLD(graph) {
        let selectedCells = graph.getSelectionCells();

        // Keep only real mxCells that are vertices
        selectedCells = selectedCells.filter(
            c => c instanceof mxCell && graph.getModel().isVertex(c)
        );

        if (selectedCells.length < 1) {
            alert("Select at least two cells to group");
            return;
        }

        graph.getModel().beginUpdate();
        try {
            const border = 30;

            // Group the selected cells
            const group = graph.groupCells(null, border, selectedCells);

            // Style the group
            group.setStyle(
                'shape=rectangle;' +
                'fillColor=#FFFFFF;' +
                'strokeColor=#424242;' +
                'rounded=1;' +
                'verticalAlign=top;' +
                'align=center;' +
                'spacingTop=4;' +
                'whiteSpace=wrap;' +
                'overflow=fill;' +
                'fontSize=16;' +
                'fontColor=#000000;'
            );

            // Visible label for the group
            group.value = "Enter a name and id for this coupled model";

            // Attach DEVS metadata
            group.userObject = {
                elementType: 'coupledModel',
                model_name: 'defaultName',
                unique_id: 'defaultID',
                json: {
                    model: {
                        x: {},
                        y: {},
                        components: [],
                        eic: [],
                        eoc: [],
                        ic: []
                    },
                    include_sets: ["default_sets.json"],
                },
            };

            // Populate components as { model, id }
            selectedCells.forEach(child => {
                const childName = child.userObject?.model_name || 'unnamed';
                const childId = child.userObject?.unique_id || child.getId();

                group.userObject.json.model.components.push({
                    model: childName,
                    id: childId
                });
            });

            // Move the group on top of children
            const model = graph.getModel();
            const parent = model.getParent(group);
            if (parent) {
                const index = model.getChildCount(parent) - 1;
                model.add(parent, group, index);
            }

            // Store original (uncollapsed) geometry
            const originalGeo = group.geometry.clone();
            group.setAttribute('originalGeometry', JSON.stringify(originalGeo));

            // Ensure the group starts uncollapsed
            if (graph.isCellCollapsed(group)) {
                graph.foldCells(false, false, [group]);
            }

            // Listener for when the group is collapsed or uncollapsed
            const listener = function (sender, evt) {
                const cells = evt.getProperty('cells');
                cells.forEach(c => {
                    if (c === group) {
                        const geo = graph.getCellGeometry(c).clone();

                        if (graph.isCellCollapsed(c)) {
                            // Collapsed: fixed 200x100
                            geo.width = 200;
                            geo.height = 100;
                            graph.getModel().setGeometry(c, geo);
                        } else {
                            // Uncollapsed: restore original geometry
                            const origAttr = c.getAttribute('originalGeometry');
                            if (origAttr) {
                                const orig = JSON.parse(origAttr);
                                const restoredGeo = new mxGeometry(orig.x, orig.y, orig.width, orig.height);
                                graph.getModel().setGeometry(c, restoredGeo);
                            }
                        }
                    }
                });
            };

            graph.addListener(mxEvent.FOLD_CELLS, listener);

            // Select the group
            graph.setSelectionCell(group);

        } finally {
            graph.getModel().endUpdate();
        }

        graph.refresh();
        markDirty();
    }




    function ungroupCells() {
        if (!graph || !graph.getSelectionCells) return;

        const cells = graph.getSelectionCells();
        if (!cells || cells.length === 0) {
            alert("Select a group to ungroup.");
            return;
        }

        graph.getModel().beginUpdate();
        try {
            graph.ungroupCells(cells);
        } finally {
            graph.getModel().endUpdate();
        }

        graph.refresh();
        markDirty();
    }

    function openAddDatatypeDialog() {

        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.inset = "0";
        overlay.style.background = "rgba(0,0,0,0.35)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "9999";

        const box = document.createElement("div");
        box.style.background = "white";
        box.style.padding = "20px";
        box.style.borderRadius = "8px";
        box.style.width = "550px";

        box.innerHTML = `
            <h3>Create Datatype</h3>

            <label>Datatype Name</label><br>
            <input id="datatypeNameInput"
                type="text"
                style="width:100%;margin-bottom:12px;"
                placeholder="name"><br>

            <div id="datatypeFields"></div>

            <button id="addFieldBtn">Add Field</button>
            <hr>

            <button id="saveDatatypeBtn">Save Datatype</button>
            <button id="cancelDatatypeBtn">Cancel</button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const fieldsDiv = box.querySelector("#datatypeFields");

        function addFieldRow() {

            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "5px";
            row.style.marginBottom = "6px";

            const kindSelect = document.createElement("select");

            ["member", "container"].forEach(k => {
                const opt = document.createElement("option");
                opt.value = k;
                opt.textContent = k;
                kindSelect.appendChild(opt);
            });

            const nameInput = document.createElement("input");
            nameInput.placeholder = "field name";
            nameInput.style.flex = "1";

            const typeSelect = document.createElement("select");

            getAvailableTypes().forEach(type => {
                const opt = document.createElement("option");
                opt.value = type;
                opt.textContent = type;
                typeSelect.appendChild(opt);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "-";
            deleteBtn.onclick = () => row.remove();

            function updateRow() {

                if (kindSelect.value === "container") {
                    nameInput.value = "container";
                    nameInput.disabled = true;
                } else {
                    if (nameInput.value === "container") {
                        nameInput.value = "";
                    }
                    nameInput.disabled = false;
                }
            }

            kindSelect.onchange = updateRow;
            updateRow();

            row.appendChild(kindSelect);
            row.appendChild(nameInput);
            row.appendChild(typeSelect);
            row.appendChild(deleteBtn);

            fieldsDiv.appendChild(row);
        }

        addFieldRow();
        addFieldRow();
        addFieldRow();

        box.querySelector("#addFieldBtn").onclick = addFieldRow;

        box.querySelector("#cancelDatatypeBtn").onclick = () => {
            document.body.removeChild(overlay);
        };

        box.querySelector("#saveDatatypeBtn").onclick = () => {

            const datatypeName =
                box.querySelector("#datatypeNameInput").value.trim();

            if (!datatypeName) {
                alert("Datatype name required.");
                return;
            }

            const fields = [];

            [...fieldsDiv.children].forEach(row => {

                const kind = row.children[0].value;
                const name = row.children[1].value.trim();
                const type = row.children[2].value;

                if (!name) return;

                if (kind === "member") {

                    fields.push({
                        kind: "member",
                        name,
                        type
                    });

                } else {

                    fields.push({
                        kind: "container",
                        containerType: "vector",
                        elementType: type
                    });

                }
            });

            window.customDataTypes.push({
                name: datatypeName,
                fields
            });

            console.log("Datatype added:",
                window.customDataTypes[
                    window.customDataTypes.length - 1
                ]);

            document.body.removeChild(overlay);

            populateRightPalette();
            markDirty();
        };
    }
    function getSelectedCellUserObject() {
        const selected = graph.getSelectionCells();

        if (selected.length === 0) {
            alert('Please select a cell.');
            return null;
        }

        if (selected.length > 1) {
            alert('Please select only one cell.');
            return null;
        }

        // Full structured object is now in userObject
        const userObject = selected[0].userObject;
        console.log(userObject);
        return userObject || null;
    }


    function moveCells(x, y) {
        const MOVE_INCREMENT = 10; // pixels per move
        const cells = graph.getSelectionCells();

        if (cells.length > 0) {
            graph.getModel().beginUpdate();
            try {
                cells.forEach(cell => {
                    // Geometry object for a cell contains:  x, y, height, width
                    const geometry = graph.getCellGeometry(cell);
                    if (geometry != null) {
                        // Erratic behaviour occurs if we don't use a new geometry object
                        const newGeometry = geometry.clone();
                        newGeometry.x += x * MOVE_INCREMENT;
                        newGeometry.y += y * MOVE_INCREMENT;
                        graph.getModel().setGeometry(cell, newGeometry);
                    }
                });
            } finally {
                graph.getModel().endUpdate();
            }
        }
    }

    function rebuildCoupledComponentsFromChildren(coupledCell) {
    if (!coupledCell || !coupledCell.userObject || !coupledCell.userObject.json?.model) return;

    const children = (graph.model.getChildCells(coupledCell) || []).filter(c =>
        c &&
        c.userObject &&
        (
            c.userObject.elementType === "atomicModel" ||
            c.userObject.elementType === "coupledModel"
        ) &&
        c.userObject.unique_id
    );

    const components = children
        .filter(c =>
            c &&
            c.userObject &&
            (c.userObject.elementType === "atomicModel" || c.userObject.elementType === "coupledModel")
        )
        .map(c => {
            const childObj = c.userObject;

            console.log("Rebuilding component from child:", childObj);

            return {
                model: childObj.model_name || "",
                component_id: childObj.unique_id || ""
            };
        });

    coupledCell.userObject.json.model.components = components;
}

    function syncParentCoupledComponentMetadata(cell) {
    if (!cell) return;

    const parent = graph.getModel().getParent(cell);
    if (!parent || !parent.userObject) return;

    if (parent.userObject.elementType !== "coupledModel") return;

    rebuildCoupledComponentsFromChildren(parent);
}


    function renderModelAndUniqueID(cell) {

        const headerEl = document.getElementById("modelNameIDHeader");
        const container = document.getElementById("modelNameIDContent");

        // Ensure userObject exists
        cell.userObject = cell.userObject || {};
        if (!cell.userObject.model_name) cell.userObject.model_name = "";
        if (!cell.userObject.unique_id) cell.userObject.unique_id = "";

        const userObj = cell.userObject;

        headerEl.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.classList.add("property-section");

        // Unique ID
        const idLabel = document.createElement("label");
        idLabel.textContent = "Unique ID:";
        const idInput = document.createElement("input");
        idInput.type = "text";
        idInput.value = userObj.unique_id;
        idInput.classList.add("property-input");

        // Model Name
        const modelLabel = document.createElement("label");
        modelLabel.textContent = "Model Name:";
        const modelInput = document.createElement("input");
        modelInput.type = "text";
        modelInput.value = userObj.model_name;
        modelInput.classList.add("property-input");

        wrapper.appendChild(idLabel);
        wrapper.appendChild(idInput);
        wrapper.appendChild(modelLabel);
        wrapper.appendChild(modelInput);
        container.appendChild(wrapper);

        // Update events
        idInput.addEventListener("input", () => {
            userObj.unique_id = idInput.value.trim();
            syncParentCoupledComponentMetadata(cell);
            updateLabel();
        });

        modelInput.addEventListener("input", () => {
            userObj.model_name = modelInput.value.trim();
            syncParentCoupledComponentMetadata(cell);
            updateLabel();
        });

        function updateLabel() {
            const id = userObj.unique_id || "";
            const model = userObj.model_name || "";
            graph.getModel().beginUpdate();
            try {
                cell.value = `${id} : ${model}`;
                graph.refresh(cell);
            } finally {
                graph.getModel().endUpdate();
            }
        }
    }


    function renderPorts(cell) {
        // Get all relevant DOM elements
        const inputHeader = document.getElementById('inputPortsHeader');
        const inputContent = document.getElementById('inputPortsContent');
        const outputHeader = document.getElementById('outputPortsHeader');
        const outputContent = document.getElementById('outputPortsContent');
        const addHeader = document.getElementById('addNewPortHeader');
        const addContent = document.getElementById('addNewPortContent');

        // --- Hide everything by default ---
        [inputHeader, inputContent, outputHeader, outputContent, addHeader, addContent]
            .forEach(el => el?.classList.add('hidden'));

        if (!cell || !cell.userObject) return; // nothing selected

        const model = cell.userObject.json?.model;
        if (!model) return;

        // --- Helper to render ports (with placeholder support) ---
        const renderPortList = (ports, contentEl) => {
            contentEl.innerHTML = '';

            const entries = Object.entries(ports || {});
            if (entries.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.textContent = '(no ports)';
                contentEl.appendChild(placeholder);
                return;
            }

            entries.forEach(([name, type]) => {
                const portDiv = document.createElement('div');

                const label = document.createElement('span');
                label.textContent = `${name}<${type}>`;

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '-';
                deleteBtn.addEventListener('click', () => {
                    delete ports[name];
                    renderPorts(cell);
                    renderAddCouplingUI(cell);
                    markDirty();
                });

                portDiv.appendChild(label);
                portDiv.appendChild(deleteBtn);
                contentEl.appendChild(portDiv);
            });
        };

        // --- ALWAYS SHOW Input Ports section ---
        inputHeader.classList.remove('hidden');
        inputContent.classList.remove('hidden');
        renderPortList(model.x || {}, inputContent);

        // --- ALWAYS SHOW Output Ports section ---
        outputHeader.classList.remove('hidden');
        outputContent.classList.remove('hidden');
        renderPortList(model.y || {}, outputContent);

        // --- Render Add New Port Section ---
        addHeader.classList.remove('hidden');
        addContent.classList.remove('hidden');
        addContent.innerHTML = '';

        // Line 1: Port type & data type dropdowns
        const line1 = document.createElement('div');

        const portTypeSelect = document.createElement('select');
        ['input', 'output'].forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            portTypeSelect.appendChild(option);
        });

        const dataTypeSelect = document.createElement('select');

        getAvailableTypes().forEach(dt => {
            const option = document.createElement('option');
            option.value = dt;
            option.textContent = dt;
            dataTypeSelect.appendChild(option);
        });

        line1.appendChild(portTypeSelect);
        line1.appendChild(dataTypeSelect);

        // Line 2: Port name input
        const portNameInput = document.createElement('input');
        portNameInput.type = 'text';
        portNameInput.placeholder = 'Port Name';

        // Line 3: Add button
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add Port';
        addBtn.addEventListener('click', () => {
            const type = portTypeSelect.value;
            const name = portNameInput.value.trim();
            const dataType = dataTypeSelect.value;

            if (!name) return alert('Port name is required');

            if (type === 'input') {
                if (!model.x) model.x = {};
                model.x[name] = dataType;
            } else {
                if (!model.y) model.y = {};
                model.y[name] = dataType;
            }

            portNameInput.value = '';
            renderPorts(cell);
            renderAddCouplingUI(cell);
            markDirty();
        });

        addContent.appendChild(line1);
        addContent.appendChild(portNameInput);
        addContent.appendChild(addBtn);
    }


    function renderStateVariables(cell) {
        if (!cell || !cell.userObject || !cell.userObject.json?.model?.s) return;

        const container = document.getElementById("propertiesContent");
        const header = document.getElementById("propertiesHeader");

        header.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const stateVars = cell.userObject.json.model.s;

        Object.entries(stateVars).forEach(([varName, varObj]) => {
            let { data_type, init_state } = varObj;

            const row = document.createElement("div");
            row.classList.add("property-item");

            // --- Top row: Name + DataType + Delete Button ---
            const topRow = document.createElement("div");
            topRow.style.display = "flex";
            topRow.style.gap = "8px";
            topRow.style.alignItems = "center";

            // Variable Name Input
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = varName;
            nameInput.placeholder = "Variable Name";
            nameInput.style.flex = "1";

            nameInput.addEventListener("input", () => {
                const newName = nameInput.value.trim();
                if (!newName || newName === varName || stateVars[newName]) return;

                // Rename key in s
                stateVars[newName] = varObj;
                delete stateVars[varName];

                console.log(`Renamed variable ${varName} -> ${newName}`);
                varName = newName;
                markDirty();
            });

            // DataType Dropdown
            const typeSelect = document.createElement("select");

            getAvailableTypes().forEach(type => {
                const option = document.createElement("option");
                option.value = type;
                option.textContent = type;
                typeSelect.appendChild(option);
            });

            typeSelect.value = data_type;

            typeSelect.addEventListener("change", () => {
                data_type = typeSelect.value;
                varObj.data_type = data_type;

                // Reset init_state for new type
                if (data_type === "bool") {
                    varObj.init_state = false;
                } else if (data_type === "double") {
                    varObj.init_state = 0.0;
                } else if (data_type === "int") {
                    varObj.init_state = 0;
                } else if (data_type === "char") {
                    varObj.init_state = "";
                } else if (data_type === "string") {
                    varObj.init_state = "";
                } else {
                    // custom struct or container type
                    varObj.init_state = "";
                }

                renderValueInput();
                markDirty();
            });

            // Delete Button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "-";
            deleteBtn.title = "Delete this variable";
            deleteBtn.style.marginLeft = "4px";
            deleteBtn.addEventListener("click", () => {
                delete stateVars[varName];
                console.log(`Deleted variable ${varName}`);
                renderStateVariables(cell); // Re-render the panel
                markDirty();
            });

            topRow.appendChild(nameInput);
            topRow.appendChild(typeSelect);
            topRow.appendChild(deleteBtn);
            row.appendChild(topRow);

            // --- Bottom row: init_state ---
            let valueInput;

            function renderValueInput() {
                if (valueInput) row.removeChild(valueInput);

                valueInput = document.createElement("div");
                valueInput.style.marginTop = "4px";

                let inputElem;

                if (data_type === "int" || data_type === "double") {
                    inputElem = document.createElement("input");
                    inputElem.type = "number";

                    const isSigma = varName === "sigma" && data_type === "double";
                    const isInf = varObj.init_state === "inf";

                    // Initialize numeric value
                    if (isInf) {
                        inputElem.value = 0;
                    } else {
                        inputElem.value = parseFloat(varObj.init_state) || 0;
                        varObj._last_numeric_value = inputElem.value;
                    }

                    inputElem.disabled = isInf;

                    inputElem.addEventListener("input", () => {
                        let newValue = data_type === "int"
                            ? parseInt(inputElem.value) || 0
                            : parseFloat(inputElem.value) || 0.0;

                        varObj._last_numeric_value = newValue;
                        varObj.init_state = newValue;

                        console.log(`Updated ${varName} ->`, newValue);
                        markDirty();
                    });

                    // --- Wrap number input and checkbox in a row ---
                    const inputRow = document.createElement("div");
                    inputRow.appendChild(inputElem);

                    // Sigma checkbox
                    if (isSigma) {
                        const infCheckbox = document.createElement("input");
                        infCheckbox.type = "checkbox";
                        infCheckbox.checked = isInf;

                        infCheckbox.addEventListener("change", () => {
                            if (infCheckbox.checked) {
                                varObj.init_state = "inf"; // update the user object
                                inputElem.disabled = true;
                            } else {
                                const restored = (varObj._last_numeric_value ?? parseFloat(inputElem.value)) || 0;
                                varObj.init_state = restored;
                                inputElem.disabled = false;
                            }
                            console.log(`Sigma set to`, varObj.init_state);
                            markDirty();
                        });



                        inputRow.appendChild(infCheckbox);
                        inputRow.appendChild(document.createTextNode("inf"));
                    }

                    valueInput.appendChild(inputRow);
                } else if (data_type === "bool") {
                    inputElem = document.createElement("select");
                    ["true", "false"].forEach(v => {
                        const option = document.createElement("option");
                        option.value = v;
                        option.textContent = v;
                        inputElem.appendChild(option);
                    });
                    inputElem.value = String(varObj.init_state).toLowerCase() === "true" ? "true" : "false";

                    inputElem.addEventListener("input", () => {
                        varObj.init_state = inputElem.value === "true";
                        console.log(`Updated ${varName} ->`, varObj.init_state);
                        markDirty();
                    });

                    valueInput.appendChild(inputElem);
                } else { // string or custom
                    inputElem = document.createElement("input");
                    inputElem.type = "text";
                    inputElem.value = varObj.init_state || "";

                    inputElem.addEventListener("input", () => {
                        varObj.init_state = inputElem.value;
                        console.log(`Updated ${varName} ->`, varObj.init_state);
                        markDirty();
                    });

                    valueInput.appendChild(inputElem);
                }

                row.appendChild(valueInput);
            }


            renderValueInput();
            container.appendChild(row);
        });

        // --- Add State Variable Button ---
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add State Variable";
        addBtn.style.marginTop = "10px";
        addBtn.addEventListener("click", () => {
            // Generate a unique name
            let newVarName = "newVar";
            let counter = 1;
            while (stateVars[newVarName]) {
                newVarName = `newVar${counter++}`;
            }

            stateVars[newVarName] = { data_type: "double", init_state: 0 };
            renderStateVariables(cell);
            markDirty();
        });

        container.appendChild(addBtn);
    }


    function renderDeltaInt(cell) {
        if (!cell || !cell.userObject || !cell.userObject.json?.model) return;

        const headerEl = document.getElementById("deltaIntHeader");
        const container = document.getElementById("deltaIntContent");
        if (!headerEl || !container) return;

        headerEl.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const deltaInt = cell.userObject.json.model.delta_int || {};

        // Separate "otherwise" from other conditions
        const otherwiseUpdates = deltaInt["otherwise"];
        const otherEntries = Object.entries(deltaInt).filter(([key]) => key !== "otherwise");

        // Render other conditions first
        otherEntries.forEach(([condition, updates]) => renderCondition(condition, updates, deltaInt));

        // Render "otherwise" last
        if (otherwiseUpdates) renderCondition("otherwise", otherwiseUpdates, deltaInt, true);

        // Add new condition button
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add New delta_int Condition";
        addBtn.addEventListener("click", () => {
            let newCond = "new_condition";
            let counter = 1;
            while (deltaInt[newCond]) newCond = `new_condition_${counter++}`;
            deltaInt[newCond] = {};
            renderDeltaInt(cell);
            markDirty();
        });
        container.appendChild(addBtn);

        // --- Helper function ---
        function renderCondition(condition, updates, deltaIntObj, isOtherwise = false) {
            const wrapper = document.createElement("div");

            // Condition input
            const condInput = document.createElement("input");
            condInput.type = "text";
            condInput.value = condition;
            condInput.style.width = "80%";
            if (isOtherwise) condInput.disabled = true;

            condInput.addEventListener("input", () => {
                const newCond = condInput.value.trim();
                if (!newCond || newCond === condition) return;
                if (deltaIntObj[newCond]) return;

                deltaIntObj[newCond] = updates;
                delete deltaIntObj[condition];
                renderDeltaInt(cell);
                markDirty();
            });

            wrapper.appendChild(condInput);

            // Delete button (skip for otherwise)
            if (!isOtherwise) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "-";
                delBtn.title = "Delete this condition";
                delBtn.addEventListener("click", () => {
                    delete deltaIntObj[condition];
                    renderDeltaInt(cell);
                    markDirty();
                });
                wrapper.appendChild(delBtn);
            }

            // Textarea for updates (without outer braces and without leading whitespace)
            const textArea = document.createElement("textarea");

            textArea.value = typeof updates === "string" ? updates : "";

            textArea.rows = 3;
            textArea.style.width = "100%";

            textArea.addEventListener("input", () => {
                deltaIntObj[condInput.value] = textArea.value;
                markDirty();
            });

            wrapper.appendChild(textArea);
            container.appendChild(wrapper);
        }
    }


    function renderDeltaExt(cell) {
        if (!cell || !cell.userObject || !cell.userObject.json?.model) return;

        const headerEl = document.getElementById("deltaExtHeader");
        const container = document.getElementById("deltaExtContent");
        if (!headerEl || !container) return;

        headerEl.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const deltaExt = cell.userObject.json.model.delta_ext || {};

        // Separate "otherwise" from other conditions
        const otherwiseUpdates = deltaExt["otherwise"];
        const otherEntries = Object.entries(deltaExt).filter(([key]) => key !== "otherwise");

        // Render other conditions first
        otherEntries.forEach(([condition, updates]) =>
            renderCondition(condition, updates, deltaExt)
        );

        // Render "otherwise" last
        if (otherwiseUpdates) renderCondition("otherwise", otherwiseUpdates, deltaExt, true);

        // Add new condition button
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add New delta_ext Condition";
        addBtn.addEventListener("click", () => {
            let newCond = "new_condition";
            let counter = 1;
            while (deltaExt[newCond]) newCond = `new_condition_${counter++}`;
            deltaExt[newCond] = {};
            renderDeltaExt(cell);
            markDirty();
        });
        container.appendChild(addBtn);

        // --- Helper function ---
        function renderCondition(condition, updates, deltaExtObj, isOtherwise = false) {
            const wrapper = document.createElement("div");

            // Condition input
            const condInput = document.createElement("input");
            condInput.type = "text";
            condInput.value = condition;
            condInput.style.width = "80%";
            if (isOtherwise) condInput.disabled = true;

            condInput.addEventListener("input", () => {
                const newCond = condInput.value.trim();
                if (!newCond || newCond === condition) return;
                if (deltaExtObj[newCond]) return;

                deltaExtObj[newCond] = updates;
                delete deltaExtObj[condition];
                renderDeltaExt(cell);
                markDirty();
            });

            wrapper.appendChild(condInput);

            // Delete button (skip for otherwise)
            if (!isOtherwise) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "-";
                delBtn.title = "Delete this condition";
                delBtn.addEventListener("click", () => {
                    delete deltaExtObj[condition];
                    renderDeltaExt(cell);
                    markDirty();
                });
                wrapper.appendChild(delBtn);
            }

            // Textarea for updates (without outer braces and without leading whitespace)
            const textArea = document.createElement("textarea");

            textArea.value = typeof updates === "string" ? updates : "";

            textArea.rows = 3;
            textArea.style.width = "100%";

            textArea.addEventListener("input", () => {
                deltaExtObj[condInput.value] = textArea.value;
                markDirty();
                    });

            wrapper.appendChild(textArea);
            container.appendChild(wrapper);
        }
    }


    function renderOutputFunction(cell) {
        if (!cell || !cell.userObject || !cell.userObject.json?.model) return;

        const headerEl = document.getElementById("outputFunctionHeader");
        const container = document.getElementById("outputFunctionContent");
        if (!headerEl || !container) return;

        headerEl.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const lambda = cell.userObject.json.model.lambda || {};

        // Separate "otherwise" from other conditions
        const otherwiseUpdates = lambda["otherwise"];
        const otherEntries = Object.entries(lambda).filter(([key]) => key !== "otherwise");

        // Render other conditions first
        otherEntries.forEach(([condition, updates]) =>
            renderCondition(condition, updates, lambda)
        );

        // Render "otherwise" last
        if (otherwiseUpdates) renderCondition("otherwise", otherwiseUpdates, lambda, true);

        // Add new condition button
        const addBtn = document.createElement("button");
        addBtn.textContent = "Add New Output Function Condition";
        addBtn.addEventListener("click", () => {
            let newCond = "new_condition";
            let counter = 1;
            while (lambda[newCond]) newCond = `new_condition_${counter++}`;
            lambda[newCond] = {};
            renderOutputFunction(cell);
            markDirty();
        });
        container.appendChild(addBtn);

        // --- Helper function ---
        function renderCondition(condition, updates, lambdaObj, isOtherwise = false) {
            const wrapper = document.createElement("div");

            // Condition input
            const condInput = document.createElement("input");
            condInput.type = "text";
            condInput.value = condition;
            condInput.style.width = "80%";
            if (isOtherwise) condInput.disabled = true;

            condInput.addEventListener("input", () => {
                const newCond = condInput.value.trim();
                if (!newCond || newCond === condition) return;
                if (lambdaObj[newCond]) return;

                lambdaObj[newCond] = updates;
                delete lambdaObj[condition];
                renderOutputFunction(cell);
                markDirty();
            });

            wrapper.appendChild(condInput);

            // Delete button (skip for otherwise)
            if (!isOtherwise) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "-";
                delBtn.title = "Delete this condition";
                delBtn.addEventListener("click", () => {
                    delete lambdaObj[condition];
                    renderOutputFunction(cell);
                    markDirty();
                });
                wrapper.appendChild(delBtn);
            }

            // Textarea for updates (without outer braces and without leading whitespace)
            const textArea = document.createElement("textarea");

            textArea.value = typeof updates === "string" ? updates : "";

            textArea.rows = 3;
            textArea.style.width = "100%";

            textArea.addEventListener("input", () => {
                lambdaObj[condInput.value] = textArea.value;
                markDirty();
            });
            wrapper.appendChild(textArea);
            container.appendChild(wrapper);
        }
    }


    function renderTimeAdvanceFunction(cell) {
        if (!cell || !cell.userObject || !cell.userObject.json?.model) return;

        const headerEl = document.getElementById("timeAdvanceFunctionHeader");
        const container = document.getElementById("timeAdvanceFunctionContent");
        if (!headerEl || !container) return;

        headerEl.classList.remove("hidden");
        container.classList.remove("hidden");
        container.innerHTML = "";

        const model = cell.userObject.json.model;

        if (!model.ta || typeof model.ta !== "object") {
            model.ta = { otherwise: "sigma" };
        }

        // keep ONLY otherwise
        const currentOtherwise = model.ta.otherwise;
        model.ta = {
            otherwise:
                typeof currentOtherwise === "string" && currentOtherwise.trim() !== ""
                    ? currentOtherwise.replace(/^"(.*)"$/, "$1")
                    : "sigma"
        };

        const wrapper = document.createElement("div");

        const condInput = document.createElement("input");
        condInput.type = "text";
        condInput.value = "otherwise";
        condInput.disabled = true;
        condInput.style.width = "80%";

        const textArea = document.createElement("textarea");
        textArea.value = model.ta.otherwise;
        textArea.rows = 2;
        textArea.style.width = "100%";

        textArea.addEventListener("input", () => {
            model.ta.otherwise = textArea.value.trim().replace(/^"(.*)"$/, "$1");
            markDirty();
        });

        wrapper.appendChild(condInput);
        wrapper.appendChild(textArea);
        container.appendChild(wrapper);
    }

    function renderCouplings(parentCell) {
        if (!parentCell) return;

        const model = parentCell.userObject?.json?.model;
        if (!model) return;

        const renderCouplingSection = (couplings, headerId, contentId) => {
            const header = document.getElementById(headerId);
            const content = document.getElementById(contentId);

            header.classList.remove('hidden');
            content.classList.remove('hidden');
            content.innerHTML = '';

            if (couplings && couplings.length > 0) {
                couplings.forEach((c, idx) => {
                    const div = document.createElement('div');

                    const label = document.createElement('span');
                    label.textContent = `${c.component_from ?? parentCell.userObject.unique_id
                        } : ${c.port_from ?? parentCell.userObject.unique_id} → ${c.component_to ?? parentCell.userObject.unique_id
                        } : ${c.port_to ?? parentCell.userObject.unique_id}`;
                    div.appendChild(label);

                    // Remove button
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = '-';
                    removeBtn.style.marginLeft = '8px';
                    removeBtn.addEventListener('click', () => {
                        couplings.splice(idx, 1); // remove coupling from the model
                        renderCouplings(parentCell);
                        markDirty();
                    });
                    div.appendChild(removeBtn);

                    content.appendChild(div);
                });
            } else {
                const placeholder = document.createElement('div');
                placeholder.textContent = "(no couplings)";
                content.appendChild(placeholder);
            }
        };

        // Render the three coupling sections
        renderCouplingSection(model.eic, 'externalInputCouplingsHeader', 'externalInputCouplingsContent');
        renderCouplingSection(model.eoc, 'externalOutputCouplingsHeader', 'externalOutputCouplingsContent');
        renderCouplingSection(model.ic, 'internalCouplingsHeader', 'internalCouplingsContent');
    }


    function renderAddCouplingUI(cell) { // TODO alert box when the data types don't match
        const addCouplingSection = document.getElementById("addCouplingSection");
        addCouplingSection.classList.remove("hidden");

        const typeSelect = document.getElementById("couplingType");
        const compFrom = document.getElementById("componentFrom");
        const portFrom = document.getElementById("portFrom");
        const compTo = document.getElementById("componentTo");
        const portTo = document.getElementById("portTo");

        const children = graph.model.getChildCells(cell) || [];

        // --- Update typeSelect options ---
        typeSelect.innerHTML = ''; // clear existing
        const typeOptions = [
            { value: 'EIC', text: 'EIC - External Input Coupling' },
            { value: 'EOC', text: 'EOC - External Output Coupling' },
            { value: 'IC', text: 'IC - Internal Coupling' }
        ];
        typeOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            typeSelect.appendChild(option);
        });

        // Helper: get cell object by unique_id
        function getCellById(id) {
            if (id === cell.userObject?.unique_id) return cell;
            return children.find(c => c.userObject?.unique_id === id);
        }       

        // Populate componentFrom and componentTo
        function populateComponents() {
            const type = typeSelect.value;
            compFrom.innerHTML = '';
            compTo.innerHTML = '';

            if (type === "EIC") {
                addOptions(compFrom, [cell.userObject.unique_id]);
                addOptions(compTo, children.map(c => c.userObject?.unique_id).filter(Boolean));
            } else if (type === "IC") {
                addOptions(compFrom, children.map(c => c.userObject?.unique_id).filter(Boolean));
                addOptions(compTo, children.map(c => c.userObject?.unique_id).filter(Boolean));
            } else if (type === "EOC") {
                addOptions(compFrom, children.map(c => c.userObject.unique_id));
                addOptions(compTo, [cell.userObject.unique_id]);
            }
        }

        // Populate ports based on selected components
        function populatePorts() {
            const fromCell = getCellById(compFrom.value);
            const toCell = getCellById(compTo.value);

            const fromPorts = fromCell ? (typeSelect.value === "EIC" ? fromCell.getInputPorts() : fromCell.getOutputPorts()) : [];
            const toPorts = toCell ? (typeSelect.value === "EOC" ? toCell.getOutputPorts() : toCell.getInputPorts()) : [];

            addOptions(portFrom, fromPorts.map(p => `${p.name}<${p.type}>`));
            addOptions(portTo, toPorts.map(p => `${p.name}<${p.type}>`));
        }

        function populateAll() {
            populateComponents();
            populatePorts();
        }

        typeSelect.onchange = populateAll;
        compFrom.onchange = populatePorts;
        compTo.onchange = populatePorts;

        populateAll();

        document.getElementById("addCouplingBtn").onclick = () => {

            const coupling = {
                type: typeSelect.value,
                componentFrom: compFrom.value,
                portFrom: portFrom.value.split('<')[0],
                componentTo: compTo.value,
                portTo: portTo.value.split('<')[0]
            };
            //console.log("Adding coupling:", coupling);
            addCouplingToModel(cell, coupling); // Save to model
            renderCouplings(cell);
        };
    }


    function addOptions(selectEl, items) {
        if (!Array.isArray(items)) items = []; // ensure array
        selectEl.innerHTML = ''; // clear previous options

        items.forEach(i => {
            const opt = document.createElement("option");

            // If i is an object with name/type, format as name<type>
            if (i && typeof i === 'object' && i.name && i.type) {
                opt.value = i.name;
                opt.textContent = `${i.name}<${i.type}>`;
            } else {
                opt.value = i;
                opt.textContent = i;
            }

            selectEl.appendChild(opt);
        });
    }


    function flatten(arr) {
        if (!arr) return [];
        return [].concat(...arr);
    }


    function addCouplingToModel(parentCell, coupling) {
        if (!parentCell || !coupling) return;

        const model = parentCell.userObject?.json?.model;
        if (!model) return;

        switch (coupling.type) {
            case 'EIC':
                if (!model.eic) model.eic = [];
                model.eic.push({
                    port_from: coupling.portFrom,
                    port_to: coupling.portTo,
                    component_to: coupling.componentTo
                });
                break;

            case 'EOC':
                if (!model.eoc) model.eoc = [];
                model.eoc.push({
                    port_from: coupling.portFrom,
                    port_to: coupling.portTo,
                    component_from: coupling.componentFrom,
                });
                break;

            case 'IC':
                if (!model.ic) model.ic = [];
                model.ic.push({
                    port_from: coupling.portFrom,
                    port_to: coupling.portTo,
                    component_from: coupling.componentFrom,
                    component_to: coupling.componentTo,
                });
                break;

            default:
                console.warn("Unknown coupling type:", coupling.type);
        }

        markDirty();
    }


    /////////////////////////////////////////////////////////////////////////////
    ///////// MenuBar and Footer Setup
    /////////////////////////////////////////////////////////////////////////////

    const conversionManager = new ConversionManager(graph);
    window.autosaveGraphNow = () => {
        autosaveGraph(conversionManager);
        saveUiStateForCurrentCategory(graph);
    };

    const CONFIRM_NEW_GRAPH_MESSAGE = "Are you sure you would like to start a new graph? This will delete the current graph.";

    const bindButton = (id, handler) => {
        const el = document.getElementById(id);
        if (!el) {
            console.warn(`Button #${id} not found`);
            return;
        }
        el.addEventListener('click', handler);
    };

    bindButton('newBtn', () => deleteAllCells(graph, CONFIRM_NEW_GRAPH_MESSAGE));
    bindButton('loadBtn', () => conversionManager.loadGraphXML());
    bindButton('saveBtn', () => conversionManager.saveGraphXML());

    bindButton('screenshotPngBtn', () => exportGraphImage(graph, "png"));
    bindButton('screenshotJpgBtn', () => exportGraphImage(graph, "jpg"));

    bindButton("viewTraceBtn", () => conversionManager.viewTrace?.());

    bindButton("previewGraphXMLBtn", () => conversionManager.previewGraphXML?.());
    bindButton("previewUserObjectsBtn", () => conversionManager.previewUserObjects?.());
    bindButton("previewDEVSMapBtn", () => conversionManager.previewDEVSMap());

    const getSimulationTime = () => {
        const timeInput =
            document.getElementById("simulationTimeInput") ||
            document.getElementById("experimentSimulationTimeInput") ||
            document.querySelector("input[name='simulationTime']") ||
            document.querySelector("input[data-role='simulation-time']");

        if (!timeInput || timeInput.value === "") return undefined;

        const simulationTime = Number(timeInput.value);
        return Number.isFinite(simulationTime) ? simulationTime : undefined;
    };

    const buildCadmiumCode = async () => {
        // Prefer true build/write methods if conversions.js provides them.
        // Fall back to previewCadmiumCode because this is the method that exists in the current/old main wiring.
        // In this project, previewCadmiumCode is the Cadmium-code generation entry point; the button label is what changed.
        if (typeof conversionManager.buildCadmiumCode === "function") {
            await conversionManager.buildCadmiumCode(graph);
        } else if (typeof conversionManager.writeCadmiumCode === "function") {
            await conversionManager.writeCadmiumCode(graph);
        } else if (typeof conversionManager.generateCadmiumCode === "function") {
            await conversionManager.generateCadmiumCode(graph);
        } else if (typeof conversionManager.createCadmiumCode === "function") {
            await conversionManager.createCadmiumCode(graph);
        } else if (typeof conversionManager.previewCadmiumCode === "function") {
            await conversionManager.previewCadmiumCode();
        } else if (typeof window.buildCadmiumCode === "function") {
            await window.buildCadmiumCode({ graph, conversionManager });
        } else if (typeof window.previewCadmiumCode === "function") {
            await window.previewCadmiumCode({ graph, conversionManager });
        } else {
            console.warn("No Cadmium code generation function found on ConversionManager or window", conversionManager);
            alert("Cadmium Code is present, but no Cadmium code generation function was found.");
        }
    };

    const runCadmiumSimulation = async () => {
        const simulationTime = getSimulationTime();

        // Prefer true run methods if conversions.js provides them.
        // Fall back to previewSimulationOutput because this is the existing simulation-output entry point.
        if (typeof conversionManager.runSimulation === "function") {
            await conversionManager.runSimulation(simulationTime, graph);
        } else if (typeof conversionManager.runCadmiumSimulation === "function") {
            await conversionManager.runCadmiumSimulation(simulationTime, graph);
        } else if (typeof conversionManager.simulateCadmium === "function") {
            await conversionManager.simulateCadmium(simulationTime, graph);
        } else if (typeof conversionManager.previewSimulationOutput === "function") {
            await conversionManager.previewSimulationOutput(simulationTime);
        } else if (typeof window.runSimulation === "function") {
            await window.runSimulation({ graph, conversionManager, simulationTime });
        } else if (typeof window.previewSimulationOutput === "function") {
            await window.previewSimulationOutput({ graph, conversionManager, simulationTime });
        } else {
            console.warn("No simulation runner function found on ConversionManager or window", conversionManager);
            alert("Run Simulation is present, but no simulation runner function was found.");
        }
    };

    bindButton("previewCodeBtn", buildCadmiumCode);
    bindButton("previewSimulationOutputBtn", runCadmiumSimulation);


    /////////////////////////////////////////////////////////////////////////////
    ///////// ToolBar Setup
    /////////////////////////////////////////////////////////////////////////////

    // mxToolbar Setup
    const toolbarContainer = document.getElementById('toolbar');
    const toolbar = new mxToolbar(toolbarContainer);

    toolbar.enabled = false; // no dragging items from toolbar

    // May add New/Save/Load once button text replaced with icons
    // toolbar.addItem('New', null, () => deleteAllCells(graph, CONFIRM_NEW_GRAPH_MESSAGE));
    // toolbar.addItem('Save', null, () => conversionManager.saveGraphXML());
    // toolbar.addItem('Load', null, () => conversionManager.loadGraphXML());
    toolbar.addItem('Copy', null, () => copySelectedCells(graph)); // Text label, icon, function
    toolbar.addItem('Cut', null, () => cutSelectedCells(graph));
    toolbar.addItem('Paste', null, () => pasteClipboardCells(graph));
    toolbar.addItem('Undo', null, () => undoAction(undoManager));
    toolbar.addItem('Redo', null, () => redoAction(undoManager));
    toolbar.addItem('Duplicate', null, () => duplicateSelectedCells(graph));
    toolbar.addItem('Select All', null, () => selectAllCells(graph));
    toolbar.addItem('Delete', null, () => deleteSelectedCells(graph));
    toolbar.addItem('Delete All', null, () => deleteAllCells(graph));
    //toolbar.addItem('Group', null, groupCells);
    
    // toolbar.addItem('Lock', null, () => alert("Not yet implemented")); // May/may not be implemented
    toolbar.addItem('Zoom In', null, () => graph.zoomIn());
    toolbar.addItem('Zoom Out', null, () => graph.zoomOut());
    toolbar.addItem('Reset Zoom', null, () => graph.zoomActual());
    toolbar.addItem('Zoom to Fit', null, () => graph.fit(25));
    toolbar.addItem('Couple Models', null, () => groupAsCoupledModel(graph));
    toolbar.addItem('Decouple', null, ungroupCells);
    toolbar.addItem('Add Datatype', null, openAddDatatypeDialog);



    /////////////////////////////////////////////////////////////////////////////
    ///////// Right-click Context Menu Setup
    /////////////////////////////////////////////////////////////////////////////

    // Setting up shortcuts
    // Allows user to focus on graph (required for keyHandler)
    mxEvent.disableContextMenu(container);

    graph.popupMenuHandler.factoryMethod = function (menu, cell, evt) {
        const rightClickCoords = graph.getPointForEvent(evt);

        if (cell) {

            if (graph.getModel().isVertex(cell)) {// TODO cleanup and comment these
                menu.addItem('Group', null, groupCells);
                menu.addItem('Cut', null, () => cutSelectedCells(graph));
                menu.addItem('Copy', null, () => copySelectedCells(graph));
                menu.addItem('Duplicate', null, () => duplicateSelectedCells(graph));
                menu.addItem('Delete', null, () => deleteSelectedCells(graph));
                menu.addItem('Save Model to Palette', null, () => saveModelToPalette(graph));
                if (cell.isAtomicModel()) {
                    menu.addItem('Log Atomic DEVSMap', null, () => console.log(conversionManager.createAtomicModelJSON(cell.userObject)));
                }
                if (cell.isCoupledModel()) {
                    menu.addItem('Log Coupled DEVSMap', null, () => console.log(conversionManager.createCoupledModelJSON(cell.userObject)));
                }
                
            }
            else if (graph.getModel().isEdge(cell)) {
                // Menu for edges
                menu.addItem('Delete', null, () => deleteSelectedCells(graph));
            }
        } else {
            // Menu for empty space
            menu.addItem('Paste', null, () => pasteClipboardCells(graph, rightClickCoords));
            menu.addItem('Select All', null, () => selectAllCells(graph));
            menu.addItem('Delete All', null, () => deleteAllCells(graph));
        }
    };


    // Resize functionality when the user changes the size/shape of the window
    window.addEventListener('resize', () => graph.sizeDidChange);

    // Initial resize after the application is loaded
    graph.sizeDidChange();

    // For now we populate a hello world, later can populate with traffic light
    helloWorld(graph);



    /////////////////////////////////////////////////////////////////////////////
    ///////// Drag and drop setup
    /////////////////////////////////////////////////////////////////////////////

    let lastDropX = null;
    let lastDropY = null;
    const DROP_OFFSET = 10; // pixels to offset each new drop

    // Handle dropping shapes from the palette
    graphContainer.addEventListener('dragover', e => e.preventDefault());

    graphContainer.addEventListener('drop', e => {
        e.preventDefault();
        const item = JSON.parse(e.dataTransfer.getData('shape'));
        const pt = graph.getPointForEvent(e);

        graph.getModel().beginUpdate();
        try {
            // Create a proper mxCell from the palette item definition
            const newCell = createMxCellFromItem(item);

            // Position cell centered at the drop point
            newCell.geometry.x = pt.x - (newCell.geometry.width / 2);
            newCell.geometry.y = pt.y - (newCell.geometry.height / 2);

            // Add to default parent
            graph.addCell(newCell, graph.getDefaultParent());

            // Optionally select the newly dropped cell
            graph.setSelectionCell(newCell);

            // Reset last drop stack because user manually positioned
            lastDropX = null;
            lastDropY = null;
        } finally {
            graph.getModel().endUpdate();
        }
    });




    /////////////////////////////////////////////////////////////////////////////
    ///////// Left palette setup
    /////////////////////////////////////////////////////////////////////////////

    const shapesDiv = document.getElementById('palette-shapes');
    // Scale factors
    const paletteScaleFactor = 0.75; // Preview in palette
    const graphScaleFactor = 1.0; // Actual graph shape size

    function createPaletteItem(itemData) {
        const item = document.createElement('div');
        item.className = 'palette-item';

        const canvasDiv = document.createElement('div');
        canvasDiv.className = 'palette-canvas';
        canvasDiv.style.width = itemData.width * paletteScaleFactor + 'px';
        canvasDiv.style.height = itemData.height * paletteScaleFactor + 'px';
        item.appendChild(canvasDiv);

        // Mini graph preview
        const miniGraph = new mxGraph(canvasDiv);
        miniGraph.setEnabled(false);
        miniGraph.container.style.background = 'none';
        miniGraph.container.style.border = 'none';
        miniGraph.view.scale = paletteScaleFactor;

        miniGraph.getModel().beginUpdate();
        try {
            let cell;
            if (itemData.style.shape === 'image') {
                // src comes from style, not userObject
                cell = new mxCell('', new mxGeometry(0, 0, itemData.width, itemData.height), `shape=image;image=${itemData.style.src}`);
            } else {
                cell = new mxCell(itemData.label, new mxGeometry(0, 0, itemData.width, itemData.height), styleObjectToString(itemData.style));
            }

            cell.vertex = true;

            // Label for display
            cell.value = itemData.label;

            // userObject to hold the JSON data
            cell.userObject = itemData.userObject;

            // For experimental frames only (temp implementation)
            cell.isExperimentalFrame = itemData.isExperimentalFrame;

            // centre in mini graph
            cell.geometry.x = (itemData.width * paletteScaleFactor - itemData.width * paletteScaleFactor) / 2 / paletteScaleFactor;
            cell.geometry.y = (itemData.height * paletteScaleFactor - itemData.height * paletteScaleFactor) / 2 / paletteScaleFactor;

            miniGraph.addCell(cell);
        } finally {
            miniGraph.getModel().endUpdate();
        }

        // Drag-and-drop logic (ghost div)
        canvasDiv.addEventListener('mousedown', e => {
            e.preventDefault();
            const ghost = canvasDiv.cloneNode(true);
            ghost.classList.add('drag-ghost');
            ghost.style.width = canvasDiv.style.width;
            ghost.style.height = canvasDiv.style.height;
            document.body.appendChild(ghost);

            const offsetX = canvasDiv.offsetWidth / 2;
            const offsetY = canvasDiv.offsetHeight / 2;

            function moveGhost(evt) {
                ghost.style.left = (evt.clientX - offsetX) + 'px';
                ghost.style.top = (evt.clientY - offsetY) + 'px';
            }
            moveGhost(e);

            function mouseMoveHandler(evt) { moveGhost(evt); }

            function mouseUpHandler(evt) {
                document.body.removeChild(ghost);
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);

                // Get graph container bounds
                const rect = graph.container.getBoundingClientRect();
                const isInsideGraph =
                    evt.clientX >= rect.left &&
                    evt.clientX <= rect.right &&
                    evt.clientY >= rect.top &&
                    evt.clientY <= rect.bottom;

                let pt;

                if (isInsideGraph) {
                    // Use mouse location for drops inside the graph
                    pt = graph.getPointForEvent(evt);
                    // Reset lastDropX/Y because the user manually positioned this one
                    lastDropX = null;
                    lastDropY = null;
                } else {
                    // Use center + offset for drops outside the graph
                    const container = graph.container;
                    const view = graph.getView();
                    const scale = view.scale;
                    const translate = view.translate;

                    pt = {
                        x: container.clientWidth / 2 / scale - translate.x,
                        y: container.clientHeight / 2 / scale - translate.y
                    };

                    // Apply stack offset if previous drop exists
                    if (lastDropX !== null && lastDropY !== null) {
                        pt.x = lastDropX + DROP_OFFSET;
                        pt.y = lastDropY + DROP_OFFSET;
                    }

                    // Save this as last drop position
                    lastDropX = pt.x;
                    lastDropY = pt.y;
                }

                // Create new cell at pt
                let newCell;
                if (itemData.style.shape === 'image') {
                    newCell = new mxCell('', new mxGeometry(0, 0, itemData.width * graphScaleFactor, itemData.height * graphScaleFactor), `shape=image;image=${itemData.style.src}`);
                } else {
                    newCell = new mxCell(itemData.label, new mxGeometry(0, 0, itemData.width * graphScaleFactor, itemData.height * graphScaleFactor), styleObjectToString(itemData.style));
                }
                newCell.vertex = true;
                newCell.value = itemData.label;
                newCell.userObject = itemData.userObject ? JSON.parse(JSON.stringify(itemData.userObject)) : null;
                newCell.isExperimentalFrame = itemData.isExperimentalFrame;

                newCell.geometry.x = pt.x - newCell.geometry.width / 2;
                newCell.geometry.y = pt.y - newCell.geometry.height / 2;

                graph.getModel().beginUpdate();
                try {
                    graph.addCell(newCell);
                } finally {
                    graph.getModel().endUpdate();
                }
                graph.clearSelection();
                window.getSelection().removeAllRanges();
            }
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);

            
        });

        return item;
    }

    const paletteByCategory = {
    counterCategory: counterItems || []
    };

    const defaultNewCategoryPalette = genericItems || [];


    /**
    const allPalettes = {
        // generalCategory: generalItems,
        counterCategory: counterItems,
        aviationCategory: aviationItems,
        trafficLightCategory: trafficLightItems
    };
    */

    /**
    function fillPalette(categoryName) {
        shapesDiv.innerHTML = '';
        const category = allPalettes[categoryName] || [];
        category.forEach(data => shapesDiv.appendChild(createPaletteItem(data)));
    }
    */

    const starterPaletteItems = generalItems || [];

    function fillPalette(categoryName) {
        shapesDiv.innerHTML = '';
        const items = paletteByCategory[categoryName] || defaultNewCategoryPalette;
        items.forEach(data => shapesDiv.appendChild(createPaletteItem(data)));
    }

    window.fillPalette = fillPalette;


    function styleObjectToString(obj) {
        return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join(';');
    }

    function createMxCellFromItem(item) {
        // Geometry: x,y will be set later by caller
        const geo = new mxGeometry(0, 0, item.width || 80, item.height || 40);

        // Build style string
        let styleStr = '';
        if (item.style) {
            // For image shapes ensure mxGraph expects "image=..." not "src=..."
            if (item.style.shape === 'image' && (item.style.image || item.style.src)) {
                const src = item.style.image || item.style.src;
                styleStr = `shape=image;image=${src}`;
            } else {
                // Reuse your existing converter if available
                styleStr = typeof styleObjectToString === 'function'
                    ? styleObjectToString(item.style)
                    : Object.entries(item.style || {}).map(([k, v]) => `${k}=${v}`).join(';');
            }
        }

        // Use label as the display value (if present)
        const value = item.label || '';

        const cell = new mxCell(value, geo, styleStr);
        cell.setVertex(true);

        // // Keep your metadata on userObject (not the cell.value which is label)
        // cell.userObject = item.userObject || null;
        // Deep clone userObject so each cell has its own independent copy
        cell.userObject = item.userObject ? JSON.parse(JSON.stringify(item.userObject)) : null;

        return cell;
    }


    graph.addListener(mxEvent.CELLS_MOVED, function (sender, evt) {
        lastDropX = null;
        lastDropY = null;
    });



    /////////////////////////////////////////////////////////////////////////////
    ///////// Keyboard Shortcuts setup
    /////////////////////////////////////////////////////////////////////////////

    const keyHandler = new mxKeyHandler(graph);

    // Map functName strings to actual functions
    const functionMap = {
        deleteSelectedCells: () => deleteSelectedCells(graph),
        deleteAllCells: () => deleteAllCells(graph),
        selectAllCells: () => selectAllCells(graph),
        copySelectedCells: () => copySelectedCells(graph),
        pasteClipboardCells: () => pasteClipboardCells(graph),
        undoAction: () => undoAction(undoManager),
        redoAction: () => redoAction(undoManager),
        duplicateSelectedCells: () => duplicateSelectedCells(graph),
        cutSelectedCells: () => cutSelectedCells(graph),
        zoomIn: () => graph.zoomIn(),
        zoomOut: () => graph.zoomOut(),
        zoomReset: () => graph.zoomActual(),
        zoomFit: () => graph.fit(25)
        // moveLeft,
        // moveRight,
        // moveUp,
        // moveDown
    };

    // Binds the functions in functionMap to the specified shortcuts in shortcut.js
    shortcuts.forEach(sc => {
        const fn = functionMap[sc.functName];
        if (!fn) return console.warn(`Function ${sc.functName} not found`);

        const callback = evt => { fn(); evt.preventDefault(); };

        switch (sc.modifier) {
            case 'ctrl': keyHandler.bindControlKey(sc.keyCode, callback); break;
            case 'shift': keyHandler.bindShiftKey(sc.keyCode, callback); break;
            case 'ctrlShift': keyHandler.bindControlShiftKey(sc.keyCode, callback); break;
            default: keyHandler.bindKey(sc.keyCode, callback);
        }
    });

    // Function to generate the shortcut help text
    function showShortcutHelp() {
        const shortcutHelpText = shortcuts.map(sc => `${sc.text}: ${sc.description}`).join('\n');
        //console.log(shortcutHelpText);
        alert(shortcutHelpText); // TODO replace with nicer looking modal or HTMLDialogElement
    }

    document.getElementById('shortcutsBtn').addEventListener('click', showShortcutHelp);

    keyHandler.bindKey(37, function () { moveCells(-1, 0); }); // Left arrow
    keyHandler.bindKey(38, function () { moveCells(0, -1); }); // Up arrow
    keyHandler.bindKey(39, function () { moveCells(1, 0); });  // Right arrow
    keyHandler.bindKey(40, function () { moveCells(0, 1); });  // Down arrow


    /////////////////////////////////////////////////////////////////////////////
    ///////// Right palette setup
    /////////////////////////////////////////////////////////////////////////////


    function populateRightPalette() {
        const selected = graph.getSelectionCells();

        // Grab all headers/sections
        const selectACellIndicator = document.getElementById("selectACellIndicator");
        const modelNameIDHeader = document.getElementById("modelNameIDHeader");
        const modelNameIDContent = document.getElementById("modelNameIDContent");
        const propertiesHeader = document.getElementById("propertiesHeader");
        const propertiesContent = document.getElementById("propertiesContent");
        const inputPortsHeader = document.getElementById("inputPortsHeader");
        const inputPortsContent = document.getElementById("inputPortsContent");
        const outputPortsHeader = document.getElementById("outputPortsHeader");
        const outputPortsContent = document.getElementById("outputPortsContent");
        const addNewPortHeader = document.getElementById("addNewPortHeader");
        const addNewPortContent = document.getElementById("addNewPortContent");
        const externalInputCouplingsHeader = document.getElementById("externalInputCouplingsHeader");
        const externalInputCouplingsContent = document.getElementById("externalInputCouplingsContent");
        const externalOutputCouplingsHeader = document.getElementById("externalOutputCouplingsHeader");
        const externalOutputCouplingsContent = document.getElementById("externalOutputCouplingsContent");
        const internalCouplingsHeader = document.getElementById("internalCouplingsHeader");
        const internalCouplingsContent = document.getElementById("internalCouplingsContent");
        const addCouplingSection = document.getElementById("addCouplingSection");
        const deltaIntHeader = document.getElementById("deltaIntHeader");
        const deltaIntContent = document.getElementById("deltaIntContent");
        const deltaExtHeader = document.getElementById("deltaExtHeader");
        const deltaExtContent = document.getElementById("deltaExtContent");
        const outputFunctionHeader = document.getElementById("outputFunctionHeader");
        const outputFunctionContent = document.getElementById("outputFunctionContent");
        const timeAdvanceFunctionHeader = document.getElementById("timeAdvanceFunctionHeader");
        const timeAdvanceFunctionContent = document.getElementById("timeAdvanceFunctionContent");


        // Hide all sections initially
        [selectACellIndicator,
            modelNameIDHeader, modelNameIDContent,
            propertiesHeader, propertiesContent,
            inputPortsHeader, inputPortsContent,
            outputPortsHeader, outputPortsContent,
            addNewPortHeader, addNewPortContent,
            externalInputCouplingsHeader, externalInputCouplingsContent,
            externalOutputCouplingsHeader, externalOutputCouplingsContent,
            internalCouplingsHeader, internalCouplingsContent,
            addCouplingSection,
            deltaIntHeader, deltaIntContent,
            deltaExtHeader, deltaExtContent,
            outputFunctionHeader, outputFunctionContent,
            timeAdvanceFunctionHeader, timeAdvanceFunctionContent
        ].forEach(el => el.classList.add("hidden"));


        // Case 1: no cell or multiple cells selected
        if (selected.length !== 1) {
            selectACellIndicator.innerHTML = '<em>Select a single cell to edit properties</em>';
            selectACellIndicator.classList.remove("hidden");
            return;
        }

        const cell = selected[0];

        if (cell.isAtomicModel()) {

            // For an atomic model we show State Variables, Input Ports, Output Ports (for now)
            renderModelAndUniqueID(cell);
            renderStateVariables(cell);
            renderPorts(cell);
            renderDeltaInt(cell);
            renderDeltaExt(cell);
            renderOutputFunction(cell);
            renderTimeAdvanceFunction(cell);

            console.log("Atomic model selected");

        } else if (cell.isCoupledModel()) {

            // For a coupled model we show...
            renderModelAndUniqueID(cell);
            renderPorts(cell);
            renderCouplings(cell);
            renderAddCouplingUI(cell);

            console.log("Coupled model selected");

        } else if (cell.isExperimentalFrame()) {

            console.log("ExperimentalFrame selected");

        } else {
            propertiesContent.innerHTML = '<em>This cell has no editable properties</em>';
            return;
        }

    }

    window.populateRightPalette = populateRightPalette;
    
    /////////////////////////////////////////////////////////////////////////////
    ///////// Right Tab Switching
    /////////////////////////////////////////////////////////////////////////////

function setRightTab(tabName, options = {}) {
    const previousTab = window.currentRightTab || "properties";
    const alreadyOnTab = previousTab === tabName;

    window.currentRightTab = tabName;

    const { render = true, save = true } = options;
    const propertiesTab = document.getElementById("tabPropertiesBtn");
    const experimentTab = document.getElementById("tabExperimentBtn");
    const propertiesPane = document.getElementById("propertiesTab");
    const experimentPane = document.getElementById("experimentTab");

    if (!propertiesTab || !experimentTab) {
        console.log("propertiesTabBtn =", document.getElementById("tabPropertiesBtn"));
        console.log("experimentTabBtn =", document.getElementById("tabExperimentBtn"));
        console.warn("Right tab buttons missing");
        return;
    }

    if (tabName === "properties") {
        propertiesTab.classList.add("active");
        experimentTab.classList.remove("active");

        if (render && !alreadyOnTab) {
            populateRightPalette();
        }
    } else {
        experimentTab.classList.add("active");
        propertiesTab.classList.remove("active");
        if (render && typeof setupExperimentSidebar === "function") {
            setupExperimentSidebar(graph || window.currentGraph);
        }
    }

    if (save) {
        saveUiStateForCurrentCategory(graph || window.currentGraph);
    }
}

    window.setRightTab = setRightTab;

    document.getElementById("tabPropertiesBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Properties tab clicked");
        setRightTab("properties", { render: true, save: true });
    });

    document.getElementById("tabExperimentBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Experiment tab clicked");
        setRightTab("experiment", { render: true, save: true });
    });

    graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
        const cell = graph.getSelectionCell();

        const propsActive = document.getElementById("tabPropertiesBtn") ?.classList.contains("active");

        // Show properties when the Properties tab is currently active
        if (!propsActive) {
            return;
        }
        populateRightPalette();
    });

   

    // Log id of cells upon clicking for development purposes
    graph.addListener(mxEvent.CLICK, function (sender, evt) {
        var cell = evt.getProperty('cell'); // the clicked cell
        if (cell != null) {
            console.log('Clicked cell ID:', cell.getId());
        }
    });

    return graph;
}
    /////////////////////////////////////////////////////////////////////////////
    ///////// Help -> About 
    /////////////////////////////////////////////////////////////////////////////
function setupHelpMenu() {
    const aboutBtn = document.getElementById("aboutBtn");
    const aboutModal = document.getElementById("aboutModal");
    const aboutClose = document.getElementById("aboutClose");

    if (aboutBtn && aboutModal) {
        aboutBtn.addEventListener("click", () => {
            aboutModal.classList.remove("hidden");
        });
    }

    if (aboutClose && aboutModal) {
        aboutClose.addEventListener("click", () => {
            aboutModal.classList.add("hidden");
        });
    }

    if (aboutModal) {
        aboutModal.addEventListener("click", (e) => {
            if (e.target === aboutModal) {
                aboutModal.classList.add("hidden");
            }
        });
    }
}

function setupRightPaletteResizer() {
    const rightPalette = document.getElementById("rightPalette");
    const resizer = document.getElementById("rightResizer");

    // Safety check (prevents crashes)
    if (!rightPalette || !resizer) {
        console.warn("Right palette resizer not found");
        return;
    }

    let dragging = false;

    const MIN = 260;
    const MAX = 650;

    resizer.addEventListener("mousedown", (e) => {
        dragging = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;

        const newWidth = window.innerWidth - e.clientX;
        const clamped = Math.max(MIN, Math.min(MAX, newWidth));

        rightPalette.style.width = clamped + "px";
    });

    document.addEventListener("mouseup", () => {
        if (!dragging) return;

        dragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });
}

/////////////////////////////////////////////////////////////////////////////
///////// Autosave + UI State
/////////////////////////////////////////////////////////////////////////////

window.currentRightTab = window.currentRightTab || "properties";

function autosaveGraph(cm) {
    try {
        const xml = cm.getGraphXML();

        const category = window.currentCategory || "default";

        // Save graph XML per category
        localStorage.setItem(
            `devs_graph_xml_${category}`,
            xml
        );

    } catch (err) {
        console.error("Autosave failed:", err);
    }
}


function saveUiStateForCurrentCategory(graph) {
    try {
        const category = getCurrentCategory();

        const selected = graph?.getSelectionCell?.();
        const selectedId = selected ? selected.getId() : "";

        const currentTab = window.currentRightTab || "properties";

        localStorage.setItem(
            getUiStorageKey(category),
            JSON.stringify({
                selectedId,
                rightTab: currentTab
            })
        );

    } catch (err) {
        console.error("UI state save failed:", err);
    }
}

function getCategoryList() {
    const saved = localStorage.getItem("devs_category_list");
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error("Failed to parse category list:", e);
        }
    }

    // Only ONE starter category
    return [
        { value: "counterCategory", label: "Counter" }
    ];
}

function saveCategoryList(list) {
    localStorage.setItem("devs_category_list", JSON.stringify(list));
}

function getCurrentCategory() {
    return localStorage.getItem("devs_current_category") || "counterCategory";
}

function setCurrentCategory(category) {
    localStorage.setItem("devs_current_category", category);
}

function getGraphStorageKey(category) {
    return `devs_graph_xml_${category}`;
}

function getUiStorageKey(category) {
    return `devs_ui_state_${category}`;
}

function populateCategoryDropdown() {
    const dropdown = document.getElementById("category-select");
    if (!dropdown) return;

    const categories = getCategoryList();
    const current = getCurrentCategory();

    dropdown.innerHTML = "";

    categories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.value;
        option.textContent = cat.label;
        dropdown.appendChild(option);
    });

    dropdown.value = current;
}

function clearGraph(graph) {
    graph.getModel().beginUpdate();
    try {
        graph.removeCells(graph.getChildVertices(graph.getDefaultParent()));
        graph.removeCells(graph.getChildEdges(graph.getDefaultParent()));
    } finally {
        graph.getModel().endUpdate();
    }
}

function autosaveGraphForCategory(cm, graph, category) {
    try {
        const xml = cm.getGraphXML();
        localStorage.setItem(getGraphStorageKey(category), xml);

        const selected = graph.getSelectionCell();
        const selectedId = selected ? selected.getId() : "";

        const currentTab = window.currentRightTab || "properties";

        localStorage.setItem(
            getUiStorageKey(category),
            JSON.stringify({
                selectedId,
                rightTab: currentTab
            })
        );
    } catch (err) {
        console.error("Category autosave failed:", err);
    }
}

function restoreGraphForCategory(graph, category) {
    const xml = localStorage.getItem(getGraphStorageKey(category));

    clearGraph(graph);

    if (!xml) {
        console.log(`No saved graph for ${category}`);
        return;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const codec = new mxCodec(xmlDoc);

        graph.getModel().beginUpdate();
        try {
            codec.decode(xmlDoc.documentElement, graph.getModel());
        } finally {
            graph.getModel().endUpdate();
        }

        console.log(`Graph restored for ${category}`);
    } catch (err) {
        console.error(`Failed to restore graph for ${category}:`, err);
    }
}

function restoreUiStateForCategory(graph, category) {
    try {
        const raw = localStorage.getItem(getUiStorageKey(category));
        if (!raw) return;

        const uiState = JSON.parse(raw);
        if (!uiState) return;

        if (uiState.rightTab && window.setRightTab) {
            window.setRightTab(uiState.rightTab, {
                render: true,
                save: false
            });
        }

        if (uiState.selectedId) {
            const model = graph.getModel();
            const cell = model.getCell(uiState.selectedId);
            if (cell) {
                graph.setSelectionCell(cell);
            }
        }
    } catch (err) {
        console.error("Failed to restore UI state for category:", err);
    }
}


// Wait for DOM to be ready before initializing
document.addEventListener('DOMContentLoaded', () => {

    setupRightPaletteResizer();
    setupBottomPanelResizer();
    const container = document.getElementById('graphContainer');
    const graph = main(container); // Return the graph from main

    const cm = new ConversionManager(graph);
    setupHelpMenu();

    const dropdown = document.getElementById('category-select');
    dropdown.addEventListener('change', e => {
        const newCategory = e.target.value;
        const oldCategory = getCurrentCategory();

        autosaveGraphForCategory(cm, graph, oldCategory);

        setCurrentCategory(newCategory);
        window.fillPalette(newCategory);
        restoreGraphForCategory(graph, newCategory);
        restoreUiStateForCategory(graph, newCategory);
    });


    document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const label = prompt("Enter new category name:");
    if (!label) return;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;

    const categories = getCategoryList();

    const value = trimmedLabel.replace(/\s+/g, "_").replace(/[^\w\-]/g, "") + "_category";

    if (categories.some(c => c.value === value)) {
        alert("A category with that name already exists.");
        return;
    }

    autosaveGraphForCategory(cm, graph, getCurrentCategory());

    categories.push({ value, label: trimmedLabel });
    saveCategoryList(categories);

    populateCategoryDropdown();
    setCurrentCategory(value);
    document.getElementById("category-select").value = value;

    clearGraph(graph);
    window.fillPalette(value);
});

document.getElementById("deleteCategoryBtn").addEventListener("click", () => {
    const current = getCurrentCategory();
    const categories = getCategoryList();

    if (categories.length === 1) {
        alert("You must keep at least one category.");
        return;
    }

    const currentObj = categories.find(c => c.value === current);
    const confirmed = confirm(`Delete category "${currentObj?.label || current}"?`);
    if (!confirmed) return;

    const updated = categories.filter(c => c.value !== current);
    saveCategoryList(updated);

    localStorage.removeItem(getGraphStorageKey(current));
    localStorage.removeItem(getUiStorageKey(current));

    const fallback = updated[0].value;
    setCurrentCategory(fallback);

    populateCategoryDropdown();
    document.getElementById("category-select").value = fallback;

    restoreGraphForCategory(graph, fallback);
    restoreUiStateForCategory(graph, fallback);
    window.fillPalette(fallback);
    });

    window.currentGraph = graph;
    window.currentConversionManager = cm;

    populateCategoryDropdown();
    window.fillPalette(getCurrentCategory());
    restoreGraphForCategory(graph, getCurrentCategory());
    restoreUiStateForCategory(graph, getCurrentCategory());

    window.autosaveGraphNow = () => {
    try {
        const category = getCurrentCategory();
        autosaveGraphForCategory(cm, graph, category);
    } catch (err) {
        console.error("Autosave failed:", err);
    }
    };

 

    graph.getModel().addListener(mxEvent.CHANGE, () => {
        window.autosaveGraphNow();
    });

 

});
