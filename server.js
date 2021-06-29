import express from "express";
import multer from "multer";
import csv from "csvtojson";
import jsdom from "jsdom";

const { JSDOM } = jsdom;
 
const app = express();
// const storage = multer.memoryStorage();
const upload = multer();

app.use(express.static("./"));
app.use(express.urlencoded({ extended: false }));

app.post("/upload", upload.single("file"), async (req, res) => {
  const config = req.query;

  console.log(req.file)

  // if(!req.file.buffer) {
  //   throw new Error('No file', req.file)
  // }

  // convert the file to json
  var b = req.file["buffer"];

  const [head, ...json] = await csv({
    noheader: true,
    output: "csv",
  }).fromString(b.toString());

  // what column/index to check, in each row
  const targetColumn = head.findIndex((col) => col === config.CSVColumn);

  const result = await Promise.all(
    json.map(async (column) => {
      const page = column[targetColumn]
      const {
        window: { document },
      } = await JSDOM.fromURL(page);
      // parse the fetched page
      const targetDOMElement = document.querySelector(config.container);
      const elements = targetDOMElement.querySelectorAll(config.getAll);

      // extract passed attribute
      const images = [...elements].map((image) =>
        config.getAttribute.includes("data-")
          ? image.dataset[config.getAttribute.replace("data-", "")]
          : image[config.getAttribute]
      );

      const testUrl = '/on/demandware.static/-/Sites-acne-product-catalog/default/dweddd43ca/images/AL/AL0239-/1500x/AL0239-CRY_C.jpg'

      // const pageUrl = new URL(page)
      // const domain = pageUrl.domain
      // // const imageUrls = images.map(imageSrc => imageSrc.includes(testUrl))
      // const test = new URL(testUrl)
      // console.log(test)

      // construct formatted json, including the scraped urls
      return head.reduce((acc, cur, idx) => {
        return {
          ...acc,
          [cur]: column[idx],
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

app.listen(process.env.PORT || 1337, function () {
  console.log("server running on 1337");
});
