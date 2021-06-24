import "./node_modules/carbon-components/scripts/carbon-components.min.js";

const form = document.querySelector("form");
const inputs = [...document.querySelectorAll(".config input")];

const updateFormAction = () => {
  form.action = `/upload?${inputs
    .map((input) => `${input.name}=${input.value}`)
    .join("&")}`;
};

updateFormAction();

inputs.forEach((input) => {
  input.addEventListener("input", updateFormAction);
});
