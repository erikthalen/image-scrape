import csv from "csv-parser";
import express from "express";
import multer from "multer";
import jsdom from "jsdom";
import streamifier from "streamifier";
import { Server } from "socket.io";
import http from "http";
import transform from "parallel-transform";

const { JSDOM } = jsdom;

const app = express();
const upload = multer();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("./"));
app.use(express.urlencoded({ extended: false }));

const getHTMLAttributes = (els, attr) => {
  return [...els].map((el) =>
    attr.includes("data-") ? el.dataset[attr.replace("data-", "")] : el[attr]
  );
};

const processUrl = async (url, config) => {
  const {
    window: { document },
  } = await JSDOM.fromURL(url);

  const targetDOMElement = document.querySelector(config.container);
  const elements = targetDOMElement.querySelectorAll(config.getAll);

  return elements;
};

async function processStream(readable, config, onData) {
  let results = [];

  const stream = transform(10, (data, callback) => callback(null, data));
  
  stream.on("data", async function (data) {
    // console.log(data);
    const url = data[config.CSVColumn];
    const elements = await processUrl(url, config);
    const imageUrls = getHTMLAttributes(elements, config.getAttribute);
    const newData = {
      ...data,
      ...imageUrls.reduce((acc, url, idx) => {
        return {
          ...acc,
          [`image-${idx}`]: url,
        };
      }, {}),
    };
    
    results.push(newData);
    
    onData(results.length);
  });
  
  stream.on("end", () => {
    console.log("stream has ended");
    return results;
  });
  
  stream.write(readable);

  // return results;
}

app.post("/upload", upload.single("file"), async (req, res) => {
  const config = req.body;
  const buffer = req.file["buffer"];

  const stream = streamifier
    .createReadStream(buffer)
    .pipe(csv({ separator: config.seperator }));

  const results = await processStream(stream, config, (count) => {
    io.sockets.emit("row", count);
  });

  res
    .status(200)
    .attachment(`${config.outputFilename}.json`)
    .send(JSON.stringify(results));
});

app.get("/", function (_, res) {
  res.sendFile("index.html");
  res.end();
});

server.listen(process.env.PORT || 1337, function () {
  console.log("server running on 1337");
});
