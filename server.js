import csv from "csv-parser";
import express from "express";
import multer from "multer";
import jsdom from "jsdom";
import streamifier from "streamifier";
import { Server } from "socket.io";
import http from "http";
import transform from "parallel-transform";

/**
 * NOTE: flow:
 * 1. File + config is recieved from client.
 * 2. File is converted to readStream to be processed.
 * 3. Each row in the stream is read and written to a parallel-stream,
 *    so the async stuff can happen in parallel.
 * 4. TODO: The parallel-stream !SHOULD! fetch multiple rows at the time,
 *    and save the results. When all rows are fetched, return the result.
 *    Atm it doesn't wait for the rows to come back before the result is sent to the client.
 *
 */

const { JSDOM } = jsdom;
const app = express();
const upload = multer();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("./"));
app.use(express.urlencoded({ extended: false }));

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
 * Takes a stream and !should! process it..
 */
async function processStream(readable, config, onData) {
  return new Promise(async (resolve) => {
    let results = [];

    /**
     * TODO: it takes to long to "await" each row,
     * "transform" runs in parallel, which should speed things up.
     */
    const parallismLevel = 10;
    const stream = transform(parallismLevel, (data, callback) =>
      callback(null, data)
    );

    /**
     * Write the passed stream into transform,
     * so the stream can be processed in parallel
     */
    for await (const chunk of readable) {
      stream.write(chunk);
    }
    stream.end();

    /**
     * When a new row is written, do the fetching!
     * and push finished row to "results"
     */
    stream.on("data", async function (data) {
      const url = data[config.CSVColumn];
      // // NOTE: async doesn't work
      // const elements = await processUrl(url, config);
      // const imageUrls = getHTMLAttributes(elements, config.getAttribute);
      // const newData = {
      //   ...data,
      //   ...imageUrls.reduce((acc, url, idx) => {
      //     return {
      //       ...acc,
      //       [`image-${idx}`]: url,
      //     };
      //   }, {}),
      // };

      // test: just write a line from the passed row (no async) works fine
      const newData = url;

      results.push(newData);

      // callback, for socket.io to update the client
      onData(results.length);
    });

    /**
     * TODO: The "end" is when the input file is written to the parallel-stream,
     * not when the proccessed rows are fetched.
     */
    stream.on("end", () => {
      console.log("stream has ended");
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

  // create stream
  const stream = streamifier
    .createReadStream(buffer)
    .pipe(csv({ separator: "\t" }));

  // get data
  const results = await processStream(stream, config, (count) => {
    io.sockets.emit("row", count);
  });

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
