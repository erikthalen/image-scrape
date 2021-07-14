import "./node_modules/carbon-components/scripts/carbon-components.min.js";
import "./node_modules/socket.io/client-dist/socket.io.js";

console.log("app.js");

const socket = io();
const output = document.querySelector(".output");
const total = document.querySelector(".total");

socket.on("row", (length) => {
  console.log('length', length);
  output.textContent = length;
});

socket.on("total", (length) => {
  console.log('total', length);
  total.textContent = length;
});
