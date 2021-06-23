import "./node_modules/dropzone/dist/dropzone.js";
import { config } from "./config.js";

Dropzone.autoDiscover = false;

function downloadTextFile(text, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
}

const inputs = [...document.querySelectorAll(".config input")];

const dropzone = new Dropzone(".dropzone", {
  url: "/upload",
  maxFiles: null,
  success: (_, res) => {
    downloadTextFile(
      JSON.stringify(res, null, 2),
      `${config.outputFilename}.json`
    );
  },
});

dropzone.on("addedfile", (file) => {
  console.log("Processing the file");
  dropzone.options.url = `/upload?${inputs
    .map((input) => `${input.name}=${input.value}`)
    .join("&")}`;
});
