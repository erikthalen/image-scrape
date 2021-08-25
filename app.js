import "./node_modules/carbon-components/scripts/carbon-components.min.js";
import "./node_modules/socket.io/client-dist/socket.io.js";
import { STATUS } from "./status.js";

const socket = io();

const output = document.querySelector(".output");
const total = document.querySelector(".total");
const process = document.querySelector(".process");

let state = {
  onStatus: (status) => {
    switch (status) {
      case STATUS.RUNNING: {
        process.classList.toggle("show", true);
      }

      case STATUS.IDLE: {
        process.classList.toggle("show", false);
      }
    }
  },
};

socket.on("status", (status) => {
  console.log("status", status);
  state.onStatus(status);
});

socket.on("row", (length) => {
  console.log("row", length);
  output.textContent = length;
});

socket.on("total", (length) => {
  console.log("total", length);
  total.textContent = length;
});
