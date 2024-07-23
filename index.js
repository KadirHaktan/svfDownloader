const express = require('express');
const {ModelDerivativeClient,ManifestHelper} = require('aps-sdk-node')
const { SvfReader,F2dDownloader, BasicAuthenticationProvider } = require('svf-utils');
const amqp = require('amqplib');
const JSZip = require('jszip');
const app = express();
const model_derivative_1 = require("@aps_sdk/model-derivative");
const authentication_1 = require("@aps_sdk/authentication");
const path=require('path');

const zlib=require('zlib')

let response = {
  clientId: '',
  clientSecret: '',
  urn: '',
  fileType:'',
  accessToken:''
};

app.get('/', (req, res, next) => {
  res.send('Hello World');
});

app.get('/getStream', async (req, res, next) => {

  await ReceiveToQueue();

  if (response.clientId !== '') {
    const zip = new JSZip();

    let streams=null

    if(response.fileType==="dwg"){
      streams=await GetF2DStrem(response,zip)
    }

    else{
      streams = await GetSvfStream(response, zip);
    } 

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


async function GetF2DStrem({clientId,clientSecret,urn}=response,zip){
  const derivativeClient = new ModelDerivativeClient({
    client_id: clientId,
    client_secret: clientSecret,
  });

  const manifest = await derivativeClient.getManifest(urn);
  const helper = new ManifestHelper(manifest);
  const derivatives = helper.search({ type: 'resource', role: 'graphics' });
  for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-f2d')) {
    const baseUrn = derivative.urn.substr(0, derivative.urn.lastIndexOf('/'));
    const secondBaseUrn = baseUrn + '/manifest.json.gz'


    const derivativeBuffer = await derivativeClient.getDerivative(urn, encodeURI(secondBaseUrn));
    zip.file('manifest.json.gz', derivativeBuffer);

    const manfiestGzip = zlib.gunzipSync(derivativeBuffer)
    const manifest = JSON.parse(manfiestGzip.toString())

    for (const asset in manifest.assets) {
      try {
        const preventAsset = manifest.assets[asset]
        const uri = preventAsset.URI
        const thirdBaseUrn = baseUrn + '/' + uri
        const assetData = await derivativeClient.getDerivative(urn, encodeURI(thirdBaseUrn));
        zip.file(uri, assetData)
      } catch (err) {
        if (context.failOnMissingAssets) {
          throw err;
        } else {
          context.log(`Could not download asset ${asset.URI}`);
        }
      }
    }
  }
  return zip
}

async function GetSvfStream({ clientId, clientSecret, urn,accessToken} = response, zip) {
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

    const provider=new BasicAuthenticationProvider(accessToken)
    const reader = await SvfReader.FromDerivativeService(urn, derivativeGuid,provider);

    const readerManifest = await reader.getManifest();
    console.log(readerManifest.assets)

    for (const asset of readerManifest.assets) {
      if (!asset.URI.startsWith('embed:')) {
        console.log(asset)
        try{
          // const assetData = await reader.getAsset(asset.URI)
          // console.log(assetData)
          const baseUri = derivativeUrn.substr(0, derivativeUrn.lastIndexOf('/'));
          const fullUri=path.join(baseUri, asset.URI)
          const assetData=await derivativeClient.getDerivative(urn,fullUri)
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
  try{
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
  catch(error){
    console.log(error)
  }
 
}
