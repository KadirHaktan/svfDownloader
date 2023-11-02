


const amqp=require('amqplib')
const express=require('express')

const {SvfDownloader,SvfReader}=require('forge-convert-utils')



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
        if(downloadResponse!==null || downloadResponse.length>0){
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

async function GetSvfDownload({clientId,clientSecret,outputDirectory,urn,subUrn}=response){ 


    const reader=await SvfReader.FromDerivativeService(urn,subUrn,{
        client_id:clientId,
        client_secret:clientSecret
    })


   console.log(reader)
   const read=reader.read()
   
   console.log(read)

    const downloader=new SvfDownloader({
        client_id:clientId,
        client_secret:clientSecret,
        
    })

    let messageArray=[]

    var response= downloader.download(urn,{
        outputDir:outputDirectory,
        log:(message)=>{
            messageArray.push(message) 
            
        }
    })
    console.log(response)
    await response.ready
    console.log(messageArray)
    return messageArray
   
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

// async function SendToQueue(fullPath){
//     const connection=await amqp.connect("amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi")
//     const channel=await connection.createChannel()

//     await channel.assertQueue("outputPath",{durable:false})
//     channel.sendToQueue("outputPath",Buffer.from(fullPath))
//     await channel.close()

// }

