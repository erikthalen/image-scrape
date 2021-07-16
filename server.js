import csv from "csv-parser";
import express from "express";
import multer from "multer";
import jsdom from "jsdom";
import streamifier from "streamifier";
import { Server } from "socket.io";
import http from "http";
import transform from "parallel-transform";
import { STATUS } from "./status.js";

/**
 * NOTE: flow:
 * 1. File + config is recieved from client.
 * 2. File is converted to readStream to be processed.
 * 3. Each row in the stream is read and written to a parallel-stream,
 *    so the async stuff can happen in parallel.
 * 4. The parallel-stream fetches multiple rows at the time,
 *    and save the results. When all rows are fetched, return the result.
 */

const { JSDOM } = jsdom;
const app = express();
const upload = multer();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("./"));
app.use(express.urlencoded({ extended: false }));

io.on("connection", (socket) => {
  socket.on("chat message", (msg) => {
    console.log("message: " + msg);
  });
});

/**
 * Takes an dom element and an attribute,
 * returns the value of the attribute
 */
const getHTMLAttributes = (els, attr) => {
  return [...els].map((el) =>
    attr.includes("data-") ? el.dataset[attr.replace("data-", "")] : el[attr]
  );
};

/**
 * Fetches a dom document and querySelectsAll passed selector
 */
const processUrl = async (url, config) => {
  const {
    window: { document },
  } = await JSDOM.fromURL(url);

  const targetDOMElement = document.querySelector(config.container);
  const elements = targetDOMElement.querySelectorAll(config.getAll);

  return elements;
};

/**
 * Takes a stream and processes it
 */
async function processStream(readable, config, cb) {
  return new Promise(async (resolve) => {
    let results = [];
    let length = 0;
    let doneAmount = 0;

    /**
     * NOTE: It takes to long to "await" each row one-by-one,
     * "transform" runs in parallel, which should speed things up.
     */
    const parallismLevel = 300;
    const stream = transform(parallismLevel, async (data, callback) => {
      const url = data[config.CSVColumn];
      const elements = await processUrl(url, config);
      const imageUrls = getHTMLAttributes(elements, config.getAttribute);
      const result = {
        ...data,
        ...imageUrls.reduce((acc, url, idx) => {
          return {
            ...acc,
            [`image-${idx}`]: url,
          };
        }, {}),
      };

      callback(null, result);
    });

    /**
     * Write the passed stream into transform,
     * so the stream can be processed in parallel
     */
    for await (const chunk of readable) {
      stream.write(chunk);
      length++;
    }
    stream.end();
    io.sockets.emit("total", length);

    /**
     * When a new row is written, do the fetching!
     * and push finished row to "results"
     */
    stream.on("data", (result) => {
      results.push(result);
      doneAmount++;
      cb(doneAmount);
    });

    /**
     * Resolve the results back to caller.
     */
    stream.on("end", () => {
      resolve(results);
    });
  });
}

/**
 * Recieves a form including a CSV file,
 * processes the file and sends it back to the client for download
 */
app.post("/upload", upload.single("file"), async (req, res) => {
  const config = req.body;
  const buffer = req.file["buffer"];

  io.sockets.emit("status", STATUS.RUNNING);

  // create stream
  const stream = streamifier
    .createReadStream(buffer)
    .pipe(csv({ separator: config.separator === 'tab' ? '\t' : ',' }));

  // get data
  const results = await processStream(stream, config, (count) => {
    io.sockets.emit("row", count); // can only handle 1 user at the time
  });

  io.sockets.emit("status", STATUS.IDLE);

  // send data to client as downloadable file
  res
    .status(200)
    .attachment(`${config.outputFilename}.json`)
    .send(JSON.stringify(results));
});

/**
 * Index route
 */
app.get("/", function (_, res) {
  res.sendFile("index.html");
  res.end();
});

/**
 * Start the server
 */
server.listen(process.env.PORT || 1337, function () {
  console.log("server running on 1337");
});
