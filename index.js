


const amqp=require('amqplib')
const express=require('express')

const {SvfDownloader,SvfReader,GltfWriter}=require('forge-convert-utils')
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');


let response={
    clientId:"",
    clientSecret:"",
    outputDirectory:"",
    urn:"",
    subUrn:""
}

let fullPath=""





const app=express()


app.get('/',(req,res,next)=>{
    res.send("hello world")
})

app.get('/download',async(req,res,next)=>{

    await ReceiveToQueue()
    console.log(response)
    if(response.clientId!==""){

        const downloadResponse=await GetSvfDownload(response)  
        console.log(downloadResponse)
        if(downloadResponse!==null){
            const urn=downloadResponse[0].substring(downloadResponse[0].indexOf("dXJu"))
            fullPath=`${response.outputDirectory}\\${urn}`
            console.log(fullPath)
            //await SendToQueue(fullPath)
            res.status(200).send("Success")
        }
            
    }else{
        console.log("Values can not get from queue yet")

    }
})


app.listen(8000,async()=>{
    console.log("starting to express...")  
})

async function GetSvfDownload({clientId,clientSecret,outputDirectory,urn}=response){ 


    const modelDerivativeClient = new ModelDerivativeClient({
        client_id:clientId,
        client_secret:clientSecret
    });

    const manifestHelper = new ManifestHelper(await modelDerivativeClient.getManifest(urn));

    const derivatives = manifestHelper.search({ type: 'resource', role: 'graphics' });
    const readerOptions = {
        log: console.log
    };

    const writerOptions = {
        deduplicate: true,
        skipUnusedUvs: true,
        center: true,
        log: console.log,
        filter: (dbid) => (dbid >= 100 && dbid <= 200) // only output objects with dbIDs between 100 and 200
    };
    const writer = new GltfWriter(writerOptions);
    for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
        const reader = await SvfReader.FromDerivativeService(urn, derivative.guid, auth);
        const scene = await reader.read(readerOptions);
        await writer.write(scene, path.join(outputDirectory, derivative.guid));
    }

    return ""
   
}

async function ReceiveToQueue(){
    const connection=await amqp.connect("amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi")
    const channel=await connection.createChannel()
    await channel.assertQueue("svfDownloadInfo")
    await channel.consume("svfDownloadInfo",(msg)=>{
        response=JSON.parse(Buffer.from(msg.content,"utf-8").toString())       
    },{noAck:false})

    await channel.close()
    console.log(response)
    return response
}