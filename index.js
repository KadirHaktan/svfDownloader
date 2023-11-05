


const amqp = require('amqplib')
const express = require('express');
const { SvfReader } = require('forge-convert-utils');
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');
const path=require('path')
const stream=require('stream')
const fse=require('fs-extra')
const app = express()

let urnDir=""

let response = {
    clientId: "",
    clientSecret: "",
    urn: ""
}



const directory=__dirname

app.get('/', (req, res, next) => {
    res.send("hello world")
})

app.get('/getStream', async (req, res, next) => {
    await ReceiveToQueue()

    if (response.clientId !== "") {
        // try {
            const downloadResponse = await GetSvfStream(response)
            console.log(downloadResponse)
            if (downloadResponse !== null) {
                console.log(downloadResponse)
                res.status(200).send({
                    downloadResponse
                })
            }
        // }
        // catch (error) {
        //     res.status(500).send({
        //         error
        //     })
        // }


    } else {
        console.log("Values can not get from queue yet")
    }
})


app.listen(8000, async () => {
    console.log("starting to express...")
})

async function GetSvfStream({ clientId, clientSecret, urn } = response) {

    
    let streamList=[]

    const derivativeClient = new ModelDerivativeClient({
        client_id: clientId,
        client_secret: clientSecret
    });
  
    
    const manifest = await derivativeClient.getManifest(urn);  
    const helper = new ManifestHelper(manifest);
    const derivatives = helper.search({ type: 'resource', role: 'graphics' });

     urnDir+= path.join(directory || '.', urn);
   
    for(const derivative in derivatives.filter(d => d.mime === 'application/autodesk-svf')){
        const defaultDerivative=derivatives[parseInt(derivative)]
        const derivativeUrn=defaultDerivative.urn
        const derivativeGuid=defaultDerivative.guid
        const guidDir=path.join(urnDir, derivativeGuid);
        fse.ensureDirSync(guidDir);
        const derivativeBuffer=await derivativeClient.getDerivative(urn,encodeURI(derivativeUrn))
        const uint8derivativeBuffer=new Uint8Array(derivativeBuffer)
        fse.writeFileSync(path.join(guidDir, 'output.svf'),uint8derivativeBuffer);
        const reader=await SvfReader.FromDerivativeService(urn,derivativeGuid,{
            client_id:clientId,
            client_secret:clientSecret
        })

        const manifest=await reader.getManifest()

        for(const asset of manifest.assets){
            if (!asset.URI.startsWith('embed:')) {
                const assetData = await reader.getAsset(asset.URI);
                const assetPath = path.join(guidDir, asset.URI);
                const assetFolder = path.dirname(assetPath);
                fse.ensureDirSync(assetFolder);
                fse.writeFileSync(assetPath, assetData);
               
            }
        }

      

       
    }

    
    return urnDir
    
   
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