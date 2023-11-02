


const amqp = require('amqplib')
const express = require('express')
const path = require('path')
const { writeFile } = require('fs/promises');
const {SvfReader } = require('forge-convert-utils')
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');


let response = {
    clientId: "",
    clientSecret: "",
    outputDirectory: "",
    urn: "",
    subUrn: ""
}

let fullPath = ""





const app = express()


app.get('/', (req, res, next) => {
    res.send("hello world")
})

app.get('/download', async (req, res, next) => {

    await ReceiveToQueue()
    console.log(response)
    if (response.clientId !== "") {

        const downloadResponse = await GetSvfDownload(response)
        console.log(downloadResponse)
        if (downloadResponse !== null) {
            // const urn=downloadResponse[0].substring(downloadResponse[0].indexOf("dXJu"))
            // fullPath=`${response.outputDirectory}\\${urn}`
            // console.log(fullPath)
            // await SendToQueue(fullPath)
            res.status(200).send("Success")
        }

    } else {
        console.log("Values can not get from queue yet")

    }
})


app.listen(8000, async () => {
    console.log("starting to express...")
})

async function GetSvfDownload({ clientId, clientSecret, outputDirectory, urn } = response) {

    const derivativeClient = new ModelDerivativeClient({ client_id: clientId, client_secret: clientSecret });
    const manifest = await derivativeClient.getManifest(urn);
    const helper = new ManifestHelper(manifest);
    const derivatives = helper.search({ type: 'resource', role: 'graphics' });
    const svf = derivatives.find(d => d.mime === 'application/autodesk-svf');

    if (!svf) {
        throw new Error('SVF dosyası bulunamadı');
      }
      const reader = await SvfReader.FromDerivativeService(urn, svf.guid,{
        client_id:clientId,
        client_secret:clientSecret
      });

      const files=await reader.read()
      console.log(files)
      for(const file in files){
        console.log(file)
        const content=files[file]
        console.log(content)
        const filePath=path.join(outputDirectory,file)
        console.log(filePath)
        await writeFile(filePath,content)
      }

      return ""

}

async function ReceiveToQueue() {
    const connection = await amqp.connect("amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi")
    const channel = await connection.createChannel()
    await channel.assertQueue("svfDownloadInfo")
    await channel.consume("svfDownloadInfo", (msg) => {
        response = JSON.parse(Buffer.from(msg.content, "utf-8").toString())
    }, { noAck: false })

    await channel.close()
    console.log(response)
    return response
}