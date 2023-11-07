const express = require('express');
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');
const { SvfReader } = require('forge-convert-utils');
const path = require('path');
const app = express();
const fse = require('fs-extra');
const { Readable } = require('stream');
const amqp=require('amqplib')

let response = {
  clientId: "",
  clientSecret: "",
  urn: "",
  outputDirectory: ""
};

app.get('/', (req, res, next) => {
  res.send("hello world");
});

app.get('/getStream', async (req, res, next) => {
  await ReceiveToQueue();

  if (response.clientId !== "") {
    const stream = mergeStreams(await GetSvfStream(response));

    if (stream) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=output.svf');

      // Stream'i yanıt olarak gönder
      stream.pipe(res)
    } else {
      console.log("SVF Stream cannot be retrieved");
      res.status(500).send("Internal Server Error");
    }
  } else {
    console.log("Values cannot be obtained from the queue yet");
    res.status(500).send("Values cannot be obtained from the queue yet");
  }
});

app.listen(8000, async () => {
  console.log("Starting Express server...");
});

async function GetSvfStream({ clientId, clientSecret, urn, outputDirectory } = response) {
  const derivativeClient = new ModelDerivativeClient({
    client_id: clientId,
    client_secret: clientSecret
  });

  const manifest = await derivativeClient.getManifest(urn);
  const helper = new ManifestHelper(manifest);
  const derivatives = helper.search({ type: 'resource', role: 'graphics' });
  const streams = [];

  for (const derivative in derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
    const defaultDerivative = derivatives[parseInt(derivative)];
    const derivativeUrn = defaultDerivative.urn;
    const derivativeGuid=defaultDerivative.guid
   
    const derivativeBuffer = await derivativeClient.getDerivative(urn, encodeURI(derivativeUrn));
    //const uint8derivativeBuffer = new Uint8Array(derivativeBuffer);

    streams.push(bufferToStream(derivativeBuffer))

    const reader=await SvfReader.FromDerivativeService(urn,derivativeGuid,{
        client_id:clientId,
        client_secret:clientSecret
    })

    const readerManifest=await reader.getManifest()

    for (const asset of readerManifest.assets) {
      if (!asset.URI.startsWith('embed:')) {
        const assetData = await reader.getAsset(asset.URI);
        const assetBuffer=bufferToStream(assetData)
        streams.push(assetBuffer);
      }
    }
 
  }
  return streams;
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); 
  return stream;
}

function mergeStreams(streams) {
  const mergedStream = new Readable();
  mergedStream._read = () => {
    const nextStream = streams.shift();
    if (nextStream) {
      nextStream.on('data', (chunk) => {
        mergedStream.push(chunk);
      });
      nextStream.on('end', () => {
        mergedStream.push(null);
      });
    } else {
      mergedStream.push(null);
    }
  };
  return mergedStream;
}


async function ReceiveToQueue() {
    const connection = await amqp.connect("amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi")
    const channel = await connection.createChannel()
    await channel.assertQueue("svfDownloadInfo")
    await channel.consume("svfDownloadInfo", (msg) => {
        response = JSON.parse(Buffer.from(msg.content, "utf-8").toString())
    }, { noAck: false })

    await channel.close()
    return response
}