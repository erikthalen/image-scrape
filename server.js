import express from "express";
import multer from "multer";
import csv from "csvtojson";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static("./"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.post("/upload", upload.single("file"), async (req, res) => {
  const config = req.query;

  // convert the file to json
  var b = req.file["buffer"];
  const [head, ...json] = await csv({
    noheader: true,
    output: "csv",
  }).fromString(b.toString());

  // what column/index to check, in each row
  const targetColumn = head.findIndex((col) => col === config.CSVColumn);

  const result = await Promise.all(
    json.map(async (page) => {
      const {
        window: { document },
      } = await JSDOM.fromURL(page[targetColumn]);
      // parse the fetched page
      const targetDOMElement = document.querySelector(config.container);
      const elements = targetDOMElement.querySelectorAll(config.getAll);

      // extract passed attribute
      const images = [...elements].map((image) =>
        config.getAttribute.includes("data-")
          ? image.dataset[config.getAttribute.replace("data-", "")]
          : image[config.getAttribute]
      );

      // construct formatted json, including the scraped urls
      return head.reduce((acc, cur, idx) => {
        return {
          ...acc,
          [cur]: page[idx],
          images,
        };
      }, {});
    })
  );

  // send back the contructed json
  res
    .status(200)
    .attachment(`${config.outputFilename}.json`)
    .send(JSON.stringify(result));
});

app.get("/", function (_, res) {
  res.sendFile("index.html");
  res.end();
});

app.listen(1337, function () {
  console.log("server running on 1337");
});
