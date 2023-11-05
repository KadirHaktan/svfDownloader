


const amqp = require('amqplib')
const express = require('express')
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');

const stream=require('stream')


let response = {
    clientId: "",
    clientSecret: "",
    urn: ""
}

const app = express()


app.get('/', (req, res, next) => {
    res.send("hello world")
})

app.get('/getStream', async (req, res, next) => {
    await ReceiveToQueue()

    if (response.clientId !== "") {
        try {
            const downloadResponse = await GetSvfStream(response)
            if (downloadResponse !== null) {
                console.log(downloadResponse)
                res.send({
                    downloadResponse
                })
            }
        }
        catch (error) {
            res.send(500).send({
                error
            })
        }


    } else {
        console.log("Values can not get from queue yet")
    }
})


app.listen(8000, async () => {
    console.log("starting to express...")
})

async function GetSvfStream({ clientId, clientSecret, urn } = response) {

    let readableList=new stream.Readable()
    const derivativeClient = new ModelDerivativeClient({
        client_id: clientId,
        client_secret: clientSecret
    });
    const manifest = await derivativeClient.getManifest(urn);
    const helper = new ManifestHelper(manifest);
    const derivatives = helper.search({ type: 'resource', role: 'graphics' });
   
    for(const derivative in derivatives.filter(d => d.mime === 'application/autodesk-svf')){
        const defaultDerivative=derivatives[derivatives.indexOf(derivative)]
        const readable=await derivativeClient.getDerivativeStream(urn,encodeURI(defaultDerivative.urn))
    
        readableList.push(readable)
    }
    

    return readableList
   
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