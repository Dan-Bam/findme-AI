const express = require('express');
const sharp = require('sharp')
const crypto = require('crypto')
require('dotenv').config()
const port = 3000
const application = express()
const mysql = require('mysql2')
const fetch = require('node-fetch')
application.use(express.json());
application.use(express.urlencoded({ extended: false }));
const fs = require('fs');
const ppg_secret = "xgNDwPyllS"
const ppg_client = "6gzTr6wp6bTsXkvRrjVe"
var api_url = 'https://openapi.naver.com/v1/papago/n2mt';
var request = require('request');
const arr = [[0,0,1],[0,512,2],[512,0,3],[512,512,4]]
application.set("port", port)
AI_image={}
const bluebird = require('bluebird')
const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB,
    Promise: bluebird
})
const aws = require('aws-sdk')
const s3 = new aws.S3({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    region : 'ap-northeast-2'
});

let img_no = []

const deepai = require('deepai'); // OR include deepai.min.js as a script tag in your HTML=

deepai.setApiKey('74ee058f-bff7-408b-b31d-fac0b9a4fcce');

const insert_query = "insert into ai_image values (?,?,?);"
application.post('/makeimg',(req,res)=>{
    let tag = "";
    console.log(req.body);
    req.body.tags.forEach(element => {
        tag += element+", "
    });
    try{
        (async function() {
            const uuid = crypto.randomUUID();
            const category = req.body.category
            const imageid = req.body.lostId
            const key = `LOST/${category}/AI/${imageid}/${uuid}.jpg`
            const dong = "https://kdn-findme-bucket.s3.ap-northeast-2.amazonaws.com/"+key
            conn.query(insert_query, [imageid,dong,category], (err,rows,field)=>{
                if(err){
                    console.log(err);
		 res.send("DB error")
                }
                else{
                    console.log("insert suc")
                }
            })
            var options = {
                url: api_url,
                form: {'source':'ko', 'target':'en', 'text':tag},
                headers: {'X-Naver-Client-Id':ppg_client, 'X-Naver-Client-Secret': ppg_secret}
            };
            request.post(options, function (error, response, body) {
            if (error) {
                res.send("papago error");
            } else {
                tag = JSON.parse(body)
                console.log("trans : "+tag.message.result.translatedText)
            }

            });
            var resp = await deepai.callStandardApi("text2img", {
                    text: tag,
            });
            console.log(resp.output_url)
            const img = await fetch(resp.output_url) // 이미지 url을 fetch
                .then((res) => res.buffer()) // 반환 이미지를 blob으로 변환
            await sharp(img).toFile("temp.jpg")
            var param = {
                Bucket :'kdn-findme-bucket',
                Key : key,
                Body :fs.createReadStream('temp.jpg'),
                ContentType :'image/jpg'
            }
            await s3.upload(param, (err, data) => {
                if (err){
                    console.log(err);
                        res.send("S3 error")
                }
                console.log(data)
            })
            res.send(`image created`);
        })()
    }catch(err){
        console.log(err)
    }
                                                
});

const img_query=`SELECT lostId, url from ai_image where category = ?;`
async function check() { 
    img_no = []
    let list = [0,1,2,3]
    for (let i of list){
        var resp = await deepai.callStandardApi("image-similarity", {
            image1: fs.createReadStream("image/user.jpg"),
            image2: fs.createReadStream(`image/${i}.jpg`)
        });
        // console.log('h',resp.output.distance)
        img_no.push(resp.output.distance)
    }
    
}
async function resize(rows){
    const img = await fetch(rows.url) // 이미지 url을 fetch
    .then((res) => res.buffer()) // 반환 이미지를 blob으로 변환
    //await sharp(img).toFile(`image/file.jpg`)
    let list = [0,1,2,3]
    for (let i of list){
        await sharp(img).extract({left:arr[i][0], top:arr[i][1], width:512, height:512}).toFile(`image/${i}.jpg`)
    }
}


application.post('/checkimg', async (req,res)=>{ 
    let result = []
    let cnt = 1;
    console.log(req.body)
    const category = req.body.category.toLowerCase()
    console.log(category)

    const img = await fetch(req.body.userImage) // 이미지 url을 fetch
        .then((res) => res.buffer()) // 반환 이미지를 blob으로 변환
    sharp(img).toFile('image/user.jpg').then(
        conn.query(img_query, category, async (err,rows,field)=>{
            if(err){
                    console.log(err)
                    res.send("DB error")
            }
            console.log(rows)
           for (const row of rows){
                //console.log(row)
                //await S_3(row)
                console.log("s# suc")
                await resize(row)
                console.log("resize suc")
                await check()
                console.log(img_no)
                if(img_no.find(number => number<30)){
                    result.push(row.lostId)
                }
           }
           res.send(result)

        })
        
        
    )
})




application.listen(port,() =>{//"10.120.74.254",'192.168.43.72'
    console.log("sever is running");
})
                                                        

