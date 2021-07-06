import "./node_modules/carbon-components/scripts/carbon-components.min.js";
import "./node_modules/socket.io/client-dist/socket.io.js"

const socket = io();

// const form = document.querySelector("form");
// const inputs = [...document.querySelectorAll(".config input")];

// const updateFormAction = () => {
//   form.action = `/upload?${inputs
//     .map((input) => `${input.name}=${input.value}`)
//     .join("&")}`;
// };

// updateFormAction();

// inputs.forEach((input) => {
//   input.addEventListener("input", updateFormAction);
// });

const output = document.querySelector('.output');

socket.on('row', (length, newData) => {
  console.log(length, newData)
  output.textContent = length;
});
