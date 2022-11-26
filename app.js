
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
const arr = [[0,0],[0,512],[512,0],[512,512]]
AI_image={}
const conn = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB
})
const aws = require('aws-sdk')
const s3 = new aws.S3({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY,
    region : 'ap-northeast-2'
});



const deepai = require('deepai'); // OR include deepai.min.js as a script tag in your HTML=

deepai.setApiKey('74ee058f-bff7-408b-b31d-fac0b9a4fcce');

const insert_query = "insert into ai_image values (?,?,?);"
application.post('/makeimg',(req,res)=>{
    let tag = ""
    req.body.tags.forEach(element => {
        tag += element+", "
    });
    try{
        (async function() {
            var resp = await deepai.callStandardApi("text2img", {
                    text: tag,
            });
            console.log(resp.output_url)
            const img = await fetch(resp.output_url) // 이미지 url을 fetch
                .then((res) => res.buffer()) // 반환 이미지를 blob으로 변환
            await sharp(img).toFile("temp.jpg")
            const uuid = crypto.randomUUID();
            const category = req.body.category
            const imageid = req.body.lostId
            const key = `LOST/${category}/AI/${imageid}/${uuid}.jpg`
            const url = "https://kdn-findme-bucket.s3.ap-northeast-2.amazonaws.com/"+key
            conn.query(insert_query, [imageid,url,category], (err,rows,field)=>{
                if(err){
                    console.log(err)
                }
                else{
                    console.log("insert suc")
                }
            })
            var param = {
                Bucket :'kdn-findme-bucket',
                Key : key,
                Body :fs.createReadStream('temp.jpg'),
                ContentType :'image/jpg'
            }
            await s3.upload(param, (err, data) => {
                if (err){
                    throw err;
                }
                console.log(`s3 suc ${data}`)
            })

        })()
    }catch(err){
        console.log(err)
    }
    res.send("image created")
});
let img_no = 0


let similarity = [];
application.post('/checkimg',(req,res)=>{
    try {(async function() {
        let cnt = 1
        const category = req.body.category.toLowerCase()
        const img_query=`SELECT found_id, url from ai_image where category = ?;`
        console.log(img_query); 
        conn.query(img_query, category, (err,rows,field)=>{
            if(err){
                console.log(err)
            }
            console.log(rows)
        })
        // await req.userImage.forEach(element => {
        //     url_to_image(element, `userImg${cnt}.jpg`)
        //     cnt++
        // });
        // for(let i=1; i<2; i++){
        //     await sharp(buffer).extract({left:arr[i][0], top:arr[i][1], width:512, height:512}).toFile(`${i}.jpg`)
        //     var resp = await deepai.callStandardApi("image-similarity", {
        //         //image1: "https://kdn-findme-bucket.s3.ap-northeast-2.amazonaws.com/LOST/%ED%95%B8%EB%93%9C%ED%8F%B0/USER/1/9dd21616-2e2a-4f9a-bf52-508d669ae39a.jpeg",
        //         image1: fs.createReadStream("KakaoTalk_20220602_161114011_02.jpg"),
        //         image2: fs.createReadStream("0.jpg")
            
        //     });
        //     similarity.push(resp);

        // }
    
        // for(let i=0; i<similarity.length; i++){

        // }
    })()} catch(err){
        console.log(err)
    }
})


application.listen(port,"192.168.200.196",() =>{//"10.120.74.254"
    console.log("sever is running");
})