const express = require('express');
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');
const { SvfReader } = require('forge-convert-utils');
const amqp = require('amqplib');
const JSZip = require('jszip');
const app = express();

let response = {
  clientId: '',
  clientSecret: '',
  urn: ''
};

app.get('/', (req, res, next) => {
  res.send('Hello World');
});

app.get('/getStream', async (req, res, next) => {
  await ReceiveToQueue();

  if (response.clientId !== '') {
    const zip = new JSZip();
    
    const streams = await GetSvfStream(response, zip);

    console.log(streams)

    if (streams!==null) {
      zip.generateAsync({ type: 'nodebuffer' }).then((zipData) => {
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=${response.urn}.zip`);
        res.send(zipData);
      });
    } else {
      console.log('SVF Streams cannot be retrieved');
      res.status(500).send('Internal Server Error');
    }
  } else {
    console.log('Values cannot be obtained from the queue yet');
    res.status(500).send('Values cannot be obtained from the queue yet');
  }
});

app.listen(8000, async () => {
  console.log('Starting Express server...');
});

async function GetSvfStream({ clientId, clientSecret, urn} = response, zip) {
  const derivativeClient = new ModelDerivativeClient({
    client_id: clientId,
    client_secret: clientSecret,
  });

  const manifest = await derivativeClient.getManifest(urn);
  const helper = new ManifestHelper(manifest);
  const derivatives = helper.search({ type: 'resource', role: 'graphics' });

  for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
    const defaultDerivative = derivative;
    const derivativeUrn = defaultDerivative.urn;
    const derivativeGuid = defaultDerivative.guid;

    const derivativeBuffer = await derivativeClient.getDerivative(urn, encodeURI(derivativeUrn));
    zip.file('output.svf', derivativeBuffer);

    const reader = await SvfReader.FromDerivativeService(urn, derivativeGuid, {
      client_id: clientId,
      client_secret: clientSecret,
    });

    const readerManifest = await reader.getManifest();
    console.log(readerManifest.assets)

    for (const asset of readerManifest.assets) {
      if (!asset.URI.startsWith('embed:')) {
        console.log(asset)
        try{
          const assetData = await reader.getAsset(asset.URI);
          console.log(assetData)
          zip.file(asset.URI, assetData);
        }
        catch(e){
          console.log(e)
        }   
      }
    }
  }
  return zip
}

async function ReceiveToQueue() {
  const connection = await amqp.connect(
    'amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi'
  );
  const channel = await connection.createChannel();
  await channel.assertQueue('svfDownloadInfo');
  await channel.consume('svfDownloadInfo', (msg) => {
    response = JSON.parse(Buffer.from(msg.content, 'utf-8').toString());
  }, { noAck: false });

  await channel.close();
  console.log(response)
  return response;
}
