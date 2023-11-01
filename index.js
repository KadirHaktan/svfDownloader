


const amqp=require('amqplib')
const express=require('express')

const {SvfDownloader, F2dDownloader}=require('forge-convert-utils')



let response={
    clientId:"",
    clientSecret:"",
    outputDirectory:"",
    urn:""
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
        if(downloadResponse!==null || downloadResponse.length>0){
            const urn=downloadResponse[0].substring(downloadResponse[0].indexOf("dXJu"))
            fullPath=`${response.outputDirectory}\\${urn}`
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




// async function GetDownload({clientId,clientSecret,outputDirectory,urn}=response){

//     const decodeUrn = Buffer.from(urn, 'base64').toString("base64")

//     if(decodeUrn.indexOf(".dwg")!==-1){
//         return await GetF2dDownload(response)
//     }
//     else{
//         return await GetSvfDownload(response)
//     }
// }

// async function GetF2dDownload({clientId,clientSecret,outputDirectory,urn}=response){
//     const downloader=new F2dDownloader({
//         client_id:clientId,
//         client_secret:clientSecret,
        
//     })

//     let messageArray=[]

//     var response= downloader.download(urn,{
//         outputDir:outputDirectory,
//         log:(message)=>{
//             messageArray.push(message) 
            
//         }
//     })
//     await response.ready
//     return messageArray
// }


async function GetSvfDownload({clientId,clientSecret,outputDirectory,urn}=response){ 
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
    await response.ready
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
    return response
}

// async function SendToQueue(fullPath){
//     const connection=await amqp.connect("amqps://asylnloi:X0SDax_OxfphJtZlP4WEMkSlKvC6ShWr@sparrow.rmq.cloudamqp.com/asylnloi")
//     const channel=await connection.createChannel()

//     await channel.assertQueue("outputPath",{durable:false})
//     channel.sendToQueue("outputPath",Buffer.from(fullPath))
//     await channel.close()

// }

