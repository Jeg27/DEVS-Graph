const API_BASE = "http://localhost:3001";

import { fillSelect } from "./experiment-data.js";
import { ConversionManager } from "./conversions.js";
import {
  generateExperimentJsonFromGraph,
  attachInitEditors,
  initCouplingButtons
} from "./experiment-actions.js";

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setBottomOutputMessage(text) {
  const container = document.getElementById("outputTableContainer");
  if (!container) return;

  if (!text || !text.trim()) {
    container.innerHTML = `<div class="output-empty">No simulation output yet.</div>`;
    return;
  }

  container.innerHTML = `<pre class="output-box">${escapeHtml(text)}</pre>`;
}

export function setupExperimentSidebar(graph) {
  const cm = new ConversionManager(graph);

  const openBtn = document.getElementById("previewDesignExperimentBtn");
  const closeBtn = document.getElementById("closeExperimentPanelBtn");

  const propsBtn = document.getElementById("tabPropertiesBtn");
  const expBtn = document.getElementById("tabExperimentBtn");

  const genExpJsonBtn = document.getElementById("generateExperimentJsonBtn");
  const runExpBtn = document.getElementById("runExperimentBtn");

  const clearOutputBtn = document.getElementById("clearOutputBtn");
  const traceViewerBtn = document.getElementById("traceViewerBtn");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const validateBtn = document.getElementById("validateOutputBtn");
  const modeSelect = document.getElementById("validationMode");
  const fileInput = document.getElementById("fileInput");
  const folderInput = document.getElementById("folderInput");
  const out = document.getElementById("experimentOutput");

  const propsTab = document.getElementById("propertiesTab");
  const expTab = document.getElementById("experimentTab");

  const mutModelSelect = document.getElementById("mutModelSelect");
  const efModelSelect = document.getElementById("efModelSelect");

  const expNameInput = document.getElementById("expName");
  const timeSpanInput = document.getElementById("timeSpanInput");

  const toggleMutInitBtn = document.getElementById("toggleMutInitBtn");
  const toggleEfInitBtn = document.getElementById("toggleEfInitBtn");

  const mutInitEditorEl = document.getElementById("mutInitEditor");
  const efInitEditorEl = document.getElementById("efInitEditor");

  const selectIndicator = document.getElementById("selectACellIndicator");

  if (!propsTab || !expTab || !propsBtn || !expBtn) {
    console.warn("Tab elements missing");
    return;
  }

  setBottomOutputMessage("");


  const editors = attachInitEditors({ cm, mutModelSelect, efModelSelect });

  toggleMutInitBtn?.addEventListener("click", () => {
    mutInitEditorEl?.classList.toggle("hidden");
  });

  toggleEfInitBtn?.addEventListener("click", () => {
    efInitEditorEl?.classList.toggle("hidden");
  });

  function getAllVerticesRecursive(graphInstance) {
    const model = graphInstance.getModel();
    const root = graphInstance.getDefaultParent();
    const vertices = [];

    function walk(parent) {
      const kids = model.getChildCells(parent, true, false) || [];
      for (const c of kids) {
        vertices.push(c);
        walk(c);
      }
    }

    walk(root);
    return vertices;
  }

  function getAllDevsModelsFromGraph(graphInstance) {
    return getAllVerticesRecursive(graphInstance)
      .filter(c => c?.isCoupledModel?.())
      .map(c => ({
        id: c.userObject?.unique_id ?? c.getId(),
        name: c.userObject?.model_name ?? String(c.value ?? c.getId())
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function refreshModelsOnly() {
    const mutPrev = mutModelSelect?.value || "";
    const efPrev = efModelSelect?.value || "";

    const allModels = getAllDevsModelsFromGraph(graph);

    fillSelect(mutModelSelect, allModels, { placeholder: "Select MUT model..." });
    fillSelect(efModelSelect, allModels, { placeholder: "Select EF model..." });

    if (mutModelSelect && [...mutModelSelect.options].some(o => o.value === mutPrev)) {
      mutModelSelect.value = mutPrev;
    }

    if (efModelSelect && [...efModelSelect.options].some(o => o.value === efPrev)) {
      efModelSelect.value = efPrev;
    }
  }

  graph.getModel().addListener(mxEvent.CHANGE, () => {
    if (document.getElementById("experimentTab")?.classList.contains("active")) {
      refreshModelsOnly();
    }
  });

  async function refreshExperimentDropdowns() {
    try {
      const mutPrev = mutModelSelect?.value || "";
      const efPrev = efModelSelect?.value || "";

      const allModels = getAllDevsModelsFromGraph(graph);

      fillSelect(mutModelSelect, allModels, { placeholder: "Select MUT model..." });
      fillSelect(efModelSelect, allModels, { placeholder: "Select EF model..." });

      if (mutModelSelect && [...mutModelSelect.options].some(o => o.value === mutPrev)) {
        mutModelSelect.value = mutPrev;
      }

      if (efModelSelect && [...efModelSelect.options].some(o => o.value === efPrev)) {
        efModelSelect.value = efPrev;
      }
    } catch (e) {
      console.error("Failed to load experiment dropdowns:", e);
      if (out) out.textContent = `Error loading experiment data:\n${String(e)}`;
      setBottomOutputMessage(`Error loading experiment data:\n${String(e)}`);
    }
  }

  function activateTab(which) {
    const isProps = which === "properties";

    propsBtn.classList.toggle("active", isProps);
    expBtn.classList.toggle("active", !isProps);

    propsTab.classList.toggle("active", isProps);
    expTab.classList.toggle("active", !isProps);

    if (selectIndicator) {
      if (isProps) {
        selectIndicator.classList.remove("hidden");
        if (!selectIndicator.innerHTML.trim()) {
          selectIndicator.innerHTML = "<em>Select a single cell to edit properties</em>";
        }
      } else {
        selectIndicator.classList.add("hidden");
      }
    }

    if (isProps) {
      window.populateRightPalette?.();
    } else {
      refreshExperimentDropdowns();
    }
  }

  window.setRightTab = activateTab;

  propsBtn.addEventListener("click", () => activateTab("properties"));
  expBtn.addEventListener("click", () => activateTab("experiment"));

  openBtn?.addEventListener("click", () => activateTab("experiment"));
  closeBtn?.addEventListener("click", () => activateTab("properties"));

  initCouplingButtons(cm);

  activateTab("properties");

  genExpJsonBtn?.addEventListener("click", () =>
    generateExperimentJsonFromGraph({
      cm,
      expNameInput,
      mutModelSelect,
      efModelSelect,
      timeSpanInput,
      out,
      getMutInitBuilder: editors.getMutInitBuilder,
      getEfInitBuilder: editors.getEfInitBuilder
    })
  );

  runExpBtn?.addEventListener("click", () =>
  generateExperimentJsonFromGraph({
    cm,
    expNameInput,
    mutModelSelect,
    efModelSelect,
    timeSpanInput,
    out,
    getMutInitBuilder: editors.getMutInitBuilder,
    getEfInitBuilder: editors.getEfInitBuilder
  })
);

  clearOutputBtn?.addEventListener("click", () => {
    if (out) out.textContent = "";
    setBottomOutputMessage("");
  });

  traceViewerBtn?.addEventListener("click", () => {
    window.open("https://devssim.carleton.ca/trace-viewer/index.html", "_blank");
  });

  exportCsvBtn?.addEventListener("click", () => {
  const csv = window.__LAST_CSV_OUTPUT || "";

  if (!csv.trim()) {
    alert("No simulation output to export.");
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "simulation_output.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
  });

validateBtn?.addEventListener("click", async () => {
  try {
    const mode = modeSelect.value;

    if (mode === "file") {
      fileInput.click();

      fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", "file");
        formData.append("tolerance", "0.1");

        setBottomOutputMessage("Running validation...");

        const res = await fetch("http://localhost:8002/validate", {
          method: "POST",
          body: formData
        });

        const result = await res.text();
        setBottomOutputMessage(result);
      };
    }

  } catch (err) {
    console.error(err);
    setBottomOutputMessage("Validation failed: " + err.message);
  }
});

  function getCoupledPortsByUid(uid) {
    const uos = cm.getUserObjects();
    const coupled = uos.find(
      u =>
        u.elementType === "coupledModel" &&
        u.unique_id?.toLowerCase() === String(uid).toLowerCase()
    );

    if (!coupled) return { inputs: [], outputs: [] };

    const x = coupled.json?.model?.x || {};
    const y = coupled.json?.model?.y || {};

    return {
      inputs: Object.keys(x),
      outputs: Object.keys(y)
    };
  }

  function updateCouplingDropdownOptions() {
    const mutUid = mutModelSelect?.value || "";
    const efUid = efModelSelect?.value || "";

    const mutPorts = mutUid ? getCoupledPortsByUid(mutUid) : { inputs: [], outputs: [] };
    const efPorts = efUid ? getCoupledPortsByUid(efUid) : { inputs: [], outputs: [] };

    window.__CPIC_FROM_OPTIONS = efPorts.outputs;
    window.__CPIC_TO_OPTIONS = mutPorts.inputs;

    window.__POCC_FROM_OPTIONS = mutPorts.outputs;
    window.__POCC_TO_OPTIONS = efPorts.inputs;

    window.refreshCouplingUI?.();
  }

  mutModelSelect?.addEventListener("change", updateCouplingDropdownOptions);
  efModelSelect?.addEventListener("change", updateCouplingDropdownOptions);
}